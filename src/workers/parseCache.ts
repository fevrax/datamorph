import { LosslessNumber } from "lossless-json";
import { runJsonTask, cancelJsonTask } from "./client";
const cache = new Map<string, { text: string; data: unknown }>();
function revive(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const stack = [value as Record<string, unknown>];
  while (stack.length) {
    const object = stack.pop()!;
    for (const key of Object.keys(object)) {
      const child = object[key];
      if (child && typeof child === "object") {
        if (
          "isLosslessNumber" in child &&
          child.isLosslessNumber === true &&
          "value" in child &&
          typeof child.value === "string"
        )
          object[key] = new LosslessNumber(child.value);
        else stack.push(child as Record<string, unknown>);
      }
    }
  }
  if ("isLosslessNumber" in value && "value" in value)
    return new LosslessNumber(String(value.value));
  return value;
}
export async function parseDocument(key: string, text: string) {
  const found = cache.get(key);
  if (found?.text === text) return found.data;
  const result = await runJsonTask("table:" + key, {
    action: "parse",
    content: text,
  });
  const data = revive(result.data);
  cache.set(key, { text, data });
  if (cache.size > 3) cache.delete(cache.keys().next().value!);
  return data;
}
export function cancelParse(key: string) {
  cancelJsonTask("table:" + key);
}
if (typeof window !== "undefined")
  window.addEventListener("datamorph:close-model", (event) => {
    const key = (event as CustomEvent<string>).detail;
    cache.delete(key);
    cancelParse(key);
  });
