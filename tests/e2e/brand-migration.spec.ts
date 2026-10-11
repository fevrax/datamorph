import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
test.use({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL });
const content = "name: Ada\nactive: true";

async function seed(page: Page, version: "legacy" | "v2", existing = false) {
  // A same-origin static document lets us seed storage before the app starts.
  await page.goto("/favicon.png");
  await page.evaluate(
    async ({ version, content, existing }) => {
      async function create(name: string, stores: string[]) {
        return new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(name, 1);
          request.onupgradeneeded = () => {
            stores.forEach((s) => request.result.createObjectStore(s));
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }
      async function put(
        db: IDBDatabase,
        store: string,
        values: [string, unknown][],
      ) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(store, "readwrite");
          values.forEach(([k, v]) => tx.objectStore(store).put(v, k));
          tx.oncomplete = () => resolve();
          tx.onabort = () => reject(tx.error);
        });
      }
      const db = await create("json-tools", [
        "store",
        "workspace_v2",
        "wal",
        "locks",
      ]);
      const tab = {
        kind: "json",
        key: "old-doc",
        uuid: "old-doc",
        title: "source.yaml",
        content,
        revision: 3,
        view: "code",
        closable: true,
        updatedAt: Date.now(),
        toolState: {},
        editorSettings: { language: "json", fontSize: 16, indentSize: 2 },
        history: [
          {
            key: "old-history",
            content: "name: previous",
            title: "source.yaml",
            revision: 1,
            timestamp: Date.now() - 1000,
          },
        ],
      };
      await put(db, "store", [
        [
          "settings",
          {
            data: {
              defaultIndentSize: 2,
              fontSize: "large",
              persistentDataEnabled: true,
            },
          },
        ],
        ["openai-config", { sentinel: "keep-ai-config" }],
      ]);
      await put(db, "locks", [["stale-lock", { owner: "old-window" }]]);
      if (version === "legacy")
        await put(db, "store", [["tabs", { data: [tab] }]]);
      else
        await put(db, "workspace_v2", [
          ["schema", 2],
          ["workspace", { activeTabKey: "old-doc", order: ["old-doc"] }],
          [
            "document:old-doc",
            { key: tab.key, content, revision: tab.revision },
          ],
          [
            "metadata:old-doc",
            { ...tab, content: undefined, history: undefined },
          ],
          ["history:old-doc", tab.history],
        ]);
      db.close();
      if (existing) {
        const target = await create("datamorph", [
          "store",
          "workspace_v2",
          "wal",
        ]);
        await put(target, "store", [
          [
            "settings",
            { data: { defaultIndentSize: 8, persistentDataEnabled: true } },
          ],
        ]);
        await put(target, "workspace_v2", [
          ["schema", 2],
          ["workspace", { activeTabKey: "new-doc", order: ["new-doc"] }],
          [
            "document:new-doc",
            {
              ...tab,
              key: "new-doc",
              uuid: "new-doc",
              title: "new.json",
              content: '{"fresh":true}',
              history: [],
            },
          ],
        ]);
        target.close();
      }
    },
    { version, content, existing },
  );
}
async function state(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    const settingsPath = "/src/store/useSettingsStore.ts";
    const { useSettingsStore } = await import(settingsPath);
    return {
      tab: useTabStore.getState().activeTab(),
      count: useTabStore.getState().tabs.length,
      indent: useSettingsStore.getState().defaultIndentSize,
    };
  });
}
for (const version of ["legacy", "v2"] as const) {
  test(`migrates ${version} documents, settings and history, and does not import locks`, async ({
    page,
  }) => {
    await seed(page, version);
    await page.goto("/");
    await expect(page.locator(".monaco-editor").first()).toBeVisible();
    await expect
      .poll(async () => (await state(page)).tab.editorSettings.language)
      .toBe("yaml");
    const migrated = await state(page);
    expect(migrated.tab.kind).toBe("document");
    expect(migrated.tab.content).toBe(content);
    expect(migrated.tab.history[0].key).toBe("old-history");
    expect(migrated.tab.editorSettings.fontSize).toBe(16);
    expect(migrated.indent).toBe(2);
    await page.reload();
    await expect(page.locator(".monaco-editor").first()).toBeVisible();
    expect((await state(page)).count).toBe(1);
    const storage = await page.evaluate(async () => {
      return new Promise<{
        locks: unknown[];
        marker: unknown;
        ai: unknown;
        oldExists: boolean;
      }>((resolve, reject) => {
        const request = indexedDB.open("datamorph");
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(
            ["locks", "store", "migrations"],
            "readonly",
          );
          const locks = tx.objectStore("locks").getAll();
          const marker = tx.objectStore("migrations").get("json-tools-v1");
          const ai = tx.objectStore("store").get("openai-config");
          tx.oncomplete = async () => {
            db.close();
            resolve({
              locks: locks.result,
              marker: marker.result,
              ai: ai.result,
              oldExists: (await indexedDB.databases()).some(
                (d) => d.name === "json-tools",
              ),
            });
          };
          tx.onabort = () => reject(tx.error);
        };
      });
    });
    expect(storage.locks).toEqual([]);
    expect(storage.marker).toBeTruthy();
    expect(storage.ai).toEqual({ sentinel: "keep-ai-config" });
    expect(storage.oldExists).toBe(true);
  });
}
test("existing datamorph documents and settings win over the old database", async ({
  page,
}) => {
  await seed(page, "v2", true);
  await page.goto("/");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  const current = await state(page);
  expect(current.tab.key).toBe("new-doc");
  expect(current.tab.content).toBe('{"fresh":true}');
  expect(current.count).toBe(1);
  expect(current.indent).toBe(8);
});
test("clearing data keeps the migration marker and cannot resurrect old documents", async ({
  page,
}) => {
  await seed(page, "v2");
  await page.goto("/");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await page.evaluate(async () => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    await useTabStore.getState().clearUserData();
  });
  await page.reload();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  const current = await state(page);
  expect(current.tab.content).toBe("");
  expect(current.tab.key).not.toBe("old-doc");
});
test("two windows starting together import one complete workspace", async ({
  page,
  context,
}) => {
  await seed(page, "v2");
  const second = await context.newPage();
  await Promise.all([page.goto("/"), second.goto("/")]);
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await expect(second.locator(".monaco-editor").first()).toBeVisible();
  expect((await state(page)).tab.content).toBe(content);
  expect((await state(second)).tab.content).toBe(content);
  expect((await state(page)).count).toBe(1);
  await second.close();
});

test("an interrupted import rolls back its marker and can be retried", async ({
  page,
}) => {
  await seed(page, "v2");
  const result = await page.evaluate(async () => {
    const path = "/src/lib/storage/brandMigration.ts";
    const { ensureBrandMigration } = await import(path);
    const put = IDBObjectStore.prototype.put;
    let interrupted = false;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === "workspace_v2" && key === "document:old-doc") {
        interrupted = true;
        this.transaction.abort();
      }
      return put.call(this, value, key);
    };
    let failed = false;
    try {
      await ensureBrandMigration();
    } catch {
      failed = true;
    } finally {
      IDBObjectStore.prototype.put = put;
    }
    await ensureBrandMigration();
    return { interrupted, failed };
  });
  expect(result).toEqual({ interrupted: true, failed: true });
  await page.goto("/");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  expect((await state(page)).tab.content).toBe(content);
});

test("copied WAL is recovered before settings hydrate, leaving old storage untouched", async ({
  page,
}) => {
  await seed(page, "v2");
  const operations = [
    {
      type: "set",
      key: "settings",
      value: { data: { defaultIndentSize: 6, persistentDataEnabled: true } },
    },
  ];
  const checksum = createHash("sha256")
    .update(JSON.stringify(operations))
    .digest("hex");
  await page.evaluate(
    async ({ operations, checksum }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("json-tools");
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("wal", "readwrite");
          tx.objectStore("wal").put(
            {
              transactionId: "pending",
              timestamp: Date.now(),
              operations,
              checksum,
            },
            "wal_pending",
          );
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => reject(tx.error);
        };
      });
    },
    { operations, checksum },
  );
  await page.goto("/");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  expect((await state(page)).indent).toBe(6);
  expect((await state(page)).tab.content).toBe(content);
});
