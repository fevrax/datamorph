import { executeConversion, type ConversionInput } from "./conversion";
import { errorDetails } from "@/i18n/diagnostics";
self.onmessage = async (
  event: MessageEvent<{ id: number; input: ConversionInput }>,
) => {
  const { id, input } = event.data;
  try {
    self.postMessage({ id, result: await executeConversion(input) });
  } catch (error) {
    self.postMessage({
      id,
      error: errorDetails(error),
      details:
        error instanceof Error
          ? Object.assign({ name: error.name }, error)
          : undefined,
    });
  }
};
