import assert from "node:assert/strict";
import test from "node:test";

import {
  assignMissingDefaultTabNames,
  formatDefaultTabName,
  isDefaultDocumentName,
  isLegacyUntitledDocumentName,
  nextDefaultTabNumber,
  parseDefaultTabNumber,
} from "../utils/dataFormats";
import {
  AUTO_TAB_NAME_EXCERPT_LENGTH,
  AUTO_TAB_NAME_MAX_LENGTH,
  TabAutoNamingController,
  buildAutoTabNamingMessages,
  isEligibleForAutoTabNaming,
  sanitizeAutoTabTitle,
  type AutoNamingTabSnapshot,
  type AutoTabNamingInput,
} from "./tabAutoNamingCore";

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function makeFakeStore() {
  let hydrated = false;
  let remote = false;
  let nextKey = 1;
  let tabs: AutoNamingTabSnapshot[] = [];
  let activeTabKey = "";
  const listeners = new Set<
    (
      state: { tabs: readonly AutoNamingTabSnapshot[]; hydrated: boolean },
      previous: { tabs: readonly AutoNamingTabSnapshot[]; hydrated: boolean },
    ) => void
  >();

  const emit = (previous: {
    tabs: readonly AutoNamingTabSnapshot[];
    hydrated: boolean;
  }) => {
    const state = { tabs, hydrated };
    for (const listener of listeners) listener(state, previous);
  };

  const makeDoc = (
    key: string,
    title?: string,
    content = "",
  ): AutoNamingTabSnapshot => {
    const explicit = title?.trim() || undefined;
    const assigned =
      explicit ?? formatDefaultTabName(nextDefaultTabNumber(tabs, nextKey));
    if (!explicit) nextKey = (parseDefaultTabNumber(assigned) ?? nextKey) + 1;
    else
      nextKey = nextDefaultTabNumber([...tabs, { title: assigned }], nextKey);
    return {
      key,
      kind: "document",
      title: assigned,
      autoNamed: false,
      content,
      revision: 1,
      editorSettings: {
        language: "json",
        filename: explicit,
      },
    };
  };

  return {
    subscribe(
      listener: (
        state: { tabs: readonly AutoNamingTabSnapshot[]; hydrated: boolean },
        previous: { tabs: readonly AutoNamingTabSnapshot[]; hydrated: boolean },
      ) => void,
    ) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getTab: (key: string) => tabs.find((t) => t.key === key),
    getActiveTab: () => tabs.find((t) => t.key === activeTabKey) ?? tabs[0],
    isHydrated: () => hydrated,
    isRemote: () => remote,
    setHydrated(value: boolean) {
      const previous = { tabs, hydrated };
      hydrated = value;
      emit(previous);
    },
    setRemote(value: boolean) {
      remote = value;
    },
    addTab(key: string, title?: string, content = "") {
      const previous = { tabs, hydrated };
      const tab = makeDoc(key, title, content);
      tabs = [...tabs, tab];
      activeTabKey = tab.key;
      emit(previous);
      return tab;
    },
    updateContent(key: string, content: string) {
      const previous = { tabs, hydrated };
      tabs = tabs.map((t) =>
        t.key === key ? { ...t, content, revision: t.revision + 1 } : t,
      );
      emit(previous);
    },
    renameTab(key: string, title: string) {
      const previous = { tabs, hydrated };
      const trimmed = title.trim();
      tabs = tabs.map((t) =>
        t.key === key
          ? {
              ...t,
              title: trimmed,
              autoNamed: false,
              editorSettings: { ...t.editorSettings, filename: trimmed },
            }
          : t,
      );
      emit(previous);
    },
    closeTab(key: string) {
      const previous = { tabs, hydrated };
      tabs = tabs.filter((t) => t.key !== key);
      emit(previous);
    },
    applyAutoTitle(key: string, title: string, expectedRevision?: number) {
      const trimmed = title.trim();
      if (!trimmed || isDefaultDocumentName(trimmed)) return false;
      const current = tabs.find((t) => t.key === key);
      if (
        !current ||
        current.kind !== "document" ||
        current.editorSettings.filename ||
        current.autoNamed ||
        !isDefaultDocumentName(current.title) ||
        !current.content.trim() ||
        (expectedRevision !== undefined &&
          current.revision !== expectedRevision)
      ) {
        return false;
      }
      const previous = { tabs, hydrated };
      tabs = tabs.map((t) =>
        t.key === key ? { ...t, title: trimmed, autoNamed: true } : t,
      );
      emit(previous);
      return true;
    },
  };
}

test("default tab name helpers recognize New Tab {n}, migrate legacy untitled names, and avoid collisions", () => {
  assert.equal(formatDefaultTabName(1), "New Tab 1");
  assert.equal(formatDefaultTabName(12), "New Tab 12");
  assert.equal(formatDefaultTabName(0), "New Tab 1");
  assert.equal(parseDefaultTabNumber("New Tab 1"), 1);
  assert.equal(parseDefaultTabNumber("  New Tab 42 "), 42);
  assert.equal(parseDefaultTabNumber("New Tab 0"), null);
  assert.equal(parseDefaultTabNumber("New Tab"), null);
  assert.equal(parseDefaultTabNumber("New Tab 1.json"), null);

  for (const name of ["", "未命名", "未命名.json", "Untitled"]) {
    assert.equal(isLegacyUntitledDocumentName(name), true);
    assert.equal(isDefaultDocumentName(name), true);
  }
  assert.equal(isLegacyUntitledDocumentName("New Tab 3"), false);
  assert.equal(isDefaultDocumentName("New Tab 3"), true);
  assert.equal(isDefaultDocumentName("User Profile"), false);

  const migrated = assignMissingDefaultTabNames([
    { kind: "document", title: "未命名", editorSettings: {} },
    { kind: "document", title: "New Tab 2", editorSettings: {} },
    { kind: "document", title: "未命名.json", editorSettings: {} },
    {
      kind: "document",
      title: "未命名",
      editorSettings: { filename: "未命名" },
    },
    {
      kind: "document",
      title: "User Profile",
      autoNamed: true,
      editorSettings: {},
    },
  ]);
  assert.deepEqual(
    migrated.map((item) => item.title),
    ["New Tab 1", "New Tab 2", "New Tab 3", "未命名", "User Profile"],
  );
  assert.equal(nextDefaultTabNumber(migrated, 1), 4);
  assert.equal(nextDefaultTabNumber(migrated, 6), 6);
});

test("sanitizeAutoTabTitle strips reasoning tags, markdown, quotes, prefixes and invalid outputs", () => {
  assert.equal(sanitizeAutoTabTitle("User Profile"), "User Profile");
  assert.equal(sanitizeAutoTabTitle("  用户订单数据  "), "用户订单数据");
  assert.equal(
    sanitizeAutoTabTitle("<think>checking fields...</think>\n用户权限配置"),
    "用户权限配置",
  );
  assert.equal(sanitizeAutoTabTitle("<think>cut off mid thought"), null);
  assert.equal(
    sanitizeAutoTabTitle("```text\nOrder API Response\n```"),
    "Order API Response",
  );
  assert.equal(
    sanitizeAutoTabTitle('Title: "Database Config."'),
    "Database Config",
  );
  assert.equal(sanitizeAutoTabTitle("标签名：《商品列表》"), "商品列表");
  assert.equal(
    sanitizeAutoTabTitle("# **Kubernetes Deployment**"),
    "Kubernetes Deployment",
  );
  assert.equal(sanitizeAutoTabTitle("- `JWT Payload`；"), "JWT Payload");
  assert.equal(sanitizeAutoTabTitle("2026 Sales Report"), "2026 Sales Report");

  for (const rejected of [
    "",
    "   ",
    "NONE",
    "none",
    "N/A",
    "null",
    "Untitled",
    "未命名",
    "New Tab 1",
    "New Tab 42",
    "无标题",
  ]) {
    assert.equal(
      sanitizeAutoTabTitle(rejected),
      null,
      `expected reject: ${rejected}`,
    );
  }

  const longTitle = "🚀".repeat(50);
  const truncated = sanitizeAutoTabTitle(longTitle);
  assert.ok(truncated);
  assert.equal(Array.from(truncated).length, AUTO_TAB_NAME_MAX_LENGTH);
});

test("buildAutoTabNamingMessages bounds excerpt length and passes locale and format hints", () => {
  const longContent = "x".repeat(AUTO_TAB_NAME_EXCERPT_LENGTH + 500);
  const messages = buildAutoTabNamingMessages(longContent, "yaml", "zh-CN");
  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, "system");
  assert.equal(messages[1].role, "user");
  const userText = String(messages[1].content);
  assert.match(userText, /Simplified Chinese \(zh-CN\)/);
  assert.match(userText, /Detected format: yaml/);
  assert.match(userText, /truncated="true"/);
  assert.ok(userText.length < AUTO_TAB_NAME_EXCERPT_LENGTH + 200);
});

test("TabAutoNamingController debounces edits, cancels stale requests, respects toggle and fails silently", async () => {
  const store = makeFakeStore();
  let enabled = false;
  const calls: Array<{ content: string; signal: AbortSignal }> = [];
  const pendingResolvers: Array<(value: string | null) => void> = [];
  let mode: "resolve" | "defer" | "throw" = "resolve";
  let nextResult: string | null = "Order Payload";

  const controller = new TabAutoNamingController({
    debounceMs: 20,
    isEnabled: () => enabled,
    isHydrated: store.isHydrated,
    isRemoteSync: store.isRemote,
    getTab: store.getTab,
    getActiveTab: store.getActiveTab,
    getLocale: () => "zh-CN",
    applyTitle: store.applyAutoTitle,
    generateTitle: async (input: AutoTabNamingInput) => {
      calls.push({ content: input.content, signal: input.signal });
      if (mode === "throw") throw new Error("network unavailable");
      if (mode === "defer") {
        return await new Promise<string | null>((resolve) => {
          pendingResolvers.push(resolve);
        });
      }
      return nextResult;
    },
  });

  const unsubscribe = store.subscribe((state, previous) => {
    controller.handleTabStoreChange(state, previous);
  });

  try {
    // Hydration transition does not blast AI requests even if enabled.
    enabled = true;
    store.addTab("hydrated", undefined, '{"existing":"from-storage"}');
    store.setHydrated(true);
    await wait(45);
    assert.equal(calls.length, 0);
    assert.equal(store.getTab("hydrated")?.title, "New Tab 1");

    // Disabled by default: editing triggers no AI calls.
    enabled = false;
    store.addTab("tab-1");
    store.updateContent("tab-1", '{"orderId":"ORD-1001","status":"paid"}');
    await wait(45);
    assert.equal(calls.length, 0);
    assert.equal(store.getTab("tab-1")?.title, "New Tab 2");

    // Enabling the switch names the already-populated active tab once.
    enabled = true;
    controller.handleSettingsChange(true, false);
    await wait(45);
    assert.equal(calls.length, 1);
    assert.equal(store.getTab("tab-1")?.title, "Order Payload");
    assert.equal(isEligibleForAutoTabNaming(store.getTab("tab-1")), false);

    // Subsequent edits to an already auto-named tab do not re-trigger AI.
    store.updateContent("tab-1", '{"orderId":"ORD-1001","status":"shipped"}');
    await wait(45);
    assert.equal(calls.length, 1);

    // Rapid edits debounce into a single AI call.
    store.addTab("tab-2");
    assert.equal(store.getTab("tab-2")?.title, "New Tab 3");
    nextResult = "User Directory";
    store.updateContent("tab-2", '{"users":[{"id":1}]}');
    await wait(5);
    store.updateContent("tab-2", '{"users":[{"id":1,"name":"Ada"}]}');
    await wait(50);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].content, '{"users":[{"id":1,"name":"Ada"}]}');
    assert.equal(store.getTab("tab-2")?.title, "User Directory");

    // Manual rename while an AI request is in-flight aborts it and wins.
    mode = "defer";
    store.addTab("tab-3");
    store.updateContent("tab-3", 'syntax = "proto3"; message Invoice {}');
    await wait(35);
    assert.equal(calls.length, 3);
    assert.equal(calls[2].signal.aborted, false);
    assert.equal(controller.getNamingTabs().has("tab-3"), true);

    store.renameTab("tab-3", "invoice.proto");
    assert.equal(calls[2].signal.aborted, true);
    assert.equal(controller.getNamingTabs().has("tab-3"), false);
    pendingResolvers.shift()?.("AI Should Lose");
    await wait(10);
    assert.equal(store.getTab("tab-3")?.title, "invoice.proto");

    // Closing a tab aborts its in-flight request.
    store.addTab("tab-close");
    store.updateContent("tab-close", '{"closing":true,"items":[1,2,3]}');
    await wait(35);
    assert.equal(calls.length, 4);
    assert.equal(calls[3].signal.aborted, false);
    store.closeTab("tab-close");
    assert.equal(calls[3].signal.aborted, true);
    pendingResolvers.shift()?.("Closed Tab");

    // Silent failure keeps default title and avoids retrying identical content until config changes.
    mode = "throw";
    store.addTab("tab-4");
    const payload = '{"service":"billing","region":"us-east"}';
    store.updateContent("tab-4", payload);
    await wait(45);
    assert.equal(calls.length, 5);
    assert.equal(store.getTab("tab-4")?.title, "New Tab 6");
    assert.equal(controller.getNamingTabs().size, 0);

    controller.schedule("tab-4");
    await wait(35);
    assert.equal(calls.length, 5);

    mode = "resolve";
    nextResult = "Billing Service";
    controller.handleAIConfigChange();
    controller.schedule("tab-4");
    await wait(45);
    assert.equal(calls.length, 6);
    assert.equal(store.getTab("tab-4")?.title, "Billing Service");

    // Explicitly named tabs and remote sync updates are never auto-named.
    store.addTab(
      "imported",
      "imported.json",
      '{"imported":true,"records":[1,2,3]}',
    );
    store.setRemote(true);
    store.addTab("remote-tab", undefined, '{"remote":true,"count":42}');
    store.setRemote(false);
    await wait(45);
    assert.equal(calls.length, 6);

    // Disabling the setting aborts in-flight requests.
    mode = "defer";
    store.addTab("tab-5");
    store.updateContent("tab-5", '{"metrics":{"cpu":0.42,"mem":0.78}}');
    await wait(35);
    assert.equal(calls.length, 7);
    assert.equal(calls[6].signal.aborted, false);
    enabled = false;
    controller.handleSettingsChange(false, true);
    assert.equal(calls[6].signal.aborted, true);
    pendingResolvers.shift()?.("System Metrics");
    await wait(10);
    assert.equal(store.getTab("tab-5")?.title, "New Tab 8");
  } finally {
    unsubscribe();
    controller.dispose();
  }
});
