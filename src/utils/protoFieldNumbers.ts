interface Token {
  text: string;
  start: number;
  end: number;
}
type Range = [number, number];
interface Message {
  fields: Token[];
  unavailable: Range[];
}
const MAX_FIELD_NUMBER = 536_870_911;
const IDENTIFIER = /^[A-Za-z_][A-Za-z_0-9]*$/;

// Keep source offsets so that comments, options and formatting remain verbatim.
function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const pattern =
    /\s+|\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|"(?:\\[^]|[^"\\\r\n])*"|'(?:\\[^]|[^'\\\r\n])*'|[A-Za-z_][A-Za-z_0-9]*|0[xX][0-9A-Fa-f]+|[0-9]+|[^]/gy;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const text = match[0];
    if (/^\s|^\/\//.test(text) || text.startsWith("/*")) continue;
    if (text === '"' || text === "'" || source.startsWith("/*", match.index))
      throw new Error("Protobuf 字符串或注释未闭合");
    tokens.push({ text, start: match.index, end: pattern.lastIndex });
  }
  return tokens;
}

function integer(token?: Token): number {
  const text = token?.text ?? "";
  const value = /^0[xX][0-9a-f]+$/i.test(text)
    ? parseInt(text.slice(2), 16)
    : /^0[0-7]+$/.test(text)
      ? parseInt(text, 8)
      : /^(?:0|[1-9][0-9]*)$/.test(text)
        ? Number(text)
        : NaN;
  if (!Number.isInteger(value) || value < 0 || value > MAX_FIELD_NUMBER)
    throw new Error("Protobuf 字段编号或保留范围无效");
  return value;
}

export function renumberProtoFields(source: string): string {
  const tokens = tokenize(source);
  const pairs = new Map<number, number>();
  const stack: number[] = [];
  const closing = new Map([
    ["}", "{"],
    ["]", "["],
    [")", "("],
  ]);
  tokens.forEach((token, index) => {
    if (["{", "[", "("].includes(token.text)) stack.push(index);
    else if (closing.has(token.text)) {
      const open = stack.pop();
      if (open === undefined || tokens[open].text !== closing.get(token.text))
        throw new Error("Protobuf 括号不匹配");
      pairs.set(open, index);
    }
  });
  if (stack.length) throw new Error("Protobuf 括号未闭合");

  const messages: Message[] = [];
  const text = (index: number) => tokens[index]?.text;
  function expect(index: number, expected: string): number {
    if (text(index) !== expected)
      throw new Error(`Protobuf 语法不完整，预期 ${expected}`);
    return index + 1;
  }
  function identifier(index: number): number {
    if (!IDENTIFIER.test(text(index) ?? ""))
      throw new Error("Protobuf 字段或类型名称无效");
    return index + 1;
  }
  function typeName(index: number): number {
    if (text(index) === ".") index++;
    index = identifier(index);
    while (text(index) === ".") index = identifier(index + 1);
    return index;
  }
  function statementEnd(index: number, end: number): number {
    for (; index < end; index++) {
      if (text(index) === ";") return index;
      const close = pairs.get(index);
      if (close !== undefined) index = close;
    }
    throw new Error("Protobuf 语句缺少分号");
  }
  function ranges(start: number, end: number, message: Message) {
    // Reserved names do not occupy field numbers (Editions also allows identifiers).
    if (/^["'A-Za-z_]/.test(text(start) ?? "")) return;
    let index = start;
    while (index < end) {
      const first = integer(tokens[index++]);
      let last = first;
      if (text(index) === "to") {
        index++;
        last =
          text(index) === "max" ? MAX_FIELD_NUMBER : integer(tokens[index]);
        index++;
      }
      if (first < 1 || last < first) throw new Error("Protobuf 保留范围无效");
      message.unavailable.push([first, last]);
      if (index < end) index = expect(index, ",");
    }
  }
  function block(start: number): { start: number; end: number } {
    start = expect(start, "{");
    return { start, end: pairs.get(start - 1)! };
  }
  function messageBlock(start: number, depth: number): number {
    const body = block(identifier(start + 1));
    const message: Message = { fields: [], unavailable: [[19000, 19999]] };
    messages.push(message);
    scope(body.start, body.end, message, depth + 1);
    return body.end + 1;
  }
  function field(start: number, message: Message, depth: number): number {
    let index = start;
    if (["optional", "required", "repeated"].includes(text(index))) index++;
    const group = text(index) === "group";
    if (group) index++;
    else if (text(index) === "map" && text(index + 1) === "<") {
      index = expect(typeName(index + 2), ",");
      index = expect(typeName(index), ">");
    } else index = typeName(index);
    index = expect(identifier(index), "=");
    integer(tokens[index]);
    message.fields.push(tokens[index++]);
    if (text(index) === "[") index = pairs.get(index)! + 1;
    if (group) {
      const body = block(index);
      const child: Message = { fields: [], unavailable: [[19000, 19999]] };
      messages.push(child);
      scope(body.start, body.end, child, depth + 1);
      return body.end + 1;
    }
    return expect(index, ";");
  }
  function scope(start: number, end: number, message?: Message, depth = 0) {
    if (depth > 256) throw new Error("Protobuf 嵌套层级过深");
    for (let index = start; index < end; ) {
      const keyword = text(index);
      if (keyword === ";") index++;
      else if (keyword === "message") index = messageBlock(index, depth);
      else if (keyword === "oneof" && message) {
        const body = block(identifier(index + 1));
        scope(body.start, body.end, message, depth + 1);
        index = body.end + 1;
      } else if (["enum", "service", "extend"].includes(keyword)) {
        const body = block(typeName(index + 1));
        index = body.end + 1;
      } else if (["reserved", "extensions"].includes(keyword) && message) {
        const last = statementEnd(index, end);
        // Extension declarations may have options after the numeric ranges.
        let rangeEnd = index + 1;
        while (rangeEnd < last && text(rangeEnd) !== "[") rangeEnd++;
        ranges(index + 1, rangeEnd, message);
        index = last + 1;
      } else if (keyword === "option" || !message) {
        index = statementEnd(index, end) + 1;
      } else index = field(index, message, depth);
    }
  }
  scope(0, tokens.length);

  const replacements: { token: Token; number: number }[] = [];
  for (const message of messages) {
    const unavailable = message.unavailable.sort((a, b) => a[0] - b[0]);
    let number = 1;
    let rangeIndex = 0;
    for (const token of message.fields) {
      while (rangeIndex < unavailable.length) {
        const [first, last] = unavailable[rangeIndex];
        if (number < first) break;
        if (number <= last) number = last + 1;
        rangeIndex++;
      }
      if (number > MAX_FIELD_NUMBER)
        throw new Error("Protobuf 已无可用字段编号");
      if (token.text !== String(number)) replacements.push({ token, number });
      number++;
    }
  }
  replacements.sort((a, b) => a.token.start - b.token.start);
  const output: string[] = [];
  let offset = 0;
  for (const { token, number } of replacements) {
    output.push(source.slice(offset, token.start), String(number));
    offset = token.end;
  }
  output.push(source.slice(offset));
  return output.join("");
}
