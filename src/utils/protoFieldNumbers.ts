import { messageError } from "@/i18n/diagnostics";
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
interface EnumValue {
  token: Token;
  sign?: Token;
  value: number;
}
interface Enum {
  values: EnumValue[];
  unavailable: Range[];
  allowAlias: boolean;
}
const MAX_FIELD_NUMBER = 536_870_911;
const MAX_ENUM_NUMBER = 2_147_483_647;
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
      throw messageError("Protobuf 字符串或注释未闭合");
    tokens.push({ text, start: match.index, end: pattern.lastIndex });
  }
  return tokens;
}

function integer(token: Token | undefined, max = MAX_FIELD_NUMBER): number {
  const text = token?.text ?? "";
  const value = /^0[xX][0-9a-f]+$/i.test(text)
    ? parseInt(text.slice(2), 16)
    : /^0[0-7]+$/.test(text)
      ? parseInt(text, 8)
      : /^(?:0|[1-9][0-9]*)$/.test(text)
        ? Number(text)
        : NaN;
  if (!Number.isInteger(value) || value < 0 || value > max)
    throw messageError("Protobuf 编号或保留范围无效");
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
        throw messageError("Protobuf 括号不匹配");
      pairs.set(open, index);
    }
  });
  if (stack.length) throw messageError("Protobuf 括号未闭合");

  const messages: Message[] = [];
  const enums: Enum[] = [];
  const text = (index: number) => tokens[index]?.text;
  function expect(index: number, expected: string): number {
    if (text(index) !== expected)
      throw messageError("Protobuf 语法不完整，预期 {0}", { 0: expected });
    return index + 1;
  }
  function identifier(index: number): number {
    if (!IDENTIFIER.test(text(index) ?? ""))
      throw messageError("Protobuf 字段或类型名称无效");
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
    throw messageError("Protobuf 语句缺少分号");
  }
  function enumNumber(index: number): EnumValue {
    const sign = text(index) === "-" ? tokens[index++] : undefined;
    const token = tokens[index];
    const magnitude = integer(
      token,
      sign ? MAX_ENUM_NUMBER + 1 : MAX_ENUM_NUMBER,
    );
    return { token, sign, value: sign ? -magnitude : magnitude };
  }
  function ranges(
    start: number,
    end: number,
    unavailable: Range[],
    isEnum = false,
  ) {
    // Reserved names do not occupy field numbers (Editions also allows identifiers).
    if (/^["'A-Za-z_]/.test(text(start) ?? "")) return;
    let index = start;
    function rangeNumber() {
      if (!isEnum) return integer(tokens[index++]);
      const entry = enumNumber(index);
      index += entry.sign ? 2 : 1;
      return entry.value;
    }
    while (index < end) {
      const first = rangeNumber();
      let last = first;
      if (text(index) === "to") {
        index++;
        if (text(index) === "max") {
          last = isEnum ? MAX_ENUM_NUMBER : MAX_FIELD_NUMBER;
          index++;
        } else last = rangeNumber();
      }
      if ((!isEnum && first < 1) || last < first)
        throw messageError("Protobuf 保留范围无效");
      unavailable.push([first, last]);
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
  function enumBlock(start: number): number {
    const body = block(identifier(start + 1));
    const enumeration: Enum = {
      values: [],
      unavailable: [],
      allowAlias: false,
    };
    enums.push(enumeration);
    for (let index = body.start; index < body.end; ) {
      if (text(index) === ";") index++;
      else if (text(index) === "option" || text(index) === "reserved") {
        const last = statementEnd(index, body.end);
        if (text(index) === "reserved") {
          ranges(index + 1, last, enumeration.unavailable, true);
        } else if (
          last === index + 4 &&
          text(index + 1) === "allow_alias" &&
          text(index + 2) === "="
        ) {
          enumeration.allowAlias = text(index + 3) === "true";
        }
        index = last + 1;
      } else {
        index = expect(identifier(index), "=");
        const value = enumNumber(index);
        enumeration.values.push(value);
        index += value.sign ? 2 : 1;
        if (text(index) === "[") index = pairs.get(index)! + 1;
        index = expect(index, ";");
      }
    }
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
    if (depth > 256) throw messageError("Protobuf 嵌套层级过深");
    for (let index = start; index < end; ) {
      const keyword = text(index);
      if (keyword === ";") index++;
      else if (keyword === "message") index = messageBlock(index, depth);
      else if (keyword === "oneof" && message) {
        const body = block(identifier(index + 1));
        scope(body.start, body.end, message, depth + 1);
        index = body.end + 1;
      } else if (keyword === "enum") index = enumBlock(index);
      else if (["service", "extend"].includes(keyword)) {
        const body = block(typeName(index + 1));
        index = body.end + 1;
      } else if (["reserved", "extensions"].includes(keyword) && message) {
        const last = statementEnd(index, end);
        // Extension declarations may have options after the numeric ranges.
        let rangeEnd = index + 1;
        while (rangeEnd < last && text(rangeEnd) !== "[") rangeEnd++;
        ranges(index + 1, rangeEnd, message.unavailable);
        index = last + 1;
      } else if (keyword === "option" || !message) {
        index = statementEnd(index, end) + 1;
      } else index = field(index, message, depth);
    }
  }
  scope(0, tokens.length);

  const replacements: { token: Token; value: string }[] = [];
  function replace(token: Token, value: string) {
    if (token.text !== value) replacements.push({ token, value });
  }
  function nextNumber(unavailable: Range[], number: number, max: number) {
    unavailable.sort((a, b) => a[0] - b[0]);
    let rangeIndex = 0;
    return () => {
      while (rangeIndex < unavailable.length) {
        const [first, last] = unavailable[rangeIndex];
        if (number < first) break;
        if (number <= last) number = last + 1;
        rangeIndex++;
      }
      if (number > max) throw messageError("Protobuf 已无可用编号");
      return number++;
    };
  }
  for (const message of messages) {
    const next = nextNumber(message.unavailable, 1, MAX_FIELD_NUMBER);
    for (const token of message.fields) replace(token, String(next()));
  }
  for (const enumeration of enums) {
    const next = nextNumber(enumeration.unavailable, 0, MAX_ENUM_NUMBER);
    const aliases = new Map<number, number>();
    for (const { token, sign, value } of enumeration.values) {
      const number = aliases.get(value) ?? next();
      if (enumeration.allowAlias) aliases.set(value, number);
      if (sign) replace(sign, "");
      replace(token, String(number));
    }
  }
  replacements.sort((a, b) => a.token.start - b.token.start);
  const output: string[] = [];
  let offset = 0;
  for (const { token, value } of replacements) {
    output.push(source.slice(offset, token.start), value);
    offset = token.end;
  }
  output.push(source.slice(offset));
  return output.join("");
}
