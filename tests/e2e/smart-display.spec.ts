import { expect, test, type Page } from "@playwright/test";

test.use({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL });
async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await page.evaluate(async () => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    await useTabStore.getState().syncTabStore();
  });
  const enter = page.getByRole("button", {
    name: "直接进入编辑器",
    exact: true,
  });
  if (await enter.isVisible()) await enter.click();
}
async function replace(page: Page, source: string) {
  await page.evaluate(async (source) => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    const state = useTabStore.getState();
    state.updateEditorSettings(state.activeTabKey, {
      language: "json",
      languageMode: "manual",
    });
    state.updateTabContent(state.activeTabKey, source);
  }, source);
}
async function content(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    return useTabStore.getState().activeTab().content;
  });
}
async function hover(page: Page, search: string, editorIndex = 0) {
  await page.evaluate(
    async ({ search, editorIndex }) => {
      const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
      const { initMonacoGlobally } = await import(path);
      const monaco = await initMonacoGlobally();
      const editor = monaco.editor
        .getEditors()
        .filter((item) => item.getDomNode()?.isConnected)[editorIndex];
      const model = editor.getModel()!;
      const offset = model.getValue().indexOf(search);
      if (offset < 0) throw new Error(`Missing hover target ${search}`);
      const position = model.getPositionAt(offset);
      editor.revealPositionInCenter(position);
      editor.setPosition(position);
      editor.focus();
      editor.trigger("test", "editor.action.showHover", {});
    },
    { search, editorIndex },
  );
}
async function fold(page: Page, search: string, collapsed = true) {
  await page.evaluate(
    async ({ search, collapsed }) => {
      const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
      const { initMonacoGlobally } = await import(path);
      const monaco = await initMonacoGlobally();
      const editor = monaco.editor
        .getEditors()
        .find((item) => item.getDomNode()?.isConnected)!;
      const model = editor.getModel()!;
      const offset = model.getValue().indexOf(search);
      if (offset < 0) throw new Error(`Missing fold target ${search}`);
      const line = model.getPositionAt(offset).lineNumber;
      const args = { selectionLines: [line - 1], levels: 1 };
      await editor.getAction("editor.unfold")!.run(args);
      if (collapsed) await editor.getAction("editor.fold")!.run(args);
    },
    { search, collapsed },
  );
}
async function decorationCount(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
    const { initMonacoGlobally } = await import(path);
    const monaco = await initMonacoGlobally();
    return monaco.editor
      .getModels()
      .map(
        (model) =>
          model
            .getAllDecorations()
            .filter((d) =>
              (
                d.options.after?.inlineClassName ||
                d.options.before?.inlineClassName ||
                ""
              ).includes("smart-"),
            ).length,
      );
  });
}

test("JSON strings show previews only on hover and open lossless content without inline labels", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  const embedded = '{"id":900719925474099312345,"name":"张三","active":true}';
  const source = JSON.stringify(
    {
      payload: embedded,
      arrayPayload: '[{"name":"苹果","price":5.5}]',
      color: "#1677ff",
      translucent: "rgba(255, 0, 0, 0.5)",
      items: [1, { a: 1 }, 3],
      notes: "第一行\n第二行😀",
    },
    null,
    2,
  );
  await replace(page, source);
  await expect(page.locator(".smart-color-swatch")).toHaveCount(2);
  await expect(page.locator(".smart-fold-summary")).toHaveCount(0);
  await expect(page.locator(".smart-display-hint")).toHaveCount(0);
  await hover(page, "苹果");
  await expect(page.locator(".monaco-hover:visible")).toContainText(
    '"price": 5.5',
  );
  await page.keyboard.press("Escape");
  await page
    .locator(".view-line")
    .filter({ hasText: "900719925474099312345" })
    .locator("span")
    .filter({ hasText: "900719925474099312345" })
    .last()
    .hover();
  const popup = page.locator(".monaco-hover:visible");
  await expect(popup).toContainText("JSON 字符串");
  await expect(popup).toContainText("900719925474099312345");
  await expect(popup).toContainText("张三");
  await expect(page.locator(".smart-display-hint")).toHaveCount(0);
  await page.screenshot({
    path: "artifacts/smart-display-desktop.png",
    animations: "disabled",
  });
  expect(await content(page)).toBe(source);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await popup.getByRole("link", { name: "复制 JSON", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('"id": 900719925474099312345');
  await popup.getByRole("link", { name: "新标签打开", exact: true }).click();
  await expect
    .poll(() => content(page))
    .toContain('"id": 900719925474099312345');
  await expect.poll(() => content(page)).toContain("\n");
  expect(errors).toEqual([]);
});

test("color previews support keyboard hover and dark mode without text summaries", async ({
  page,
}) => {
  await ready(page);
  await replace(
    page,
    JSON.stringify(
      {
        color: "hsl(120 100% 25%)",
        invalid: "rgb(999,0,0)",
        notes: "第一行\n第二行😀",
      },
      null,
      2,
    ),
  );
  await expect(page.locator(".smart-color-swatch")).toHaveCount(1);
  expect(
    await page
      .locator(".smart-color-swatch")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(0, 128, 0)");
  await hover(page, "hsl(");
  await expect(page.locator(".monaco-hover:visible")).toContainText("颜色预览");
  await expect(page.locator(".monaco-hover:visible")).toContainText(
    "rgba(0, 128, 0, 1)",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".smart-display-hint")).toHaveCount(0);
  await page.getByRole("button", { name: "界面主题", exact: true }).click();
  await page.getByRole("menuitem", { name: "深色", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator(".smart-color-swatch")).toHaveCount(1);
  await hover(page, "hsl(");
  await expect(page.locator(".monaco-hover:visible")).toContainText("颜色预览");
  await page.screenshot({
    path: "artifacts/smart-display-dark.png",
    animations: "disabled",
  });
});

test("folded objects and arrays show only type and direct count, including nested folds and the summary switch", async ({
  page,
}) => {
  await ready(page);
  const source = JSON.stringify(
    {
      colors: { primary: "#1677ff", secondary: "#abc" },
      users: [{ name: "张三" }, { name: "李四" }, { name: "王五" }],
      profile: { nickname: "测试用户", city: "上海", enabled: true },
      notes: "第一行\n第二行" + "长文本".repeat(40),
    },
    null,
    2,
  );
  await replace(page, source);
  await expect(page.locator(".smart-color-swatch")).toHaveCount(2);
  await expect(page.locator(".smart-display-hint")).toHaveCount(0);
  await fold(page, '"colors"');
  await fold(page, '"users"');
  await expect(page.locator(".smart-fold-summary")).toHaveText([
    "  Object { 2 }  ",
    "  Array [ 3 ]  ",
  ]);
  await expect(page.locator(".smart-color-swatch")).toHaveCount(0);
  await page.screenshot({
    path: "artifacts/smart-display-folded.png",
    animations: "disabled",
  });
  await fold(page, "{");
  await expect(page.locator(".smart-fold-summary")).toHaveText([
    "  Object { 4 }  ",
  ]);
  await fold(page, "{", false);
  await expect(page.locator(".smart-fold-summary")).toHaveText([
    "  Object { 2 }  ",
    "  Array [ 3 ]  ",
  ]);
  await fold(page, '"colors"', false);
  await expect(page.locator(".smart-fold-summary")).toHaveText([
    "  Array [ 3 ]  ",
  ]);
  await expect(page.locator(".smart-color-swatch")).toHaveCount(2);
  await page.getByRole("button", { name: "编辑器设置", exact: true }).click();
  await page.getByRole("switch", { name: "折叠摘要", exact: true }).click();
  await expect(page.locator(".smart-fold-summary")).toHaveCount(0);
  await expect(page.locator(".json-fold-count")).toHaveCount(0);
  await page.getByRole("switch", { name: "折叠摘要", exact: true }).click();
  await expect(page.locator(".smart-fold-summary")).toHaveText([
    "  Array [ 3 ]  ",
  ]);
  await page.keyboard.press("Escape");
  await fold(page, '"users"', false);
  await expect(page.locator(".smart-display-hint")).toHaveCount(0);
  expect(await content(page)).toBe(source);
});

test("folded counts update after edits and undo without changing the fold state", async ({
  page,
}) => {
  await ready(page);
  const source = '{"items": [\n  1, 2\n], "other": true}';
  await replace(page, source);
  await fold(page, '"items"');
  await expect(page.locator(".smart-fold-summary")).toHaveText([
    "  Array [ 2 ]  ",
  ]);
  await page.evaluate(async () => {
    const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
    const { initMonacoGlobally } = await import(path);
    const monaco = await initMonacoGlobally();
    const editor = monaco.editor
      .getEditors()
      .find((item) => item.getDomNode()?.isConnected)!;
    const model = editor.getModel()!;
    const end = model.getPositionAt(model.getValue().indexOf("2\n") + 1);
    editor.pushUndoStop();
    editor.executeEdits("test", [
      {
        range: new monaco.Range(
          end.lineNumber,
          end.column,
          end.lineNumber,
          end.column,
        ),
        text: ", 3",
      },
    ]);
    editor.pushUndoStop();
  });
  await expect(page.locator(".smart-fold-summary")).toHaveText([
    "  Array [ 3 ]  ",
  ]);
  await page.evaluate(async () => {
    const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
    const { initMonacoGlobally } = await import(path);
    const monaco = await initMonacoGlobally();
    monaco.editor
      .getEditors()
      .find((item) => item.getDomNode()?.isConnected)!
      .trigger("test", "undo", null);
  });
  await expect(page.locator(".smart-fold-summary")).toHaveText([
    "  Array [ 2 ]  ",
  ]);
  expect(await content(page)).toBe(source);
});

test("switches apply immediately, persist across reload and leave source unchanged", async ({
  page,
}) => {
  await ready(page);
  const source = JSON.stringify(
    { color: "#abc", payload: '{"x":1}', items: [1] },
    null,
    2,
  );
  await replace(page, source);
  await expect(page.locator(".smart-color-swatch")).toHaveCount(1);
  await page.getByRole("button", { name: "编辑器设置", exact: true }).click();
  for (const name of ["字符串内 JSON 展开", "颜色预览", "折叠摘要"]) {
    const toggle = page.getByRole("switch", { name, exact: true });
    await expect(toggle).toBeChecked();
    await toggle.click();
  }
  await page.keyboard.press("Escape");
  await expect(page.locator(".smart-color-swatch")).toHaveCount(0);
  await expect(page.locator(".smart-display-hint")).toHaveCount(0);
  expect(await content(page)).toBe(source);
  await page.evaluate(async () => {
    const path = "/src/store/useSettingsStore.ts";
    const { flushSettingsStore } = await import(path);
    await flushSettingsStore();
    const tabPath = "/src/store/useTabStore.ts";
    const { flushTabStore } = await import(tabPath);
    await flushTabStore();
  });
  await page.reload();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await page.getByRole("button", { name: "编辑器设置", exact: true }).click();
  for (const name of ["字符串内 JSON 展开", "颜色预览", "折叠摘要"]) {
    const toggle = page.getByRole("switch", { name, exact: true });
    await expect(toggle).not.toBeChecked();
    await toggle.click();
  }
  await page.keyboard.press("Escape");
  await expect(page.locator(".smart-color-swatch")).toHaveCount(1);
});

test("diff sides, JSON5, fast edits, undo and language changes keep hints current", async ({
  page,
}) => {
  await ready(page);
  await replace(
    page,
    JSON.stringify(
      { color: "#ff0000", payload: '{"side":"left"}', items: [1, 2] },
      null,
      2,
    ),
  );
  await expect(page.locator(".smart-color-swatch")).toHaveCount(1);
  await page.getByRole("button", { name: "对比", exact: true }).click();
  await page.getByRole("button", { name: "开始对比", exact: true }).click();
  await expect(page.locator(".monaco-diff-editor")).toBeVisible();
  await page.evaluate(async () => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    const state = useTabStore.getState();
    state.setTabModifiedValue(
      state.activeTabKey,
      "{\ncolor:'#00ff00',\npayload:'[true]',\nitems:[\n1,2,3\n]\n}",
    );
  });
  await expect(page.locator(".smart-color-swatch")).toHaveCount(2);
  await expect(page.locator(".smart-fold-summary")).toHaveCount(0);
  await expect(page.locator(".smart-display-hint")).toHaveCount(0);
  await page.evaluate(async () => {
    const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
    const { initMonacoGlobally } = await import(path);
    const monaco = await initMonacoGlobally();
    const ed = monaco.editor.getDiffEditors()[0].getModifiedEditor();
    for (let i = 0; i < 8; i++) {
      ed.pushUndoStop();
      ed.executeEdits("test", [
        {
          range: ed.getModel()!.getFullModelRange(),
          text: JSON.stringify(
            {
              color: `#00000${i}`,
              items: Array.from({ length: i + 1 }, () => 1),
            },
            null,
            2,
          ),
        },
      ]);
    }
    ed.pushUndoStop();
  });
  await expect(page.locator(".editor.modified .smart-color-swatch")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 7)",
  );
  await expect(page.locator(".smart-display-hint")).toHaveCount(0);
  await page.evaluate(async () => {
    const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
    const { initMonacoGlobally } = await import(path);
    const monaco = await initMonacoGlobally();
    monaco.editor
      .getDiffEditors()[0]
      .getModifiedEditor()
      .trigger("test", "undo", null);
  });
  await expect(page.locator(".editor.modified .smart-color-swatch")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 6)",
  );
  await expect(page.locator(".smart-display-hint")).toHaveCount(0);
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.evaluate(async () => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    const state = useTabStore.getState();
    state.updateEditorSettings(state.activeTabKey, {
      language: "yaml",
      languageMode: "manual",
    });
  });
  await expect(page.locator(".monaco-diff-editor")).toHaveCount(0);
  await expect(page.locator(".smart-color-swatch")).toHaveCount(0);
  await expect(page.locator(".smart-display-hint")).toHaveCount(0);
});

test("large documents render bounded decorations, scroll to late values and synchronize only edit deltas", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    (window as any).__smartMessages = [];
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (String(url).includes("smartDisplay.worker")) {
          const post = this.postMessage.bind(this);
          this.postMessage = ((message: any) => {
            (window as any).__smartMessages.push({
              type: message.type,
              textLength: message.text?.length,
              deltaLength: message.changes?.reduce(
                (n: number, c: any) => n + c.text.length,
                0,
              ),
            });
            post(message);
          }) as typeof this.postMessage;
        }
      }
    };
  });
  await ready(page);
  const row = {
    color: "#1677ff",
    payload: '{"ok":true}',
    text: "text ".repeat(20),
  };
  const source = JSON.stringify(
    Array.from({ length: 20000 }, () => row),
    null,
    2,
  );
  await replace(page, source);
  await expect(page.locator(".smart-color-swatch").first()).toBeVisible();
  expect((await decorationCount(page)).every((count) => count <= 160)).toBe(
    true,
  );
  await page.evaluate(async () => {
    const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
    const { initMonacoGlobally } = await import(path);
    const monaco = await initMonacoGlobally();
    const editor = monaco.editor.getEditors()[0];
    const model = editor.getModel()!;
    editor.revealLineInCenter(model.getLineCount() - 10);
  });
  await expect(page.locator(".smart-color-swatch").first()).toBeVisible();
  const before = await page.evaluate(
    () =>
      (window as any).__smartMessages.filter((m: any) => m.type === "sync")
        .length,
  );
  await page.evaluate(async () => {
    const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
    const { initMonacoGlobally } = await import(path);
    const monaco = await initMonacoGlobally();
    const ed = monaco.editor.getEditors()[0];
    ed.executeEdits("test", [
      { range: new monaco.Range(1, 2, 1, 2), text: " " },
    ]);
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__smartMessages.filter(
            (m: any) => m.type === "change",
          ).length,
      ),
    )
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () =>
        (window as any).__smartMessages.filter((m: any) => m.type === "sync")
          .length,
    ),
  ).toBe(before);
  await fold(page, "[");
  await expect(page.locator(".smart-fold-summary")).toHaveText([
    "  Array [ 20000 ]  ",
  ]);
  expect(
    await page.evaluate(
      () =>
        (window as any).__smartMessages.filter((m: any) => m.type === "sync")
          .length,
    ),
  ).toBe(before);
  expect((await decorationCount(page)).every((count) => count <= 160)).toBe(
    true,
  );
});

test("settings and previews remain usable on a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await replace(
    page,
    JSON.stringify(
      { color: "#1677ff", payload: '{"name":"张三"}', items: [1, 2] },
      null,
      2,
    ),
  );
  await expect(page.locator(".smart-color-swatch")).toHaveCount(1);
  await page.getByRole("button", { name: "编辑器设置", exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "字符串内 JSON 展开", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/smart-display-mobile.png",
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await hover(page, "张三");
  await expect(page.locator(".monaco-hover:visible")).toContainText(
    "JSON 字符串",
  );
});
