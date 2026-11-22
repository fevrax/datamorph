import { LosslessNumber } from "lossless-json";
import type { ErrorDetails } from "@/i18n/diagnostics";

export type NodePath = (string | number)[];

const pageSize = 100;
const previewLimit = 4000;

export type ColumnRequest = {
  id: number;
  path: NodePath;
  pages: Record<number, number>;
  document?: { content: string; language: string };
};

export type ColumnResponse =
  | { id: number; view: ReturnType<typeof browseColumns> }
  | { id: number; error: ErrorDetails };

export function formatNodePath(path: NodePath) {
  return path.reduce<string>((result, key) => {
    if (typeof key === "string" && /^[A-Za-z_][A-Za-z_0-9]*$/.test(key))
      return `${result}.${key}`;
    return `${result}[${JSON.stringify(key)}]`;
  }, "$");
}

function nodeType(value: unknown) {
  if (value === null) return "null";
  if (value instanceof LosslessNumber) return "number";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function isBranch(
  value: unknown,
): value is Record<string, unknown> | unknown[] {
  const type = nodeType(value);
  return type === "array" || type === "object";
}

function readChild(
  value: Record<string, unknown> | unknown[],
  key: string | number,
) {
  return (value as Record<string | number, unknown>)[key];
}

function scalarPreview(value: unknown, limit: number) {
  if (value instanceof LosslessNumber) return value.value;
  if (typeof value === "string" && value.length > limit)
    return `${JSON.stringify(value.slice(0, limit))}…`;
  return JSON.stringify(value);
}

type ObjectKeys = (value: Record<string, unknown>) => string[];

function nodePreview(value: unknown, keysOf: ObjectKeys) {
  let text = "";
  let truncated = false;
  const append = (part: string) => {
    if (text.length + part.length > previewLimit) {
      text += part.slice(0, previewLimit - text.length);
      truncated = true;
    } else text += part;
  };
  function visit(node: unknown, depth: number) {
    if (!isBranch(node)) {
      append(scalarPreview(node, previewLimit));
      return;
    }
    const keys = Array.isArray(node) ? undefined : keysOf(node);
    const size = keys?.length ?? (node as unknown[]).length;
    append(keys ? "{" : "[");
    let index = 0;
    for (; depth < 5 && !truncated && index < Math.min(size, 12); index++) {
      const key = keys?.[index] ?? index;
      append(`${index ? "," : ""}\n${"  ".repeat(depth + 1)}`);
      if (typeof key === "string")
        append(`${JSON.stringify(key.slice(0, previewLimit))}: `);
      visit(readChild(node, key), depth + 1);
    }
    if (index < size) append(index ? ", …" : "…");
    if (index) append(`\n${"  ".repeat(depth)}`);
    append(keys ? "}" : "]");
  }
  visit(value, 0);
  return truncated ? `${text}…` : text;
}

export function createColumnBrowser(root: unknown) {
  const objectKeys = new WeakMap<object, string[]>();
  const keysOf = (value: Record<string, unknown>) => {
    let keys = objectKeys.get(value);
    if (!keys) {
      keys = Object.keys(value);
      objectKeys.set(value, keys);
    }
    return keys;
  };
  return (path: NodePath, pages: ColumnRequest["pages"]) =>
    browseColumns(root, path, pages, keysOf);
}

function browseColumns(
  root: unknown,
  path: NodePath,
  pages: ColumnRequest["pages"],
  keysOf: ObjectKeys,
) {
  const nodes = [root];
  for (const key of path) {
    const parent = nodes[nodes.length - 1];
    if (
      !isBranch(parent) ||
      Array.isArray(parent) !== (typeof key === "number") ||
      !Object.prototype.hasOwnProperty.call(parent, key)
    )
      break;
    nodes.push(readChild(parent, key));
  }
  const selectedPath = path.slice(0, nodes.length - 1);
  const selected = nodes[nodes.length - 1];
  const lastBranch = nodes.length - (isBranch(selected) ? 1 : 2);
  const columns = [];
  for (let depth = Math.max(0, lastBranch - 1); depth <= lastBranch; depth++) {
    const node = nodes[depth];
    if (!isBranch(node)) continue;
    const keys = Array.isArray(node) ? undefined : keysOf(node);
    const count = keys?.length ?? (node as unknown[]).length;
    const selectedKey = selectedPath[depth];
    const selectedIndex =
      typeof selectedKey === "string"
        ? (keys?.indexOf(selectedKey) ?? -1)
        : (selectedKey ?? -1);
    const pageCount = Math.max(1, Math.ceil(count / pageSize));
    const page = Math.max(
      0,
      Math.min(
        pages[depth] ?? Math.floor(selectedIndex / pageSize),
        pageCount - 1,
      ),
    );
    const start = page * pageSize;
    const rows = [];
    for (
      let index = start;
      index < Math.min(start + pageSize, count);
      index++
    ) {
      const key = keys?.[index] ?? index;
      const value = readChild(node, key);
      const branch = isBranch(value);
      const summary = Array.isArray(value)
        ? `[${value.length}]`
        : branch
          ? `{${keysOf(value as Record<string, unknown>).length}}`
          : scalarPreview(value, 48).slice(0, 100);
      rows.push({ key, summary, branch });
    }
    columns.push({ depth, page, pageCount, count, rows });
  }
  return {
    path: selectedPath,
    columns,
    type: nodeType(selected),
    preview: nodePreview(selected, keysOf),
  };
}
