import type { EncodingType, EncodingOptions } from "@/utils/encodingConverter";
import type { NamingFormat } from "@/utils/keyNamingConverter";
export type ConversionInput =
  | {
      action: "export";
      content: string;
      format: "csv" | "xlsx";
      path?: string | null;
    }
  | { action: "convert"; content: string; from: string; to: string }
  | { action: "type"; content: string; language: string; name?: string }
  | { action: "keys"; content: string; format: NamingFormat }
  | {
      action: "encode" | "decode";
      content: string;
      encoding: EncodingType;
      options: EncodingOptions;
    };
export async function executeConversion(
  input: ConversionInput,
): Promise<{ content: string; buffer?: ArrayBuffer }> {
  switch (input.action) {
    case "export": {
      const [{ parseJson }, table] = await Promise.all([
        import("@/utils/json"),
        import("@/utils/tableExport"),
      ]);
      const value = parseJson(input.content);
      return input.format === "csv"
        ? { content: table.convertToCSV(value, input.path) }
        : { content: "", buffer: table.convertToExcel(value, input.path) };
    }
    case "convert": {
      const { convertDataFormat } = await import("@/utils/dataFormatConverter");
      return {
        content: convertDataFormat(input.content, input.from, input.to),
      };
    }
    case "keys": {
      const { convertJsonKeys } = await import("@/utils/keyNamingConverter");
      return { content: convertJsonKeys(input.content, input.format, 2) };
    }
    case "type": {
      const q = await import("quicktype-core");
      const language =
        input.language === "plaintext" ? "schema" : input.language;
      const json = q.jsonInputForTargetLanguage(language);
      await json.addSource({
        name: input.name || "GeneratedType",
        samples: [input.content],
      });
      const inputData = new q.InputData();
      inputData.addInput(json);
      const result = await q.quicktype({
        inputData,
        lang: language,
        rendererOptions: { "just-types": "true", "acronym-style": "original" },
      });
      return { content: result.lines.join("\n") };
    }
    case "encode":
    case "decode": {
      const e = await import("@/utils/encodingConverter");
      return {
        content: (input.action === "encode"
          ? e.encodeFromText
          : e.decodeToText)(input.content, input.encoding, input.options),
      };
    }
  }
}
