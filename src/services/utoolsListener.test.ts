import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  UtoolsEnterController,
  extractUtoolsEditorPayload,
  type UtoolsActiveTabSnapshot,
} from "./utoolsEnterCore";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

interface PluginCmdObject {
  type: string;
  label: string;
  match?: string;
  minLength?: number;
  maxLength?: number;
  exclude?: string;
}

interface PluginManifest {
  features: Array<{
    code: string;
    explain: string;
    cmds: Array<string | PluginCmdObject>;
  }>;
}

function createFakeWorkspace(initialTabs: UtoolsActiveTabSnapshot[]) {
  let hydrated = true;
  let tabs = initialTabs.map((tab) => ({ ...tab }));
  let activeKey = tabs[0]?.key ?? "";
  let nextId = tabs.length + 1;
  let hash = "#/";
  const listeners = new Set<() => void>();

  const target = {
    isHydrated: () => hydrated,
    subscribeHydrated: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getTabCount: () => tabs.length,
    getActiveTab: () => tabs.find((tab) => tab.key === activeKey) ?? tabs[0],
    setView: (key: string, view: "code") => {
      tabs = tabs.map((tab) => (tab.key === key ? { ...tab, view } : tab));
    },
    updateTabContent: (key: string, content: string) => {
      tabs = tabs.map((tab) => (tab.key === key ? { ...tab, content } : tab));
    },
    addTab: (_title: string | undefined, content: string) => {
      const key = `tab-${nextId++}`;
      tabs = [...tabs, { key, kind: "document", content, view: "code" }];
      activeKey = key;
    },
    navigateToEditor: () => {
      if (hash && hash !== "#/") {
        hash = "#/";
      }
    },
  };

  return {
    target,
    getTabs: () => tabs,
    getActiveTab: () => target.getActiveTab(),
    getHash: () => hash,
    setHash: (nextHash: string) => {
      hash = nextHash;
    },
    setHydrated: (value: boolean) => {
      hydrated = value;
      if (value) {
        for (const listener of [...listeners]) {
          listener();
        }
      }
    },
    getListenerCount: () => listeners.size,
  };
}

test("uTools plugin manifests keep <= 5 cmds per feature and include 5+ char arbitrary text match", () => {
  for (const relativePath of ["public/plugin.json", "public/plugin-dev.json"]) {
    const manifest = JSON.parse(
      readFileSync(path.join(rootDir, relativePath), "utf8"),
    ) as PluginManifest;

    assert.ok(
      manifest.features.length > 0,
      `${relativePath} must define features`,
    );

    for (const feature of manifest.features) {
      assert.ok(
        feature.cmds.length > 0 && feature.cmds.length <= 5,
        `${relativePath} feature "${feature.code}" must have 1..5 cmds, got ${feature.cmds.length}`,
      );
    }

    const overCmds = manifest.features
      .flatMap((feature) => feature.cmds)
      .filter(
        (cmd): cmd is PluginCmdObject =>
          typeof cmd === "object" && cmd !== null && cmd.type === "over",
      );

    assert.equal(
      overCmds.length,
      1,
      `${relativePath} should define an over command for arbitrary text`,
    );
    assert.equal(overCmds[0].minLength, 5);
    assert.ok(overCmds[0].label.trim().length > 0);
    assert.equal(overCmds[0].exclude, undefined);
  }
});

test("extractUtoolsEditorPayload accepts over and regex text while ignoring keyword commands", () => {
  assert.equal(
    extractUtoolsEditorPayload({
      code: "datamorph-text",
      type: "over",
      payload: "hello world",
    }),
    "hello world",
  );
  assert.equal(
    extractUtoolsEditorPayload({
      code: "datamorph",
      type: "regex",
      payload: '{"ok":true}',
    }),
    '{"ok":true}',
  );
  assert.equal(
    extractUtoolsEditorPayload({
      code: "datamorph",
      type: "text",
      payload: "datamorph",
    }),
    null,
  );
  assert.equal(
    extractUtoolsEditorPayload({
      code: "datamorph-text",
      type: "over",
      payload: "",
    }),
    null,
  );
  assert.equal(
    extractUtoolsEditorPayload({
      code: "datamorph-text",
      type: "files",
      payload: [{ path: "/tmp/a.json" }],
    }),
    null,
  );
  assert.equal(extractUtoolsEditorPayload(null), null);
});

test("UtoolsEnterController fills empty tab, creates new tab when busy, ignores text cmds, and waits for hydration", () => {
  const workspace = createFakeWorkspace([
    { key: "tab-1", kind: "document", content: "", view: "tree" },
  ]);
  workspace.setHash("#/settings");

  const controller = new UtoolsEnterController(workspace.target);

  // 1. Reuses a single empty document tab and resets view + hash to editor.
  controller.handlePluginEnter({
    code: "datamorph-text",
    type: "over",
    payload: "name: Ada\nrole: admin",
  });

  assert.equal(workspace.getTabs().length, 1);
  assert.equal(workspace.getActiveTab()?.key, "tab-1");
  assert.equal(workspace.getActiveTab()?.content, "name: Ada\nrole: admin");
  assert.equal(workspace.getActiveTab()?.view, "code");
  assert.equal(workspace.getHash(), "#/");

  // 2. Opens a new document tab when existing tab already has content.
  controller.handlePluginEnter({
    code: "datamorph-text",
    type: "over",
    payload: "SELECT * FROM users;",
  });

  assert.equal(workspace.getTabs().length, 2);
  assert.equal(workspace.getActiveTab()?.content, "SELECT * FROM users;");
  assert.equal(workspace.getActiveTab()?.view, "code");

  // 3. Ignores keyword ("text") triggers so command names do not pollute editor content.
  controller.handlePluginEnter({
    code: "datamorph",
    type: "text",
    payload: "datamorph",
  });

  assert.equal(workspace.getTabs().length, 2);
  assert.equal(workspace.getActiveTab()?.content, "SELECT * FROM users;");

  // 4. Queues payload before hydration and applies only the latest once hydrated.
  const coldWorkspace = createFakeWorkspace([
    { key: "tab-1", kind: "document", content: "", view: "code" },
  ]);
  coldWorkspace.setHydrated(false);
  const coldController = new UtoolsEnterController(coldWorkspace.target);

  coldController.handlePluginEnter({
    code: "datamorph-text",
    type: "over",
    payload: "stale payload",
  });
  coldController.handlePluginEnter({
    code: "datamorph-text",
    type: "over",
    payload: "latest payload",
  });

  assert.equal(coldWorkspace.getListenerCount(), 1);
  assert.equal(coldWorkspace.getActiveTab()?.content, "");

  coldWorkspace.setHydrated(true);

  assert.equal(coldWorkspace.getListenerCount(), 0);
  assert.equal(coldWorkspace.getTabs().length, 1);
  assert.equal(coldWorkspace.getActiveTab()?.content, "latest payload");
});
