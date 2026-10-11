import { expect, test, type Page } from "@playwright/test";

test.use({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL });
const current = JSON.stringify(
  { status: "ok", data: { page: 2, limit: 50, total: 128 }, cached: false },
  null,
  2,
);
const previous = JSON.stringify(
  { status: "ok", data: { page: 1, limit: 20, total: 128 }, cached: false },
  null,
  2,
);
const oldest = '{"status":"loading"}';
const documentKey = "history-test-document";

async function seed(page: Page, empty = false) {
  await page.goto("/");
  await page.locator(".monaco-editor").first().waitFor();
  await page.evaluate(
    async ({ current, previous, oldest, documentKey, empty }) => {
      const now = Date.now();
      const history = empty
        ? []
        : [
            {
              key: "latest",
              content: current,
              timestamp: now - 600000,
              revision: 12,
              monacoVersion: 12,
              title: "response.json",
            },
            {
              key: "previous",
              content: previous,
              timestamp: now - 3600000,
              revision: 8,
              monacoVersion: 8,
              title: "response.json",
            },
            {
              key: "oldest",
              content: oldest,
              timestamp: now - 86400000,
              revision: 3,
              monacoVersion: 3,
              title: "response.json",
            },
          ];
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
            { activeTabKey: documentKey, order: [documentKey] },
            "workspace",
          );
          store.put(
            {
              key: documentKey,
              uuid: documentKey,
              title: "response.json",
              kind: "document",
              content: current,
              byteLength: new TextEncoder().encode(current).byteLength,
              revision: 12,
              view: "code",
              closable: true,
              updatedAt: now,
              toolState: {},
              editorSettings: { language: "json", fontSize: 14, indentSize: 2 },
            },
            "document:" + documentKey,
          );
          store.put(history, "history:" + documentKey);
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
      localStorage.setItem("theme", "light");
    },
    { current, previous, oldest, documentKey, empty },
  );
  await page.reload();
  await page.locator(".monaco-editor").first().waitFor();
}

async function openHistory(page: Page) {
  const direct = page.getByRole("button", { name: "历史", exact: true });
  if (await direct.isVisible()) await direct.click();
  else {
    await page.getByRole("button", { name: "更多文档操作" }).click();
    await page.getByRole("menuitem", { name: "历史", exact: true }).click();
  }
  return page.locator(".history-modal");
}

async function replaceContent(page: Page, content: string) {
  const input = page.locator(".monaco-editor textarea").first();
  await input.press("ControlOrMeta+A");
  await input.evaluate((textarea, value) => {
    const data = new DataTransfer();
    data.setData("text/plain", value);
    textarea.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, content);
}

test("switches versions in place, compares read-only content, and opens a copy", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seed(page);
  const dialog = await openHistory(page);
  await expect(dialog.getByText("3 个版本")).toBeVisible();
  await expect(dialog.getByText("与当前内容一致")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "恢复此版本" }),
  ).toBeDisabled();
  const preview = dialog.getByRole("region", {
    name: "历史版本内容，只读",
    exact: true,
  });
  await expect(preview).toHaveAttribute("data-value", current);
  const originalBounds = await dialog.boundingBox();
  expect(originalBounds!.width).toBeGreaterThan(1300);
  expect(originalBounds!.height).toBeGreaterThan(800);
  await dialog.getByRole("button", { name: /版本 8$/ }).click();
  await expect(preview).toHaveAttribute("data-value", previous);
  expect(await dialog.boundingBox()).toEqual(originalBounds);
  await expect(dialog.getByRole("button", { name: /版本 8$/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.screenshot({
    path: "artifacts/history-desktop.png",
    animations: "disabled",
  });
  await dialog.getByRole("button", { name: "与当前比较" }).click();
  await dialog.locator(".monaco-diff-editor").waitFor();
  await expect(dialog.locator(".line-delete").first()).toBeVisible();
  await expect(dialog.locator(".line-insert").first()).toBeVisible();
  await expect(dialog.locator("textarea").first()).toHaveAttribute(
    "readonly",
    "true",
  );
  await page.screenshot({
    path: "artifacts/history-diff.png",
    animations: "disabled",
  });
  await dialog.getByRole("button", { name: /版本 3$/ }).click();
  await expect(
    dialog.locator(".monaco-diff-editor .original .view-lines"),
  ).toContainText("loading");
  await dialog.getByRole("button", { name: "内容预览" }).click();
  await expect(preview).toHaveAttribute("data-value", oldest);
  await dialog.getByRole("button", { name: /版本 8$/ }).click();
  await dialog.getByRole("button", { name: "新标签打开" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /历史版本/ })).toBeVisible();
  await expect(
    page.locator(".monaco-editor .view-lines").first(),
  ).toContainText('"limit": 20');
  await page.getByRole("tab", { name: "response.json", exact: true }).click();
  await expect(
    page.locator(".monaco-editor .view-lines").first(),
  ).toContainText('"limit": 50');
  expect(errors).toEqual([]);
});

test("restoring during a pending edit preserves that edit in history", async ({
  page,
}) => {
  await seed(page);
  const pending = '{"unsaved":"recover me"}';
  // Restore before the one-second snapshot timer can save this edit.
  await replaceContent(page, pending);
  const dialog = await openHistory(page);
  await dialog.getByRole("button", { name: /版本 8$/ }).click();
  await dialog.getByRole("button", { name: "恢复此版本" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator(".monaco-editor .view-lines").first(),
  ).toContainText('"limit": 20');
  await openHistory(page);
  await dialog
    .locator(".history-record")
    .filter({ hasText: `${pending.length} 字符` })
    .click();
  await expect(
    dialog.getByRole("region", { name: "历史版本内容，只读", exact: true }),
  ).toHaveAttribute("data-value", pending);
  await expect
    .poll(() =>
      page.evaluate(
        async ({ documentKey, pending }) => {
          return await new Promise<boolean>((resolve, reject) => {
            const request = indexedDB.open("datamorph");
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const read = db
                .transaction("workspace_v2")
                .objectStore("workspace_v2")
                .get("history:" + documentKey);
              read.onsuccess = () => {
                db.close();
                resolve(
                  read.result.some(
                    (item: { content: string }) => item.content === pending,
                  ),
                );
              };
              read.onerror = () => {
                db.close();
                reject(read.error);
              };
            };
          });
        },
        { documentKey, pending },
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.reload();
  await openHistory(page);
  await dialog
    .locator(".history-record")
    .filter({ hasText: `${pending.length} 字符` })
    .click();
  await expect(
    dialog.getByRole("region", { name: "历史版本内容，只读", exact: true }),
  ).toHaveAttribute("data-value", pending);
});

test("confirms deletion and clearing, selects a neighbor, and leaves current content intact", async ({
  page,
}) => {
  await seed(page);
  const dialog = await openHistory(page);
  await dialog.getByRole("button", { name: /版本 8$/ }).click();
  await dialog.getByRole("button", { name: "管理历史" }).click();
  await page.getByRole("menuitem", { name: "删除此版本", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(dialog.getByText("3 个版本")).toBeVisible();
  await dialog.getByRole("button", { name: "管理历史" }).click();
  await page.getByRole("menuitem", { name: "删除此版本", exact: true }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(dialog.getByText("2 个版本")).toBeVisible();
  await expect(
    dialog.getByRole("region", { name: "历史版本内容，只读", exact: true }),
  ).toHaveAttribute("data-value", oldest);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  const pending = '{"pending":"keep current content"}';
  await replaceContent(page, pending);
  await openHistory(page);
  await dialog.getByRole("button", { name: "管理历史" }).click();
  await page
    .getByRole("menuitem", { name: "清空所有历史", exact: true })
    .click();
  await page.getByRole("button", { name: "确认清空", exact: true }).click();
  await expect(dialog.getByText("还没有历史记录")).toBeVisible();
  // Clearing cancels the pending edit snapshot rather than repopulating the list.
  await page.waitForTimeout(1200);
  await expect(dialog.getByText("还没有历史记录")).toBeVisible();
  await dialog.getByRole("button", { name: "继续编辑" }).click();
  await expect(
    page.locator(".monaco-editor .view-lines").first(),
  ).toContainText('"pending":"keep current content"');
});

test("fits small screens and dark appearance, including empty history", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  const dialog = await openHistory(page);
  await dialog.getByRole("button", { name: /版本 8$/ }).click();
  await dialog.getByRole("button", { name: "与当前比较" }).click();
  await dialog.locator(".monaco-diff-editor").waitFor();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  expect(
    (await dialog.locator(".history-editor").boundingBox())!.height,
  ).toBeGreaterThan(150);
  await expect(
    dialog.getByRole("button", { name: "恢复此版本" }),
  ).toBeInViewport();
  await page.screenshot({
    path: "artifacts/history-mobile.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  await page.reload();
  await openHistory(page);
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({
    path: "artifacts/history-dark.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await seed(page, true);
  await openHistory(page);
  await expect(dialog.getByText("还没有历史记录")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "恢复此版本" })).toHaveCount(
    0,
  );
});
