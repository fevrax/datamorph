import type { EncodingType, EncodingOptions } from "@/utils/encodingConverter";
import type { NamingFormat } from "@/utils/keyNamingConverter";
import { create } from "zustand";
import localforage from "localforage";
import { useSettingsStore } from "./useSettingsStore";
import type { Tool } from "./useToolboxStore";
import {
  retainHistory,
  snapshotBytes,
  HISTORY_BYTE_BUDGET,
  type DocumentSnapshot,
} from "./documentHistory";
import { generateUUID } from "@/utils/uuid";
export interface TextChange {
  rangeOffset: number;
  rangeLength: number;
  text: string;
}
export type TabHistoryItem = DocumentSnapshot;
export type DocumentView = "code" | "tree" | "table" | "diff";
export type ToolId =
  | "jsonPath"
  | "jsonAIRepair"
  | "jsonTypeConverter"
  | "dataFormatConverter"
  | "jwtParse"
  | "jsonKeyNaming"
  | "encodingConverter";
export type ToolStateValue =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | unknown[];
export interface ToolStateById {
  jsonPath: { inputValue: string };
  jsonAIRepair: { originalValue: string; fixedValue: string };
  jsonTypeConverter: {
    inputValue: string;
    outputValue: string;
    targetLanguage: string;
  };
  dataFormatConverter: {
    inputValue: string;
    outputValue: string;
    inputFormat: string;
    outputFormat: string;
  };
  jwtParse: {
    jwtToken: string;
    headerJson: string;
    payloadJson: string;
    encodeHeaderJson: string;
    encodePayloadJson: string;
    secret: string;
    isTokenValid: boolean | null;
    validationMessage: string;
    selectedAlgorithm: string;
  };
  jsonKeyNaming: {
    inputValue: string;
    outputValue: string;
    activeFormat: NamingFormat | null;
  };
  encodingConverter: {
    encodingType: EncodingType;
    options: EncodingOptions;
    plainText: string;
    encodedText: string;
  };
}

export interface EditorSettings {
  fontSize: number;
  language: string;
  indentSize: number;
  timestampDecoratorsEnabled?: boolean;
  base64DecoratorsEnabled?: boolean;
  unicodeDecoratorsEnabled?: boolean;
  urlDecoratorsEnabled?: boolean;
  imageDecoratorsEnabled?: boolean;
}
interface TabBase {
  key: string;
  uuid: string;
  title: string;
  content: string;
  byteLength: number;
  revision: number;
  diffModifiedValue?: string;
  diffRevision?: number;
  view: DocumentView;
  closable: boolean;
  history: TabHistoryItem[];
  editorSettings: EditorSettings;
  extraData?: Record<string, unknown>;
  updatedAt: number;
  toolState: Record<string, ToolStateValue>;
  source?: { key: string; revision: number; title: string };
}
export type TabItem = TabBase &
  ({ kind: "json" } | { kind: "toolbox" } | { kind: "tool"; toolId: ToolId });
export type TabKind = TabItem["kind"];
interface TabStore {
  tabs: TabItem[];
  activeTabKey: string;
  nextKey: number;
  hydrated: boolean;
  saveStatus: "saved" | "saving" | "error";
  storageError: string | null;
  activeTab: () => TabItem;
  getTabByKey: (key: string) => TabItem | undefined;
  initTab: () => void;
  addTab: (
    title?: string,
    content?: string,
    extraData?: Record<string, unknown>,
  ) => void;
  openToolboxTab: () => string;
  addToolTab: (tool: Tool) => string;
  setTabContent: (key: string, content: string) => void;
  updateTabContent: (
    key: string,
    content: string,
    changes?: readonly TextChange[],
  ) => void;
  setTabModifiedValue: (key: string, content: string) => void;
  setView: (key: string, view: DocumentView) => void;
  setToolState: (key: string, name: string, value: ToolStateValue) => void;
  syncTabStore: () => Promise<void>;
  closeTab: (key: string) => void;
  setActiveTab: (key: string) => void;
  renameTab: (key: string, title: string) => void;
  closeOtherTabs: (key: string) => string[];
  closeLeftTabs: (key: string) => string[];
  closeRightTabs: (key: string) => string[];
  closeAllTabs: () => string[];
  updateEditorSettings: (
    key: string,
    settings: Partial<EditorSettings>,
  ) => void;
  addTabHistory: (key: string) => void;
  restoreTabHistory: (key: string, historyKey: string) => void;
  deleteTabHistory: (key: string, historyKey: string) => void;
  clearTabHistory: (key: string) => void;
  clearUserData: () => Promise<void>;
}
const db = localforage.createInstance({
  name: "json-tools",
  storeName: "workspace_v2",
});
const legacy = localforage.createInstance({
  name: "json-tools",
  storeName: "store",
});
const windowId = generateUUID();
const channel =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("json-tools-workspace-v2")
    : null;
let hydration: Promise<void> | undefined;
let remote = false;
let resetting = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let writing: Promise<void> = Promise.resolve();
const dirty = new Set<string>();
const removed = new Set<string>();
const saved = new Map<string, TabItem>();
const pendingBroadcasts = new Map<
  string,
  { tab: TabItem; baseRevision: number }
>();
let broadcastTimer: ReturnType<typeof setTimeout> | undefined;
function flushBroadcasts() {
  clearTimeout(broadcastTimer);
  if (useSettingsStore.getState().persistentDataEnabled)
    for (const { tab, baseRevision } of pendingBroadcasts.values())
      channel?.postMessage({
        windowId,
        type: "update",
        tab: { ...tab, history: undefined },
        baseRevision,
      });
  pendingBroadcasts.clear();
}
function queueBroadcast(tab: TabItem, baseRevision: number) {
  pendingBroadcasts.set(tab.key, {
    tab,
    baseRevision: pendingBroadcasts.get(tab.key)?.baseRevision ?? baseRevision,
  });
  clearTimeout(broadcastTimer);
  broadcastTimer = setTimeout(flushBroadcasts, 250);
}
const historyTimers = new Map<string, ReturnType<typeof setTimeout>>();
function makeTab(
  title?: string,
  content = "",
  extraData?: Record<string, unknown>,
): TabItem {
  const id = generateUUID();
  return {
    kind: "json",
    key: id,
    uuid: id,
    title: title || "未命名.json",
    content,
    byteLength: new TextEncoder().encode(content).byteLength,
    revision: 1,
    view: "code",
    closable: true,
    history: [],
    toolState: {},
    updatedAt: Date.now(),
    extraData,
    editorSettings: {
      fontSize: 14,
      language: "json",
      indentSize: useSettingsStore.getState().defaultIndentSize,
      timestampDecoratorsEnabled: true,
      base64DecoratorsEnabled: true,
      unicodeDecoratorsEnabled: true,
      urlDecoratorsEnabled: true,
      imageDecoratorsEnabled: true,
    },
  };
}
function patch(key: string, update: (tab: TabItem) => TabItem) {
  useTabStore.setState((s) => {
    const current = s.tabs.find((t) => t.key === key);
    if (!current) return s;
    const next = update(current);
    return next === current
      ? s
      : { tabs: s.tabs.map((t) => (t.key === key ? next : t)) };
  });
}
function recordHistory(key: string) {
  const tab = useTabStore.getState().getTabByKey(key);
  if (!tab || tab.kind !== "json" || tab.history[0]?.content === tab.content)
    return;
  const snapshot = {
    key: generateUUID(),
    timestamp: Date.now(),
    title: tab.title,
    content: tab.content,
    revision: tab.revision,
    monacoVersion: tab.revision,
  };
  patch(key, (t) => ({
    ...t,
    history: retainHistory([snapshot, ...t.history]),
  }));
  const snapshots = useTabStore
    .getState()
    .tabs.flatMap((t) => t.history)
    .sort((a, b) => b.timestamp - a.timestamp);
  let bytes = 0;
  const keep = new Set<string>();
  for (const h of snapshots) {
    const size = snapshotBytes(h);
    if (bytes + size <= HISTORY_BYTE_BUDGET) {
      keep.add(h.key);
      bytes += size;
    }
  }
  useTabStore.setState((s) => ({
    tabs: s.tabs.map((t) =>
      t.history.some((h) => !keep.has(h.key))
        ? { ...t, history: t.history.filter((h) => keep.has(h.key)) }
        : t,
    ),
  }));
}
function updateContent(
  key: string,
  content: string,
  changes?: readonly TextChange[],
) {
  const tab = useTabStore.getState().getTabByKey(key);
  if (!tab || tab.content === content) return;
  const encoder = new TextEncoder();
  // Partial surrogate edits can change UTF-8 width across the edit boundary.
  const touchesSurrogate = changes?.some((change) =>
    /[\uD800-\uDFFF]/.test(
      change.text.slice(0, 1) +
        change.text.slice(-1) +
        tab.content.slice(
          Math.max(0, change.rangeOffset - 1),
          change.rangeOffset + 1,
        ) +
        tab.content.slice(
          Math.max(0, change.rangeOffset + change.rangeLength - 1),
          change.rangeOffset + change.rangeLength + 1,
        ),
    ),
  );
  const byteLength =
    changes && !touchesSurrogate && tab.byteLength !== undefined
      ? tab.byteLength +
        changes.reduce(
          (delta, change) =>
            delta +
            encoder.encode(change.text).byteLength -
            encoder.encode(
              tab.content.slice(
                change.rangeOffset,
                change.rangeOffset + change.rangeLength,
              ),
            ).byteLength,
          0,
        )
      : encoder.encode(content).byteLength;
  if (!historyTimers.has(key)) recordHistory(key);
  patch(key, (t) => ({
    ...t,
    content,
    byteLength,
    revision: t.revision + 1,
    updatedAt: Date.now(),
  }));
  clearTimeout(historyTimers.get(key));
  historyTimers.set(
    key,
    setTimeout(() => {
      historyTimers.delete(key);
      recordHistory(key);
    }, 1000),
  );
}
function closeKeys(keys: string[]) {
  const store = useTabStore.getState();
  for (const key of keys) {
    clearTimeout(historyTimers.get(key));
    historyTimers.delete(key);
    if (typeof window !== "undefined")
      window.dispatchEvent(
        new CustomEvent("json-tools:close-model", { detail: key }),
      );
  }
  let tabs = store.tabs.filter((t) => !keys.includes(t.key));
  if (!tabs.length) tabs = [makeTab()];
  const index = store.tabs.findIndex((t) => t.key === store.activeTabKey);
  useTabStore.setState({
    tabs,
    activeTabKey: tabs.some((t) => t.key === store.activeTabKey)
      ? store.activeTabKey
      : tabs[Math.max(0, Math.min(index, tabs.length - 1))].key,
  });
  return keys;
}
function unwrap<T>(value: unknown): T | null {
  return value && typeof value === "object" && "data" in value
    ? (value as { data: T }).data
    : (value as T | null);
}
function normalize(
  raw: Partial<TabItem> & {
    monacoVersion?: number;
    vanilla?: { text?: string };
    vanillaVersion?: number;
  },
): TabItem {
  const tab = makeTab(
    raw.title,
    (raw.vanillaVersion || 0) > (raw.monacoVersion || 0)
      ? (raw.vanilla?.text ?? raw.content ?? "")
      : (raw.content ?? raw.vanilla?.text ?? ""),
    raw.extraData,
  );
  const kind =
    raw.kind === "tool" || raw.kind === "toolbox" ? raw.kind : "json";
  return {
    ...tab,
    kind,
    diffModifiedValue: raw.diffModifiedValue,
    diffRevision: raw.diffRevision,
    source: raw.source,
    updatedAt: raw.updatedAt || Date.now(),
    key: raw.key || tab.key,
    uuid: raw.uuid || tab.uuid,
    revision: raw.revision || raw.monacoVersion || 1,
    view: raw.view || "code",
    toolState: raw.toolState || {},
    editorSettings: { ...tab.editorSettings, ...raw.editorSettings },
    history: retainHistory(
      (raw.history || [])
        .filter(
          (h) =>
            typeof h.content === "string" &&
            !(h as TabHistoryItem & { truncated?: boolean }).truncated,
        )
        .map((h) => ({ ...h, revision: h.revision || h.monacoVersion || 1 })),
    ),
    ...(kind === "tool"
      ? {
          toolId: (raw.extraData?.toolId ||
            ("toolId" in raw ? raw.toolId : undefined)) as ToolId,
        }
      : {}),
  } as TabItem;
}
export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [],
  activeTabKey: "",
  nextKey: 1,
  hydrated: false,
  saveStatus: "saved",
  storageError: null,
  activeTab: () => get().getTabByKey(get().activeTabKey) || get().tabs[0],
  getTabByKey: (key) => get().tabs.find((t) => t.key === key),
  initTab: () => {
    const tab = makeTab();
    set({ tabs: [tab], activeTabKey: tab.key, nextKey: 2 });
  },
  addTab: (title, content, extraData) => {
    const tab = makeTab(title, content, extraData);
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabKey: tab.key,
      nextKey: s.nextKey + 1,
    }));
  },
  openToolboxTab: () => {
    const source = get().activeTab();
    const existing = get().tabs.find((t) => t.kind === "toolbox");
    if (existing) {
      if (source?.kind === "json")
        patch(existing.key, (t) => ({
          ...t,
          source: {
            key: source.key,
            revision: source.revision,
            title: source.title,
          },
          content: source.content,
        }));
      set({ activeTabKey: existing.key });
      return existing.key;
    }
    const tab = {
      ...makeTab("工具箱"),
      kind: "toolbox" as const,
      ...(source?.kind === "json"
        ? {
            source: {
              key: source.key,
              revision: source.revision,
              title: source.title,
            },
            content: source.content,
          }
        : {}),
    };
    set((s) => ({ tabs: [...s.tabs, tab], activeTabKey: tab.key }));
    return tab.key;
  },
  addToolTab: (tool) => {
    const active = get().activeTab();
    const current =
      active?.kind === "toolbox"
        ? get().getTabByKey(active.source?.key || "")
        : active;
    const source =
      current?.kind === "json"
        ? { key: current.key, revision: current.revision, title: current.title }
        : undefined;
    const tab: TabItem = {
      ...makeTab(tool.name, current?.kind === "json" ? current.content : ""),
      kind: "tool",
      toolId: tool.id as ToolId,
      source,
      extraData: { toolId: tool.id, toolIcon: tool.icon, toolPath: tool.path },
    };
    set((s) => ({ tabs: [...s.tabs, tab], activeTabKey: tab.key }));
    return tab.key;
  },
  setTabContent: updateContent,
  updateTabContent: updateContent,
  setTabModifiedValue: (key, content) =>
    patch(key, (t) =>
      t.diffModifiedValue === content
        ? t
        : {
            ...t,
            diffModifiedValue: content,
            diffRevision: (t.diffRevision || 0) + 1,
            updatedAt: Date.now(),
          },
    ),
  setView: (key, view) =>
    patch(key, (t) => (t.view === view ? t : { ...t, view })),
  setToolState: (key, name, value) =>
    patch(key, (t) =>
      Object.is(t.toolState[name], value)
        ? t
        : { ...t, toolState: { ...t.toolState, [name]: value } },
    ),
  setActiveTab: (key) => {
    if (get().getTabByKey(key)) set({ activeTabKey: key });
  },
  renameTab: (key, title) => {
    if (title.trim()) patch(key, (t) => ({ ...t, title: title.trim() }));
  },
  closeTab: (key) => {
    closeKeys([key]);
  },
  closeAllTabs: () => closeKeys(get().tabs.map((t) => t.key)),
  closeOtherTabs: (key) =>
    closeKeys(
      get()
        .tabs.filter((t) => t.key !== key)
        .map((t) => t.key),
    ),
  closeLeftTabs: (key) =>
    closeKeys(
      get()
        .tabs.slice(
          0,
          get().tabs.findIndex((t) => t.key === key),
        )
        .map((t) => t.key),
    ),
  closeRightTabs: (key) =>
    closeKeys(
      get()
        .tabs.slice(get().tabs.findIndex((t) => t.key === key) + 1)
        .map((t) => t.key),
    ),
  updateEditorSettings: (key, settings) =>
    patch(key, (t) =>
      Object.entries(settings).every(
        ([k, v]) => t.editorSettings[k as keyof EditorSettings] === v,
      )
        ? t
        : { ...t, editorSettings: { ...t.editorSettings, ...settings } },
    ),
  addTabHistory: recordHistory,
  restoreTabHistory: (key, id) => {
    const h = get()
      .getTabByKey(key)
      ?.history.find((h) => h.key === id);
    if (h && h.content !== get().getTabByKey(key)?.content) {
      // A restore can happen before the pending edit snapshot is saved.
      recordHistory(key);
      updateContent(key, h.content);
    }
  },
  deleteTabHistory: (key, id) =>
    patch(key, (t) => ({
      ...t,
      history: t.history.filter((h) => h.key !== id),
    })),
  clearTabHistory: (key) => {
    clearTimeout(historyTimers.get(key));
    historyTimers.delete(key);
    patch(key, (t) => ({ ...t, history: [] }));
  },
  clearUserData: async () => {
    resetting = true;
    clearTimeout(broadcastTimer);
    pendingBroadcasts.clear();
    try {
      clearTimeout(timer);
      historyTimers.forEach(clearTimeout);
      historyTimers.clear();
      await writing;
      for (const tab of get().tabs)
        if (typeof window !== "undefined")
          window.dispatchEvent(
            new CustomEvent("json-tools:close-model", { detail: tab.key }),
          );
      await db.clear();
      saved.clear();
      await Promise.all(
        ["tabs", "tabs_active_key", "tabs_next_key"].map((k) =>
          legacy.removeItem(k),
        ),
      );
      dirty.clear();
      removed.clear();
      get().initTab();
    } finally {
      resetting = false;
    }
    dirty.add(get().activeTabKey);
    await flushTabStore();
  },
  syncTabStore: () => {
    if (hydration) return hydration;
    hydration = (async () => {
      try {
        await useSettingsStore.getState().syncSettingsStore();
      } catch (error) {
        console.error("Settings restore failed", error);
      }
      if (!useSettingsStore.getState().persistentDataEnabled) {
        get().initTab();
        set({ hydrated: true });
        return;
      }
      try {
        let tabs: TabItem[] = [];
        const keys = await db.keys();
        for (const key of keys.filter((k) => k.startsWith("document:"))) {
          const document = await db.getItem<TabItem>(key);
          const metadata =
            document &&
            (await db.getItem<Partial<TabItem>>("metadata:" + document.key));
          const raw = document && { ...document, ...metadata };
          if (raw) {
            const history = await db.getItem<TabHistoryItem[]>(
              "history:" + raw.key,
            );
            tabs.push(normalize({ ...raw, history: history || [] }));
          }
        }
        const meta = await db.getItem<{
          activeTabKey: string;
          order: string[];
        }>("workspace");
        if (!keys.includes("schema")) {
          const old = unwrap<TabItem[]>(await legacy.getItem("tabs"));
          if (old?.length) tabs = old.map(normalize);
          if (tabs.length) {
            for (const t of tabs) {
              const { history, ...document } = t;
              await db.setItem("document:" + t.key, document);
              await db.setItem("history:" + t.key, history);
            }
          }
          await db.setItem("schema", 2);
        }
        if (!tabs.length) tabs = [makeTab()];
        if (meta?.order)
          tabs.sort(
            (a, b) => meta.order.indexOf(a.key) - meta.order.indexOf(b.key),
          );
        set({
          tabs,
          activeTabKey: tabs.some((t) => t.key === meta?.activeTabKey)
            ? meta!.activeTabKey
            : tabs[0].key,
          hydrated: true,
        });
        for (const tab of tabs) dirty.add(tab.key);
        await flushTabStore();
      } catch (error) {
        if (!get().tabs.length) get().initTab();
        set({
          hydrated: true,
          saveStatus: "error",
          storageError: "无法恢复本地数据，旧数据已保留。" + String(error),
        });
      }
    })();
    return hydration;
  },
}));
export async function flushTabStore(): Promise<void> {
  flushBroadcasts();
  clearTimeout(timer);
  if (!useSettingsStore.getState().persistentDataEnabled || resetting) return;
  const state = useTabStore.getState();
  const keys = [...dirty];
  const deletes = [...removed];
  dirty.clear();
  removed.clear();
  const tabs = keys
    .map((key) => state.getTabByKey(key))
    .filter((t): t is TabItem => !!t);
  const meta = {
    activeTabKey: state.activeTabKey,
    order: state.tabs.map((t) => t.key),
  };
  useTabStore.setState({ saveStatus: "saving" });
  writing = writing.then(async () => {
    try {
      for (const tab of tabs) {
        const previous = saved.get(tab.key);
        const { history, content, revision, updatedAt, ...metadata } = tab;
        if (
          !previous ||
          previous.content !== content ||
          previous.revision !== revision
        )
          await db.setItem("document:" + tab.key, {
            key: tab.key,
            content,
            revision,
            updatedAt,
          });
        if (!previous || previous.history !== history)
          await db.setItem("history:" + tab.key, history);
        await db.setItem("metadata:" + tab.key, metadata);
        saved.set(tab.key, tab);
      }
      for (const key of deletes) {
        await db.removeItem("document:" + key);
        await db.removeItem("history:" + key);
        await db.removeItem("metadata:" + key);
        saved.delete(key);
      }
      await db.setItem("workspace", meta);
      useTabStore.setState({
        saveStatus: dirty.size ? "saving" : "saved",
        storageError: null,
      });
    } catch (error) {
      keys.forEach((k) => dirty.add(k));
      deletes.forEach((k) => removed.add(k));
      useTabStore.setState({
        saveStatus: "error",
        storageError: String(error),
      });
    }
  });
  await writing;
}
useTabStore.subscribe((state, previous) => {
  if (resetting) return;
  let changed = false;
  for (const tab of state.tabs) {
    const old = previous.tabs.find((t) => t.key === tab.key);
    if (old !== tab) {
      dirty.add(tab.key);
      changed = true;
      if (
        !remote &&
        state.hydrated &&
        useSettingsStore.getState().persistentDataEnabled
      )
        queueBroadcast(tab, old?.revision || 0);
    }
  }
  for (const old of previous.tabs) {
    if (!state.tabs.some((t) => t.key === old.key)) {
      pendingBroadcasts.delete(old.key);
      removed.add(old.key);
      changed = true;
      if (
        !remote &&
        state.hydrated &&
        useSettingsStore.getState().persistentDataEnabled
      )
        channel?.postMessage({ windowId, type: "close", key: old.key });
    }
  }
  if (
    (changed || state.activeTabKey !== previous.activeTabKey) &&
    state.hydrated
  ) {
    clearTimeout(timer);
    timer = setTimeout(() => void flushTabStore(), 600);
  }
});
if (channel)
  channel.onmessage = (event) => {
    const message = event.data;
    if (
      message.windowId === windowId ||
      !useSettingsStore.getState().persistentDataEnabled
    )
      return;
    remote = true;
    try {
      if (message.type === "update") {
        const incoming = normalize(message.tab);
        const state = useTabStore.getState();
        const current = state.getTabByKey(incoming.key);
        if (
          current &&
          current.revision !== message.baseRevision &&
          current.content !== incoming.content
        ) {
          const conflict = {
            ...incoming,
            key: generateUUID(),
            uuid: generateUUID(),
            title: incoming.title + " · 冲突副本",
          };
          useTabStore.setState({ tabs: [...state.tabs, conflict] });
        } else if (!current)
          useTabStore.setState({ tabs: [...state.tabs, incoming] });
        else
          patch(current.key, () => ({ ...incoming, history: current.history }));
      } else if (message.type === "close") closeKeys([message.key]);
    } finally {
      remote = false;
    }
  };
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => void flushTabStore());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushTabStore();
  });
}

useSettingsStore.subscribe((state, previous) => {
  if (
    state.persistentDataEnabled &&
    !previous.persistentDataEnabled &&
    useTabStore.getState().hydrated
  ) {
    for (const tab of useTabStore.getState().tabs) dirty.add(tab.key);
    void flushTabStore();
  }
});
export async function downloadRecoveryData() {
  const data: Record<string, unknown> = {};
  for (const key of await legacy.keys()) data[key] = await legacy.getItem(key);
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "json-tools-recovery.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
