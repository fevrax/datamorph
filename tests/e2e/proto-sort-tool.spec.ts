import { expect, test, type Page } from "@playwright/test";

test.use({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL });
const source = `syntax = "proto3";
message User {
  reserved 2;
  string name = 8;
  oneof contact {
    string email = 5;
    string phone = 4;
  }
  message Address { string city = 9; }
  Address address = 7;
  enum State { UNKNOWN = 0; ACTIVE = 10; }
}`;
const expected = source
  .replace("name = 8", "name = 1")
  .replace("email = 5", "email = 3")
  .replace("city = 9", "city = 1")
  .replace("address = 7", "address = 5");

async function openTool(page: Page) {
  await page.goto("/");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "users.proto",
      mimeType: "text/plain",
      buffer: Buffer.from(source),
    });
  await page.getByRole("button", { name: "工具箱", exact: true }).click();
  await page.getByRole("button", { name: /^Protobuf 排序工具/ }).click();
  await expect(page.locator(".monaco-diff-editor")).toBeVisible();
}

async function diffState(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
    const { initMonacoGlobally } = await import(path);
    const monaco = await initMonacoGlobally();
    const diff = monaco.editor.getDiffEditors()[0];
    const original = diff.getOriginalEditor();
    const modified = diff.getModifiedEditor();
    return {
      original: original.getValue(),
      modified: modified.getValue(),
      originalReadOnly: original.getOption(monaco.editor.EditorOption.readOnly),
      modifiedReadOnly: modified.getOption(monaco.editor.EditorOption.readOnly),
      changes: diff.getLineChanges()?.length ?? 0,
      originalWidth: original.getDomNode().getBoundingClientRect().width,
      modifiedWidth: modified.getDomNode().getBoundingClientRect().width,
    };
  });
}

async function storeState(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    const state = useTabStore.getState();
    return {
      toolState: state.activeTab().toolState,
      source: state.tabs.find((tab) => tab.title === "users.proto")?.content,
      saveStatus: state.saveStatus,
    };
  });
}

test("the toolbox opens a Protobuf diff and renumbering leaves its source intact", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openTool(page);
  await expect
    .poll(() => diffState(page))
    .toMatchObject({
      original: source,
      modified: source,
      originalReadOnly: false,
      modifiedReadOnly: true,
    });
  await page.getByRole("button", { name: "重新排序编号", exact: true }).click();
  await expect
    .poll(() => diffState(page))
    .toMatchObject({ original: source, modified: expected });
  await expect
    .poll(async () => (await diffState(page)).changes)
    .toBeGreaterThan(0);
  expect((await storeState(page)).source).toBe(source);
  await page.screenshot({
    path: "artifacts/proto-sort-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("editing the original invalidates the old result and malformed schemas are preserved", async ({
  page,
}) => {
  await openTool(page);
  await page.getByRole("button", { name: "重新排序编号", exact: true }).click();
  await expect
    .poll(async () => (await diffState(page)).modified)
    .toBe(expected);
  const invalid = "message M {\n  string a = 9;\n  string b = ;\n}";
  await page.evaluate(async (text) => {
    const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
    const { initMonacoGlobally } = await import(path);
    const monaco = await initMonacoGlobally();
    const original = monaco.editor.getDiffEditors()[0].getOriginalEditor();
    original.setSelection(original.getModel().getFullModelRange());
    original.trigger("test", "paste", { text });
  }, invalid);
  await expect
    .poll(() => diffState(page))
    .toMatchObject({ original: invalid, modified: invalid });
  await expect
    .poll(async () => (await storeState(page)).toolState)
    .toMatchObject({ outputValue: "", hasResult: false });
  await expect(
    page.getByRole("button", { name: "复制结果", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "重新排序编号", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "排序失败" }),
  ).toBeVisible();
  await expect
    .poll(() => diffState(page))
    .toMatchObject({ original: invalid, modified: invalid });
  expect((await storeState(page)).source).toBe(source);
});

test("sorting results survive reload and export as Protobuf documents", async ({
  page,
}) => {
  await openTool(page);
  await page.getByRole("button", { name: "重新排序编号", exact: true }).click();
  await expect
    .poll(async () => (await diffState(page)).modified)
    .toBe(expected);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("result.proto");
  await expect
    .poll(async () => (await storeState(page)).saveStatus)
    .toBe("saved");
  await page.reload();
  await page
    .getByRole("tab", { name: "Protobuf 排序工具", exact: true })
    .click();
  await expect(page.locator(".monaco-diff-editor")).toBeVisible();
  await expect
    .poll(() => diffState(page))
    .toMatchObject({
      original: source,
      modified: expected,
      modifiedReadOnly: true,
    });
  await page.getByRole("button", { name: "新建标签", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "result.proto", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  expect((await storeState(page)).source).toBe(source);
});

test("the mobile diff keeps the original editable and can apply the result to its source", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/toolbox/protoSort");
  await expect(page.locator(".monaco-diff-editor")).toBeVisible();
  await page.getByRole("button", { name: "载入示例", exact: true }).click();
  await page.getByRole("button", { name: "重新排序编号", exact: true }).click();
  await expect
    .poll(async () => (await storeState(page)).toolState.hasResult)
    .toBe(true);
  await expect
    .poll(async () => (await diffState(page)).changes)
    .toBeGreaterThan(0);
  const diff = await diffState(page);
  expect(diff.originalWidth).toBeGreaterThan(50);
  expect(diff.modifiedWidth).toBeGreaterThan(50);
  expect(diff.originalReadOnly).toBe(false);
  expect(diff.modifiedReadOnly).toBe(true);
  expect(diff.modified).toContain("string name = 1;");
  await page.screenshot({
    path: "artifacts/proto-sort-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "替换来源…", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "应用替换", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("tab", { name: "未命名", exact: true }).click();
  await expect
    .poll(async () => {
      return page.evaluate(async () => {
        const path = "/src/store/useTabStore.ts";
        const { useTabStore } = await import(path);
        return useTabStore.getState().activeTab().content;
      });
    })
    .toBe(diff.modified);
});
