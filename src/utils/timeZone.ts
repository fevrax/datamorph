import { t } from "@/i18n";
export const LOCAL_TIME_ZONE = "local";

export const COMMON_TIME_ZONES: Record<string, string> = {
  get UTC() {
    return t("协调世界时");
  },
  get "Asia/Shanghai"() {
    return t("北京 / 上海");
  },
  get "Asia/Hong_Kong"() {
    return t("香港");
  },
  get "Asia/Taipei"() {
    return t("台北");
  },
  get "Asia/Tokyo"() {
    return t("东京");
  },
  get "Asia/Seoul"() {
    return t("首尔");
  },
  get "Asia/Singapore"() {
    return t("新加坡");
  },
  get "Asia/Kolkata"() {
    return t("印度");
  },
  get "Asia/Dubai"() {
    return t("迪拜");
  },
  get "Europe/London"() {
    return t("伦敦");
  },
  get "Europe/Paris"() {
    return t("巴黎");
  },
  get "Europe/Berlin"() {
    return t("柏林");
  },
  get "America/New_York"() {
    return t("纽约");
  },
  get "America/Chicago"() {
    return t("芝加哥");
  },
  get "America/Denver"() {
    return t("丹佛");
  },
  get "America/Los_Angeles"() {
    return t("洛杉矶");
  },
  get "America/Sao_Paulo"() {
    return t("圣保罗");
  },
  get "Australia/Sydney"() {
    return t("悉尼");
  },
  get "Pacific/Auckland"() {
    return t("奥克兰");
  },
};

export function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Keep the local preference dynamic instead of saving the device's current zone. */
export function normalizeTimeZone(value: unknown): string {
  if (typeof value !== "string" || value === LOCAL_TIME_ZONE)
    return LOCAL_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    return LOCAL_TIME_ZONE;
  }
}

export function resolveTimeZone(value = LOCAL_TIME_ZONE): string {
  const normalized = normalizeTimeZone(value);
  return normalized === LOCAL_TIME_ZONE ? getLocalTimeZone() : normalized;
}

export function getTimeZoneLabel(value: string): string {
  if (value === LOCAL_TIME_ZONE) return t("跟随本地时区");
  return COMMON_TIME_ZONES[value] || value.replace(/_/g, " ");
}

export function getTimeZones(): string[] {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  };
  return Array.from(
    new Set([
      ...Object.keys(COMMON_TIME_ZONES),
      getLocalTimeZone(),
      ...(intl.supportedValuesOf?.("timeZone") || []),
    ]),
  );
}

// Reuse formatters while scanning hundreds of visible tokens.
let cachedZone = "";
let cachedFormatter: Intl.DateTimeFormat;

export function formatTimestamp(
  timestamp: string,
  timeZone = LOCAL_TIME_ZONE,
): string {
  const value = Number(timestamp);
  const date = new Date(timestamp.length === 10 ? value * 1000 : value);
  if (!Number.isFinite(date.getTime())) return timestamp;
  // Avoid validating the same explicit zone once per token.
  const zone = timeZone === LOCAL_TIME_ZONE ? getLocalTimeZone() : timeZone;
  if (!cachedFormatter || zone !== cachedZone) {
    cachedFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: resolveTimeZone(zone),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    cachedZone = zone;
  }
  const parts = Object.fromEntries(
    cachedFormatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export const OPEN_TIME_ZONE_EVENT = "datamorph:select-time-zone";
