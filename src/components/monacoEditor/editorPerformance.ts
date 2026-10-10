export interface EditorWorkload {
  chars: number;
  lines: number;
  isLarge: boolean;
}

export interface WorkloadModel {
  getValueLength: () => number;
  getLineCount: () => number;
}

export interface TimeoutRef {
  current: ReturnType<typeof setTimeout> | null;
}

export interface InlineDecorationUpdateOptions {
  timeoutRef: TimeoutRef;
  workload: EditorWorkload;
  run: () => void;
  delay?: number;
}

export const LARGE_FILE_CHAR_THRESHOLD = 1_000_000;
export const LARGE_FILE_LINE_THRESHOLD = 20_000;
export const NORMAL_VALIDATION_DELAY = 500;
export const LARGE_FILE_VALIDATION_DELAY = 1500;

export function getEditorWorkload(
  model: WorkloadModel | null | undefined,
): EditorWorkload {
  const chars = model?.getValueLength() ?? 0;
  const lines = model?.getLineCount() ?? 0;

  return {
    chars,
    lines,
    isLarge:
      chars > LARGE_FILE_CHAR_THRESHOLD || lines > LARGE_FILE_LINE_THRESHOLD,
  };
}

export function shouldRunInlineDecorations(workload: EditorWorkload): boolean {
  return workload.lines > 0;
}

export function getValidationDelay(workload: EditorWorkload): 500 | 1500 {
  return workload.isLarge
    ? LARGE_FILE_VALIDATION_DELAY
    : NORMAL_VALIDATION_DELAY;
}

export function isHistoryContentTooLarge(content: string): boolean {
  return content.length > LARGE_FILE_CHAR_THRESHOLD;
}

export function getHistoryContentHash(content: string): string {
  let hash = 0;

  for (let i = 0; i < content.length; i++) {
    hash = (hash << 5) - hash + content.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

export function scheduleInlineDecorationUpdate({
  timeoutRef,
  workload,
  run,
  delay = 200,
}: InlineDecorationUpdateOptions): void {
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }

  if (!shouldRunInlineDecorations(workload)) {
    return;
  }

  timeoutRef.current = setTimeout(() => {
    timeoutRef.current = null;
    run();
  }, delay);
}
