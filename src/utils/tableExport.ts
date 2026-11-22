import { messageError } from "@/i18n/diagnostics";
import { isLosslessNumber } from "lossless-json";

import { stringifyJson } from "./json";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  !isLosslessNumber(value);

/** Resolve the paths emitted by JsonTable, including falsy values and numeric keys.
 * Its display paths are ambiguous for some keys; refuse those instead of exporting
 * a different node. A missing/stale selection must never fall back to all data.
 */
export function getTableExportData(
  data: unknown,
  path?: string | null,
): unknown {
  if (!path || path === "root") return data;
  const matches: unknown[] = [];
  const visit = (value: unknown, current: string) => {
    if (current === path) {
      matches.push(value);

      return;
    }
    if (
      !path.startsWith(current) ||
      (!isRecord(value) && !Array.isArray(value))
    )
      return;
    for (const key of Object.keys(value)) {
      const next = Array.isArray(value)
        ? `${current}[${key}]`
        : `${current}.${key}`;

      if (
        path === next ||
        path.startsWith(`${next}.`) ||
        path.startsWith(`${next}[`)
      ) {
        visit((value as Record<string, unknown>)[key], next);
      }
    }
  };

  visit(data, "root");
  if (matches.length !== 1)
    throw messageError("选中路径不存在或存在歧义，请重新选择节点");

  return matches[0];
}

/** Object records use the union of own keys; mixed/nested arrays use one cell
 * per element. null is literal text, missing properties are empty cells.
 */
function tableRows(data: unknown): unknown[][] {
  const records = isRecord(data)
    ? [data]
    : Array.isArray(data) && data.length > 0 && data.every(isRecord)
      ? data
      : null;

  if (records) {
    const headers = [...new Set(records.flatMap(Object.keys))];

    if (headers.length)
      return [
        headers,
        ...records.map((row) =>
          headers.map((key) =>
            Object.prototype.hasOwnProperty.call(row, key)
              ? row[key]
              : undefined,
          ),
        ),
      ];
  }
  if (Array.isArray(data) && data.length > 0)
    return data.map((value) => [value]);

  return [[data]];
}

function cellText(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (isLosslessNumber(value)) return value.toString();
  if (typeof value === "bigint") return value.toString();

  return stringifyJson(value);
}

/** RFC 4180 escaping applies equally to headers and values; no comment rows. */
export function convertToCSV(
  data: unknown,
  selectedPath?: string | null,
): string {
  return tableRows(getTableExportData(data, selectedPath))
    .map((row) =>
      row
        .map((value) => {
          const text = cellText(value);

          return /[",\r\n]/.test(text) || text === ""
            ? `"${text.replace(/"/g, '""')}"`
            : text;
        })
        .join(","),
    )
    .join("\r\n");
}

// SpreadsheetML strings escape XML-invalid characters and literal _xHHHH_
// sequences. Encode CR so XML newline normalization does not change the value.
function xmlText(text: string): string {
  return text
    .replace(/_x[0-9a-f]{4}_/gi, (match) => `_x005F_${match.slice(1)}`)
    .replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]|[\ud800-\udfff]/gu,
      (char) =>
        `_x${char.charCodeAt(0).toString(16).padStart(4, "0").toUpperCase()}_`,
    )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r/g, "&#13;");
}

function columnName(index: number): string {
  let name = "";

  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }

  return name;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;

  for (let bit = 0; bit < 8; bit++)
    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);

  return crc >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];

  return (crc ^ 0xffffffff) >>> 0;
}

/** Minimal ZIP writer: stored entries, UTF-8 names, CRC32 and central directory.
 * No compression dependency; deliberately not a general-purpose ZIP library.
 */
function zip(files: Record<string, string>): ArrayBuffer {
  const encoder = new TextEncoder();
  const entries = Object.entries(files).map(([name, body]) => ({
    name: encoder.encode(name),
    body: encoder.encode(body),
  }));
  const size = entries.reduce(
    (sum, entry) => sum + 76 + 2 * entry.name.length + entry.body.length,
    22,
  );

  if (size >= 0xffffffff) throw messageError("导出文件过大");
  const buffer = new ArrayBuffer(size);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const short = (offset: number, value: number) =>
    view.setUint16(offset, value, true);
  const long = (offset: number, value: number) =>
    view.setUint32(offset, value, true);
  let offset = 0;
  const offsets: number[] = [];

  for (const entry of entries) {
    offsets.push(offset);
    long(offset, 0x04034b50);
    short(offset + 4, 20);
    short(offset + 6, 0x0800);
    short(offset + 12, 33); // 1980-01-01
    long(offset + 14, crc32(entry.body));
    long(offset + 18, entry.body.length);
    long(offset + 22, entry.body.length);
    short(offset + 26, entry.name.length);
    bytes.set(entry.name, offset + 30);
    bytes.set(entry.body, offset + 30 + entry.name.length);
    offset += 30 + entry.name.length + entry.body.length;
  }
  const directoryOffset = offset;

  entries.forEach((entry, index) => {
    long(offset, 0x02014b50);
    short(offset + 4, 20);
    short(offset + 6, 20);
    short(offset + 8, 0x0800);
    short(offset + 14, 33);
    long(offset + 16, crc32(entry.body));
    long(offset + 20, entry.body.length);
    long(offset + 24, entry.body.length);
    short(offset + 28, entry.name.length);
    long(offset + 42, offsets[index]);
    bytes.set(entry.name, offset + 46);
    offset += 46 + entry.name.length;
  });
  long(offset, 0x06054b50);
  short(offset + 8, entries.length);
  short(offset + 10, entries.length);
  long(offset + 12, offset - directoryOffset);
  long(offset + 16, directoryOffset);

  return buffer;
}

// Treat finite JSON numbers with at most 15 significant digits as numeric cells.
// Reject overflow/underflow and long integers before coercing LosslessNumber.
function excelNumber(value: unknown): number | undefined {
  if (typeof value !== "number" && !isLosslessNumber(value)) return undefined;
  const text = String(value);
  const coefficient = text.split(/[eE]/)[0].replace(/^-/, "");
  const digits = coefficient.replace(".", "").replace(/^0+/, "");

  if (digits.length > 15) return undefined;
  const number = Number(text);

  if (!Number.isFinite(number) || (number === 0 && /[1-9]/.test(coefficient)))
    return undefined;
  // Excel does not support subnormal IEEE doubles.
  if (number !== 0 && Math.abs(number) < 2.2250738585072014e-308)
    return undefined;

  return number;
}

/** A real .xlsx workbook. High-precision numbers/BigInt stay text;
 * strings (including formula-like strings) are always inline strings, never formulas.
 * Stored ZIP keeps this synchronous and dependency-free at the cost of file size.
 */
export function convertToExcel(
  data: unknown,
  selectedPath?: string | null,
): ArrayBuffer {
  const rows = tableRows(getTableExportData(data, selectedPath));

  if (rows.length > 1048576 || rows.some((row) => row.length > 16384)) {
    throw messageError("数据超出 Excel 行数或列数限制");
  }
  const sheet = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map((value, colIndex) => {
            const ref = `${columnName(colIndex)}${rowIndex + 1}`;

            if (typeof value === "boolean")
              return `<c r="${ref}" t="b"><v>${Number(value)}</v></c>`;
            const numeric = excelNumber(value);

            if (numeric !== undefined)
              return `<c r="${ref}"><v>${numeric}</v></c>`;
            const text = cellText(value);

            if (text.length > 32767)
              throw messageError("单元格内容超出 Excel 的 32767 字符限制");

            return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlText(text)}</t></is></c>`;
          })
          .join("")}</row>`,
    )
    .join("");
  const main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const rel =
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const packageRel =
    "http://schemas.openxmlformats.org/package/2006/relationships";
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

  return zip({
    "[Content_Types].xml": `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    "_rels/.rels": `${declaration}<Relationships xmlns="${packageRel}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `${declaration}<workbook xmlns="${main}" xmlns:r="${rel}"><sheets><sheet name="JSON" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `${declaration}<Relationships xmlns="${packageRel}"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": `${declaration}<worksheet xmlns="${main}"><sheetData>${sheet}</sheetData></worksheet>`,
  });
}

export function downloadTableExport(
  content: string | ArrayBuffer,
  format: "csv" | "xlsx",
): void {
  const blob =
    format === "csv"
      ? new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" })
      : new Blob([content], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `data.${format}`;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
