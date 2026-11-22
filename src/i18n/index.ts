import { messages } from "./messages";
import { getLocale, type Locale } from "./locale";

export type Message = keyof typeof messages;

type Interpolate<Remaining extends string> =
  Remaining extends `${string}{${infer Index extends number}}${infer Tail}`
    ? Index | Interpolate<Tail>
    : never;

export type StaticMessage = {
  [Key in Message]: Interpolate<Key> extends never ? Key : never;
}[Message];

export type MessageArguments<Key extends Message> = [Interpolate<Key>] extends [
  never,
]
  ? []
  : [values: Record<Interpolate<Key>, unknown>];

export function translate<Key extends Message>(
  locale: Locale,
  key: Key,
  ...args: MessageArguments<Key>
): string {
  return formatMessage(locale, key, args[0]);
}

export function formatMessage(
  locale: Locale,
  key: Message,
  values?: Record<number, unknown>,
): string {
  const text = locale === "en" ? messages[key] : key;
  return values
    ? text.replace(/\{(\d+)\}/g, (_, index) =>
        String(values[Number(index)] ?? ""),
      )
    : text;
}

export function t<Key extends Message>(
  key: Key,
  ...args: MessageArguments<Key>
): string {
  return translate(getLocale(), key, ...args);
}
