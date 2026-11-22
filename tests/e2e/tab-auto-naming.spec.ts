import { expect, test, type Page } from "@playwright/test";

test.use({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL });

async function setActiveContent(page: Page, content: string) {
  await page.evaluate(async (text) => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    const state = useTabStore.getState();
    state.updateTabContent(state.activeTabKey, text);
  }, content);
}

test("default tabs use sequential New Tab {n} names, persist across reload, migrate legacy untitled tabs, and reset on close-all", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();

  await expect(
    page.getByRole("tab", { name: "New Tab 1", exact: true }),
  ).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "新建文档", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "New Tab 2", exact: true }),
  ).toHaveAttribute("aria-selected", "true");

  // Imported files keep their filename and do not skip the default sequence.
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "opened.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"opened":true}'),
    });
  await expect(
    page.getByRole("tab", { name: "opened.json", exact: true }),
  ).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "新建文档", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "New Tab 3", exact: true }),
  ).toHaveAttribute("aria-selected", "true");

  // Wait for persistence then reload and confirm numbering continues cleanly.
  await expect(
    page.getByRole("button", { name: "已保存", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();

  await expect(
    page.getByRole("tab", { name: "New Tab 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "New Tab 2", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "opened.json", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "New Tab 3", exact: true }),
  ).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "新建文档", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "New Tab 4", exact: true }),
  ).toHaveAttribute("aria-selected", "true");

  // Closing all tabs via context menu resets to New Tab 1.
  await page
    .getByRole("tab", { name: "New Tab 4", exact: true })
    .click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "关闭全部标签", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "New Tab 1", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tablist").getByRole("tab")).toHaveCount(1);

  // Seed legacy "未命名" tabs in IndexedDB and verify clean migration to New Tab 1 / New Tab 2.
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("datamorph");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("workspace_v2", "readwrite");
        const store = tx.objectStore("workspace_v2");
        store.clear();
        store.put(2, "schema");
        store.put(
          { activeTabKey: "legacy-1", order: ["legacy-1", "legacy-2"] },
          "workspace",
        );
        for (const id of ["legacy-1", "legacy-2"]) {
          store.put(
            {
              key: id,
              uuid: id,
              title: "未命名",
              kind: "document",
              content: "",
              byteLength: 0,
              revision: 1,
              view: "code",
              closable: true,
              updatedAt: Date.now(),
              toolState: {},
              editorSettings: { language: "json", fontSize: 14, indentSize: 4 },
            },
            "document:" + id,
          );
          store.put([], "history:" + id);
        }
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  });
  await page.reload();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "New Tab 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "New Tab 2", exact: true }),
  ).toBeVisible();
});

test("AI auto tab naming is disabled by default, persists in settings, names default tabs, and respects manual names", async ({
  page,
}) => {
  const aiCalls: Array<{ url: string; body: string }> = [];
  let failAI = false;
  let nextTitle = "用户订单列表";

  await page.route("**/api/ai/v1/models", async (route) => {
    if (failAI) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "unavailable" } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [{ id: "mock-model" }] }),
    });
  });

  await page.route("**/api/ai/v1/chat/completions", async (route) => {
    const body = route.request().postData() || "";
    aiCalls.push({ url: route.request().url(), body });
    if (failAI) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "unavailable" } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        choices: [{ message: { role: "assistant", content: nextTitle } }],
      }),
    });
  });

  await page.goto("/");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();

  // Disabled by default: pasting JSON does NOT trigger any AI request.
  await setActiveContent(
    page,
    '{"orders":[{"id":1001,"customer":"Ada","total":199}]}',
  );
  await page.waitForTimeout(1600);
  expect(aiCalls).toHaveLength(0);
  await expect(
    page.getByRole("tab", { name: "New Tab 1", exact: true }),
  ).toBeVisible();

  // Navigate to Settings -> AI Assistant and check switch defaults to OFF.
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.getByRole("heading", { name: "通用设置" })).toBeVisible();
  await page.getByRole("button", { name: "AI 助手", exact: true }).click();
  await expect(page.getByRole("heading", { name: "AI 设置" })).toBeVisible();
  const toggle = page.getByRole("switch", {
    name: "AI 自动命名标签",
    exact: true,
  });
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  // Turn switch ON -> persists and automatically names the populated active tab.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => aiCalls.length).toBe(1);
  expect(aiCalls[0].body).toContain("orders");

  // Wait for debounced settings persistence (1s), reload, and confirm toggle stays ON.
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByRole("heading", { name: "通用设置" })).toBeVisible();
  await page.getByRole("button", { name: "AI 助手", exact: true }).click();
  await expect(page.getByRole("heading", { name: "AI 设置" })).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "AI 自动命名标签", exact: true }),
  ).toHaveAttribute("aria-checked", "true");

  // Return to editor: tab was renamed, language auto-detection still active, download adds .json.
  await page.getByRole("button", { name: "编辑器", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "用户订单列表", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", { name: "选择语言", exact: true }),
  ).toHaveText("自动 · JSON");

  const downloadPromise = page.waitForEvent("download");
  const downloadButton = page.getByRole("button", {
    name: "下载",
    exact: true,
  });
  if (await downloadButton.count()) await downloadButton.click();
  else {
    await page
      .getByRole("button", { name: "更多文档操作", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "下载", exact: true }).click();
  }
  expect((await downloadPromise).suggestedFilename()).toBe("用户订单列表.json");

  // Subsequent edit on already auto-named tab does NOT trigger another AI call.
  await setActiveContent(
    page,
    '{"orders":[{"id":1001,"customer":"Ada","total":299}]}',
  );
  await page.waitForTimeout(1600);
  expect(aiCalls).toHaveLength(1);

  // Imported file is never renamed by AI.
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "manual-import.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"service":"inventory","items":[1,2,3]}'),
    });
  await page.waitForTimeout(1600);
  expect(aiCalls).toHaveLength(1);
  await expect(
    page.getByRole("tab", { name: "manual-import.json", exact: true }),
  ).toBeVisible();

  // Manual rename during in-flight AI request prevents AI from overwriting user's name.
  nextTitle = "AI 覆盖标题";
  let releaseDelayed!: () => void;
  const waitGate = new Promise<void>((resolve) => {
    releaseDelayed = resolve;
  });
  await page.unroute("**/api/ai/v1/chat/completions");
  await page.route("**/api/ai/v1/chat/completions", async (route) => {
    aiCalls.push({
      url: route.request().url(),
      body: route.request().postData() || "",
    });
    if (failAI) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "unavailable" } }),
      });
      return;
    }
    await waitGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        choices: [{ message: { role: "assistant", content: nextTitle } }],
      }),
    });
  });

  await page.getByRole("button", { name: "新建文档", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "New Tab 2", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await setActiveContent(
    page,
    '{"database":{"host":"db.internal","port":5432}}',
  );
  await expect.poll(() => aiCalls.length).toBe(2);

  await page.getByRole("tab", { name: "New Tab 2", exact: true }).dblclick();
  await page.getByLabel("文件名称").fill("prod-db.json");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "prod-db.json", exact: true }),
  ).toBeVisible();
  releaseDelayed();
  await page.waitForTimeout(300);
  await expect(
    page.getByRole("tab", { name: "prod-db.json", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "AI 覆盖标题", exact: true }),
  ).toHaveCount(0);

  // Silent failure on API 503 leaves default tab title intact without error toasts.
  failAI = true;
  await page.getByRole("button", { name: "新建文档", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "New Tab 3", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await setActiveContent(page, '{"metrics":{"latencyMs":42,"errors":0}}');
  await expect.poll(() => aiCalls.length).toBe(3);
  await page.waitForTimeout(300);
  await expect(
    page.getByRole("tab", { name: "New Tab 3", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
});
