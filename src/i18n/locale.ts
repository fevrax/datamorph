export type Locale = "zh-CN" | "en";

export function normalizeLocale(value: unknown): Locale | undefined {
  return value === "zh-CN" || value === "en" ? value : undefined;
}

export function resolveLocale(
  value: unknown,
  browserLanguage?: string,
): Locale {
  return (
    normalizeLocale(value) ??
    (/^zh(?:-|$)/i.test(browserLanguage ?? "") ? "zh-CN" : "en")
  );
}

export function preferredBrowserLanguage(): string | undefined {
  if (typeof navigator !== "undefined")
    return navigator.languages?.[0] || navigator.language;
}

let activeLocale = resolveLocale(undefined, preferredBrowserLanguage());
const listeners = new Set<() => void>();

export const getLocale = () => activeLocale;

export function setLocalePreference(value: unknown) {
  const next = resolveLocale(value, preferredBrowserLanguage());
  if (activeLocale === next) return;
  activeLocale = next;
  listeners.forEach((listener) => listener());
}

export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
