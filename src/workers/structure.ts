export interface StructureRegion {
  startLine: number;
  endLine: number;
  count: number;
  type: "Object" | "Array";
}
/** A lexical pass: counts direct entries without converting numbers or allocating a parsed document. */
export function indexStructure(text: string): StructureRegion[] {
  const stack: Array<StructureRegion & { seen: boolean }> = [];
  const regions: StructureRegion[] = [];
  let line = 1;
  let quote = "";
  let escaped = false;
  let comment = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i],
      next = text[i + 1];
    if (c === "\n") line++;
    if (comment === "line") {
      if (c === "\n") comment = "";
      continue;
    }
    if (comment === "block") {
      if (c === "*" && next === "/") {
        comment = "";
        i++;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === quote) quote = "";
      continue;
    }
    if (c === "/" && next === "/") {
      comment = "line";
      i++;
      continue;
    }
    if (c === "/" && next === "*") {
      comment = "block";
      i++;
      continue;
    }
    const current = stack[stack.length - 1];
    if (c === '"' || c === "'") {
      if (current?.type === "Array" && !current.seen) {
        current.count++;
        current.seen = true;
      }
      quote = c;
      continue;
    }
    if (c === "{" || c === "[") {
      if (current?.type === "Array" && !current.seen) {
        current.count++;
        current.seen = true;
      }
      stack.push({
        startLine: line,
        endLine: line,
        count: 0,
        type: c === "{" ? "Object" : "Array",
        seen: false,
      });
      continue;
    }
    if (c === "}" || c === "]") {
      const item = stack.pop();
      if (item && item.type === (c === "}" ? "Object" : "Array"))
        regions.push({
          startLine: item.startLine,
          endLine: line,
          count: item.count,
          type: item.type,
        });
      continue;
    }
    if (c === ":" && current?.type === "Object") current.count++;
    if (c === "," && current) current.seen = false;
    else if (current?.type === "Array" && !current.seen && !/\s/.test(c)) {
      current.count++;
      current.seen = true;
    }
  }
  return regions;
}
