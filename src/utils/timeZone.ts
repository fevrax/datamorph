export const LOCAL_TIME_ZONE = "local";

export const COMMON_TIME_ZONES: Record<string, string> = {
  UTC: "协调世界时",
  "Asia/Shanghai": "北京 / 上海",
  "Asia/Hong_Kong": "香港",
  "Asia/Taipei": "台北",
  "Asia/Tokyo": "东京",
  "Asia/Seoul": "首尔",
  "Asia/Singapore": "新加坡",
  "Asia/Kolkata": "印度",
  "Asia/Dubai": "迪拜",
  "Europe/London": "伦敦",
  "Europe/Paris": "巴黎",
  "Europe/Berlin": "柏林",
  "America/New_York": "纽约",
  "America/Chicago": "芝加哥",
  "America/Denver": "丹佛",
  "America/Los_Angeles": "洛杉矶",
  "America/Sao_Paulo": "圣保罗",
  "Australia/Sydney": "悉尼",
  "Pacific/Auckland": "奥克兰",
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
  if (value === LOCAL_TIME_ZONE) return "跟随本地时区";
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
