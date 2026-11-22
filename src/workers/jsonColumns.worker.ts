import { errorDetails, messageError } from "@/i18n/diagnostics";
import { parseJson } from "@/utils/json";
import { parseDataFormat } from "@/utils/dataFormatConverter";
import {
  createColumnBrowser,
  type ColumnRequest,
  type ColumnResponse,
} from "./jsonColumns";

let browse: ReturnType<typeof createColumnBrowser> | undefined;

self.onmessage = ({ data }: MessageEvent<ColumnRequest>) => {
  let response: ColumnResponse;
  try {
    if (data.document) {
      const { content, language } = data.document;
      browse = createColumnBrowser(
        language === "json5"
          ? parseDataFormat(content, language)
          : parseJson(content),
      );
    }
    if (!browse) throw messageError("文档未加载");
    response = { id: data.id, view: browse(data.path, data.pages) };
  } catch (error) {
    response = {
      id: data.id,
      error: errorDetails(error),
    };
  }
  self.postMessage(response);
};
