import { expect, test, type Page } from "@playwright/test";

test.use({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL });
async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
}
async function document(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    return useTabStore.getState().activeTab();
  });
}
async function replace(page: Page, source: string) {
  await page.evaluate(async (source) => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    const state = useTabStore.getState();
    state.updateTabContent(state.activeTabKey, source);
  }, source);
}
async function modelOptions(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
    const { initMonacoGlobally } = await import(path);
    const monaco = await initMonacoGlobally();
    return monaco.editor
      .getModels()
      .filter((model) => model.uri.scheme === "datamorph")
      .map((model) => ({
        language: model.getLanguageId(),
        size: model.getOptions().tabSize,
        spaces: model.getOptions().insertSpaces,
      }));
  });
}
async function detected(page: Page, size: number, spaces = true) {
  await expect
    .poll(async () => {
      const { editorSettings } = await document(page);
      return {
        mode: editorSettings.indentMode,
        size: editorSettings.indentSize,
        spaces: editorSettings.insertSpaces,
      };
    })
    .toEqual({ mode: "auto", size, spaces });
}
async function toggleAuto(page: Page) {
  await page.getByRole("button", { name: "编辑器设置", exact: true }).click();
  await page.getByRole("switch", { name: "自动识别缩进", exact: true }).click();
  await page.keyboard.press("Escape");
}

async function selectIndentation(page: Page, label: string) {
  await page.getByRole("button", { name: "选择缩进", exact: true }).click();
  await page.getByRole("menuitemradio", { name: label, exact: true }).click();
}

test("changing the status-bar indentation formats immediately with the new size and supports undo", async ({
  page,
}) => {
  await ready(page);
  const compact = '{"nested":{"value":true}}';
  await replace(page, compact);
  for (const size of [1, 10]) {
    await selectIndentation(page, `${size} 空格`);
    await expect
      .poll(async () => (await document(page)).content)
      .toBe(JSON.stringify(JSON.parse(compact), null, size));
    await expect
      .poll(() => modelOptions(page))
      .toEqual([{ language: "json", size, spaces: true }]);
  }
  await page.locator(".monaco-editor textarea.inputarea").first().focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect
    .poll(async () => (await document(page)).content)
    .toBe(JSON.stringify(JSON.parse(compact), null, 1));

  await replace(page, compact);
  await selectIndentation(page, "自动");
  await expect
    .poll(async () => (await document(page)).content)
    .toBe(JSON.stringify(JSON.parse(compact), null, 4));
  await detected(page, 4);

  const yaml = "server:\n  http:\n    timeout: 60s";
  await replace(page, yaml);
  await detected(page, 2);
  await expect(page.getByRole("button", { name: "选择语言" })).toHaveText(
    "自动 · YAML",
  );
  await selectIndentation(page, "6 空格");
  await expect
    .poll(async () => (await document(page)).content)
    .toBe(yaml.replace(/ {2}/g, "      ") + "\n");
});

test("changing diff indentation automatically formats both sides and auto detects each side", async ({
  page,
}) => {
  await ready(page);
  const left = '{\n    "nested":{\n        "value":true\n    }\n}';
  const right = "server:\n  http:\n    timeout: 60s";
  await replace(page, left);
  await page.evaluate(async (right) => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    const state = useTabStore.getState();
    state.setTabModifiedValue(state.activeTabKey, right);
    state.setView(state.activeTabKey, "diff");
  }, right);
  await expect(page.locator(".monaco-diff-editor")).toBeVisible();
  await expect
    .poll(() => modelOptions(page))
    .toEqual([
      { language: "json", size: 4, spaces: true },
      { language: "yaml", size: 2, spaces: true },
    ]);
  await selectIndentation(page, "9 空格");
  await expect
    .poll(async () => (await document(page)).content)
    .toBe(JSON.stringify(JSON.parse(left), null, 9));
  await expect
    .poll(async () => (await document(page)).diffModifiedValue)
    .toBe(right.replace(/ {2}/g, "         ") + "\n");

  await replace(page, left);
  await page.evaluate(async (right) => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    const state = useTabStore.getState();
    state.setTabModifiedValue(state.activeTabKey, right);
  }, right);
  await selectIndentation(page, "自动");
  await expect
    .poll(async () => (await document(page)).content)
    .toBe(JSON.stringify(JSON.parse(left), null, 4));
  await expect
    .poll(async () => (await document(page)).diffModifiedValue)
    .toBe(right + "\n");
  await expect
    .poll(() => modelOptions(page))
    .toEqual([
      { language: "json", size: 4, spaces: true },
      { language: "yaml", size: 2, spaces: true },
    ]);
});

test("pasted YAML detects two spaces and formatting preserves them and undo", async ({
  page,
}) => {
  await ready(page);
  const source = "server:\n  http:\n    addr: 127.0.0.1:8080\n    timeout: 60s";
  await page.evaluate(async (source) => {
    const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
    const { initMonacoGlobally } = await import(path);
    const monaco = await initMonacoGlobally();
    monaco.editor.getEditors()[0].trigger("test", "paste", { text: source });
  }, source);
  await expect.poll(async () => (await document(page)).content).toBe(source);
  await detected(page, 2);
  await expect(page.locator(".workbench-status")).toContainText(
    "自动 · 2 空格",
  );
  await expect(page.getByRole("button", { name: "选择语言" })).toHaveText(
    "自动 · YAML",
  );
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await expect
    .poll(async () => (await document(page)).content)
    .toBe(source + "\n");
  await page.locator(".monaco-editor textarea.inputarea").first().focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await document(page)).content).toBe(source);
});

test("manual indentation survives editing and reload; enabling auto resumes detection", async ({
  page,
}) => {
  await ready(page);
  const source = "server:\n    http:\n        timeout: 60s";
  await replace(page, source);
  await detected(page, 4);
  await toggleAuto(page);
  await page.getByRole("button", { name: "编辑器设置", exact: true }).click();
  const slider = page.getByRole("slider", { name: "缩进", exact: true });
  await slider.focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "6");
  await page.keyboard.press("Escape");
  const twoSpaces = source.replace(/ {4}/g, "  ");
  await replace(page, twoSpaces);
  await expect
    .poll(async () => (await document(page)).editorSettings.indentMode)
    .toBe("manual");
  await expect(page.getByRole("button", { name: "选择语言" })).toHaveText(
    "自动 · YAML",
  );
  await expect(
    page.getByRole("button", { name: "已保存", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  expect((await document(page)).editorSettings.indentMode).toBe("manual");
  await expect
    .poll(() => modelOptions(page))
    .toEqual([{ language: "yaml", size: 6, spaces: true }]);
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await expect
    .poll(async () => (await document(page)).content)
    .toBe(source.replace(/ {4}/g, "      ") + "\n");
  await replace(page, twoSpaces);
  await toggleAuto(page);
  await detected(page, 2);
  await replace(page, '{"hello":true}');
  await detected(page, 4);
});

test("formatting immediately after a content replacement uses the new indentation", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "选择语言" }).click();
  await page.getByRole("menuitemradio", { name: "YAML", exact: true }).click();
  const source = "server:\n  http:\n    timeout: 60s";
  await page.evaluate(async (source) => {
    const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
    const { initMonacoGlobally } = await import(path);
    const monaco = await initMonacoGlobally();
    const editor = monaco.editor.getEditors()[0];
    const model = editor.getModel()!;
    editor.executeEdits("paste", [
      { range: model.getFullModelRange(), text: source },
    ]);
    editor.trigger("test", "datamorph-format", null);
  }, source);
  await expect
    .poll(async () => (await document(page)).content)
    .toBe(source + "\n");
  await detected(page, 2);
});

test("Tab-indented JSON retains Tabs, exact numbers and the model across syntax changes", async ({
  page,
}) => {
  await ready(page);
  const source =
    '{\n\t"id":9007199254740993123,\n\t"nested":{\n\t\t"value":true\n\t}\n}';
  await replace(page, source);
  await detected(page, 4, false);
  await expect(page.locator(".workbench-status")).toContainText("Tab · 宽度 4");
  await page.getByRole("button", { name: "选择语言" }).click();
  await page.getByRole("menuitemradio", { name: "JSON5", exact: true }).click();
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await expect
    .poll(async () => (await document(page)).content)
    .toContain('\n\t"nested": {');
  const formatted = (await document(page)).content;
  expect(formatted).toContain("9007199254740993123");
  expect(formatted).toContain('\n\t\t"value": true');
  await detected(page, 4, false);
});

test("imports detect indentation across built-in and worker formatters", async ({
  page,
}) => {
  await ready(page);
  const samples = [
    ["css", ".card {\n  color:red;\n  margin:0;\n}", 2],
    ["scss", "$primary:red;\n.card {\n    color:$primary;\n}", 4],
    ["less", "@primary:red;\n.card {\n  color:@primary;\n}", 2],
    ["html", "<section>\n  <h1>Title</h1><p>text</p>\n</section>", 2],
    ["sql", "select\n        id,name\nfrom users;", 8],
    ["js", "function hello(){\n  const value=1;\n  return value;\n}", 2],
    ["ts", "interface User{\n    id:number;\n    name:string\n}", 4],
    ["yaml", "server:\n  http:\n    timeout: 60s", 2],
    ["proto", 'syntax="proto3";\nmessage User{\n  string name=1;\n}', 2],
  ] as const;
  for (const [extension, source, size] of samples) {
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: `sample.${extension}`,
        mimeType: "text/plain",
        buffer: Buffer.from(source),
      });
    await detected(page, size);
    await page.getByRole("button", { name: "格式化", exact: true }).click();
    await expect
      .poll(async () => (await document(page)).content)
      .not.toBe(source);
    expect((await document(page)).content).toMatch(
      new RegExp(`\\n {${size}}\\S`),
    );
    await detected(page, size);
  }
});

test("diff sides independently detect and preserve four and two space indentation", async ({
  page,
}) => {
  await ready(page);
  const left = '{\n    "nested":{\n        "value":true\n    }\n}';
  const right = "server:\n  http:\n    timeout: 60s";
  await replace(page, left);
  await detected(page, 4);
  await page.evaluate(async (right) => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    const state = useTabStore.getState();
    state.setTabModifiedValue(state.activeTabKey, right);
    state.setView(state.activeTabKey, "diff");
  }, right);
  await expect(page.locator(".monaco-diff-editor")).toBeVisible();
  await expect
    .poll(() => modelOptions(page))
    .toEqual([
      { language: "json", size: 4, spaces: true },
      { language: "yaml", size: 2, spaces: true },
    ]);
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await page.getByText("格式化全部", { exact: true }).click();
  await expect
    .poll(async () => (await document(page)).content)
    .toContain('\n    "nested": {');
  await expect
    .poll(async () => (await document(page)).diffModifiedValue)
    .toBe(right + "\n");
  await expect
    .poll(() => modelOptions(page))
    .toEqual([
      { language: "json", size: 4, spaces: true },
      { language: "yaml", size: 2, spaces: true },
    ]);
});
