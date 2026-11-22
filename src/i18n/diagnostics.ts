import { formatMessage, type Message, type MessageArguments } from "./index";
import { getLocale, type Locale } from "./locale";

type MessageValue = string | number | boolean | null | undefined | Diagnostic;

export interface Diagnostic {
  key: Message;
  values?: Record<number, MessageValue>;
}

export interface ErrorDetails {
  message: string;
  diagnostic?: Diagnostic;
}

export function message<Key extends Message>(
  key: Key,
  ...args: MessageArguments<Key>
): Diagnostic {
  const values = args[0];
  return values
    ? {
        key,
        values: Object.fromEntries(
          Object.entries(values).map(([index, value]) => [
            index,
            value && typeof value === "object" && "key" in value
              ? (value as Diagnostic)
              : String(value ?? ""),
          ]),
        ),
      }
    : { key };
}

function localize(diagnostic: Diagnostic, locale: Locale): string {
  if (!diagnostic.values) return formatMessage(locale, diagnostic.key);
  const values = Object.fromEntries(
    Object.entries(diagnostic.values).map(([index, value]) => [
      index,
      value && typeof value === "object" ? localize(value, locale) : value,
    ]),
  );
  return formatMessage(locale, diagnostic.key, values);
}

export class DiagnosticError extends Error {
  constructor(readonly diagnostic: Diagnostic) {
    super(localize(diagnostic, "zh-CN"));
  }
}

export function messageError<Key extends Message>(
  key: Key,
  ...args: MessageArguments<Key>
) {
  return new DiagnosticError(message(key, ...args));
}

export function errorDetails(error: unknown): ErrorDetails {
  if (error && typeof error === "object" && "message" in error) {
    return {
      message: String(error.message),
      ...("diagnostic" in error
        ? { diagnostic: error.diagnostic as Diagnostic }
        : {}),
    };
  }
  return { message: error == null ? "" : String(error) };
}

export function errorText(error: unknown): string {
  const { diagnostic, message: fallback } = errorDetails(error);
  return diagnostic ? localize(diagnostic, getLocale()) : fallback;
}
