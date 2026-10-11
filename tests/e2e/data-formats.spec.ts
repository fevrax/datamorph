import { expect, test, type Page } from "@playwright/test";

test.use({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL });
async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
}
async function setContent(page: Page, content: string) {
  await page.evaluate(async (content) => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    const state = useTabStore.getState();
    state.updateTabContent(state.activeTabKey, content);
  }, content);
}
async function settings(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    return useTabStore.getState().activeTab().editorSettings;
  });
}
async function choose(page: Page, label: string) {
  await page.getByRole("button", { name: "选择语言", exact: true }).click();
  await page.getByRole("menuitemradio", { name: label, exact: true }).click();
}
const samples = {
  json: '{"hello":true}',
  jsonc: '{"hello":true, // hi\n}',
  json5: "{hello:'world'}",
  yaml: "hello:\n  name: world",
  toml: 'hello = "world"',
  xml: "<hello><name>world</name></hello>",
  csv: "name,age\nAda,42",
  tsv: "name\tage\nAda\t42",
  ini: "[hello]\nname = world",
  ndjson: '{"a":1}\n{"a":2}',
};
test("detects all formats, hides unsupported operations, and clears JSON diagnostics", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  for (const [language, text] of Object.entries(samples)) {
    await setContent(page, text);
    await expect
      .poll(async () => (await settings(page)).language)
      .toBe(language);
    await expect(page.locator(".workbench-status")).toContainText(
      "自动 · " + language.toUpperCase(),
    );
  }
  await setContent(page, samples.yaml);
  await expect.poll(async () => (await settings(page)).language).toBe("yaml");
  await expect(
    page.getByRole("button", { name: "树形", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "表格", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "格式化", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".status-document")).toContainText("YAML · 未校验");
  await expect(page.locator(".status-document")).not.toContainText("错误");
  await expect(page.locator(".welcome-actions")).toContainText("开始编辑");
  await setContent(page, "");
  await expect.poll(async () => (await settings(page)).language).toBe("json");
  expect(errors).toEqual([]);
});
test("manual choice persists through edits and refresh, returning to auto resumes detection", async ({
  page,
}) => {
  await ready(page);
  await choose(page, "XML");
  await page.getByRole("button", { name: "编辑器设置", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "语言", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "字体大小" })).toBeVisible();
  await page.getByRole("button", { name: "恢复默认设置", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "选择语言" })).toHaveText(
    "XML",
  );
  await setContent(page, samples.yaml);
  await expect
    .poll(async () => (await settings(page)).languageMode)
    .toBe("manual");
  expect((await settings(page)).language).toBe("xml");
  await expect(
    page.getByRole("button", { name: "已保存", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  expect((await settings(page)).languageMode).toBe("manual");
  expect((await settings(page)).language).toBe("xml");
  await choose(page, "自动识别");
  await expect.poll(async () => (await settings(page)).language).toBe("yaml");
  expect((await settings(page)).languageMode).toBe("auto");
});
test("status language picker stays available on mobile and supports keyboard selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const trigger = page.getByRole("button", { name: "选择语言", exact: true });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveText("自动 · JSON");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("menuitemradio", { name: "自动识别", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.keyboard.type("py");
  await expect(
    page.getByRole("menuitemradio", { name: "Python", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveText("Python");
  await setContent(page, samples.yaml);
  await expect.poll(async () => (await settings(page)).language).toBe("python");
  await choose(page, "自动识别");
  await expect(trigger).toHaveText("自动 · YAML");
  const bounds = await trigger.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
});
test("language selection works from tree and table views", async ({ page }) => {
  await ready(page);
  await setContent(page, samples.json);
  for (const view of ["树形", "表格"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
    await choose(page, "YAML");
    await expect(page.locator(".monaco-editor").first()).toBeVisible();
    await expect.poll(async () => (await settings(page)).language).toBe("yaml");
    const document = await page.evaluate(async () => {
      const path = "/src/store/useTabStore.ts";
      const { useTabStore } = await import(path);
      return useTabStore.getState().activeTab();
    });
    expect(document.view).toBe("code");
    expect(document.content).toBe(samples.json);
    await choose(page, "自动识别");
    await expect.poll(async () => (await settings(page)).language).toBe("json");
  }
});
test("imported extensions win over content and downloads retain the filename", async ({
  page,
}) => {
  await ready(page);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "source.yaml",
      mimeType: "text/plain",
      buffer: Buffer.from(samples.json),
    });
  await expect.poll(async () => (await settings(page)).language).toBe("yaml");
  await setContent(page, samples.toml);
  expect((await settings(page)).language).toBe("yaml");
  const download = page.waitForEvent("download");
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
  expect((await download).suggestedFilename()).toBe("source.yaml");
});
test("changing syntax preserves the live model and undo stack; obsolete requests cannot win", async ({
  page,
}) => {
  await ready(page);
  const input = page.locator(".monaco-editor textarea.inputarea").first();
  await input.focus();
  await page.keyboard.insertText(samples.json5);
  await expect.poll(async () => (await settings(page)).language).toBe("json5");
  const before = await page.evaluate(async (text) => {
    const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
    const { initMonacoGlobally } = await import(path);
    const monaco = await initMonacoGlobally();
    const editor = monaco.editor.getEditors()[0];
    const model = editor.getModel()!;
    editor.pushUndoStop();
    editor.executeEdits("paste", [{ range: model.getFullModelRange(), text }]);
    editor.pushUndoStop();
    return { editor: editor.getId(), model: model.uri.toString() };
  }, samples.yaml);
  await expect.poll(async () => (await settings(page)).language).toBe("yaml");
  const after = await page.evaluate(async () => {
    const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
    const { initMonacoGlobally } = await import(path);
    const monaco = await initMonacoGlobally();
    const editor = monaco.editor.getEditors()[0];
    editor.trigger("test", "undo", null);
    return { editor: editor.getId(), model: editor.getModel()!.uri.toString() };
  });
  expect(after).toEqual(before);
  await expect.poll(async () => (await settings(page)).language).toBe("json5");
  await setContent(page, "a: " + "x".repeat(1_010_000));
  await setContent(page, samples.xml);
  await expect.poll(async () => (await settings(page)).language).toBe("xml");
});
test("diff sides auto-detect independently without overwriting the document language", async ({
  page,
}) => {
  await ready(page);
  await setContent(page, samples.yaml);
  await expect.poll(async () => (await settings(page)).language).toBe("yaml");
  await page.evaluate(async (modified) => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    const state = useTabStore.getState();
    state.setTabModifiedValue(state.activeTabKey, modified);
    state.setView(state.activeTabKey, "diff");
  }, samples.xml);
  await expect(page.locator(".monaco-diff-editor")).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const path =
          "/src/components/monacoEditor/decorations/decorationInit.ts";
        const { initMonacoGlobally } = await import(path);
        const monaco = await initMonacoGlobally();
        return monaco.editor
          .getModels()
          .filter(
            (m: { uri: { scheme: string } }) => m.uri.scheme === "datamorph",
          )
          .map((m: { getLanguageId(): string }) => m.getLanguageId());
      }),
    )
    .toEqual(["yaml", "xml"]);
  expect((await settings(page)).language).toBe("yaml");
  await expect(
    page.getByRole("button", { name: "格式化", exact: true }),
  ).toBeEnabled();
  await choose(page, "TOML");
  await expect.poll(async () => (await settings(page)).language).toBe("toml");
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const path =
          "/src/components/monacoEditor/decorations/decorationInit.ts";
        const { initMonacoGlobally } = await import(path);
        const monaco = await initMonacoGlobally();
        return monaco.editor
          .getModels()
          .filter(
            (model: { uri: { scheme: string } }) =>
              model.uri.scheme === "datamorph",
          )
          .map((model: { getLanguageId(): string }) => model.getLanguageId());
      }),
    )
    .toEqual(["toml", "toml"]);
  await choose(page, "自动识别");
  await expect.poll(async () => (await settings(page)).language).toBe("yaml");
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const path =
          "/src/components/monacoEditor/decorations/decorationInit.ts";
        const { initMonacoGlobally } = await import(path);
        const monaco = await initMonacoGlobally();
        return monaco.editor
          .getModels()
          .filter(
            (model: { uri: { scheme: string } }) =>
              model.uri.scheme === "datamorph",
          )
          .map((model: { getLanguageId(): string }) => model.getLanguageId());
      }),
    )
    .toEqual(["yaml", "xml"]);
});

const formattingSamples = [
  ["CSS", ".card{color:red;margin:0}"],
  ["SCSS", "$primary:red;.card{color:$primary;&:hover{color:blue}}"],
  ["LESS", "@primary:red;.card{color:@primary;}"],
  ["SQL", "select id,name from users where id=9007199254740993123;"],
  ["HTML", "<section><h1>Title</h1><p>text</p></section>"],
  ["JavaScript", "function hello(){const value=1;return value;}"],
  ["TypeScript", "interface User{id:number;name:string}"],
  ["YAML", "user: {id: 9007199254740993123,name: Ada}"],
  ["JSONC", '{"id":9007199254740993123,/* keep */"active":true,}'],
  ["Markdown", "# Heading\n\n* item\n* another\n"],
  ["JSON", '{"id":9007199254740993123,"active":true}'],
  ["JSON5", "{id:9007199254740993123,active:true}"],
] as const;

async function content(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    return useTabStore.getState().activeTab().content;
  });
}

for (const [language, source] of formattingSamples) {
  test(`${language} formats from the toolbar and can be undone`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await ready(page);
    await choose(page, language);
    await setContent(page, source);
    const button = page.getByRole("button", { name: "格式化", exact: true });
    await expect(button).toBeEnabled();
    await button.click();
    await expect.poll(() => content(page)).not.toBe(source);
    const formatted = await content(page);
    if (source.includes("9007199254740993123"))
      expect(formatted).toContain("9007199254740993123");
    if (source.includes("/* keep */"))
      expect(formatted).toContain("/* keep */");
    await page.locator(".monaco-editor textarea.inputarea").first().focus();
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(() => content(page)).toBe(source);
    expect(errors).toEqual([]);
  });
}

test("CSS, SCSS, LESS, SQL and HTML imports are recognized and format with configured indentation", async ({
  page,
}) => {
  await ready(page);
  for (const [language, source] of formattingSamples.slice(0, 5)) {
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: `source.${language.toLowerCase()}`,
        mimeType: "text/plain",
        buffer: Buffer.from(source),
      });
    await expect
      .poll(async () => (await settings(page)).language)
      .toBe(language.toLowerCase());
    await page.evaluate(async () => {
      const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
      const { initMonacoGlobally } = await import(path);
      const monaco = await initMonacoGlobally();
      monaco.editor
        .getEditors()[0]
        .getModel()!
        .updateOptions({ tabSize: 4, insertSpaces: true });
    });
    await page.locator(".monaco-editor textarea.inputarea").first().focus();
    await page.keyboard.press("Alt+Shift+f");
    await expect.poll(() => content(page)).not.toBe(source);
    expect(await content(page)).toMatch(/\n {4}\S/);
  }
});

test("diff formats CSS and SQL independently while JSON sorting remains hidden", async ({
  page,
}) => {
  await ready(page);
  await setContent(page, formattingSamples[0][1]);
  await expect.poll(async () => (await settings(page)).language).toBe("css");
  await page.evaluate(async (modified) => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    const state = useTabStore.getState();
    state.setTabModifiedValue(state.activeTabKey, modified);
    state.setView(state.activeTabKey, "diff");
  }, formattingSamples[3][1]);
  await expect(page.locator(".monaco-diff-editor")).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const path =
          "/src/components/monacoEditor/decorations/decorationInit.ts";
        const { initMonacoGlobally } = await import(path);
        const monaco = await initMonacoGlobally();
        return monaco.editor.getModels().map((model) => model.getLanguageId());
      }),
    )
    .toEqual(["css", "sql"]);
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await page.getByText("格式化全部", { exact: true }).click();
  await expect.poll(() => content(page)).toContain("\n");
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const path =
          "/src/components/monacoEditor/decorations/decorationInit.ts";
        const { initMonacoGlobally } = await import(path);
        const monaco = await initMonacoGlobally();
        return monaco.editor
          .getModels()
          .find((model) => model.getLanguageId() === "sql")
          ?.getValue();
      }),
    )
    .toMatch(/select\s*\n/);
  await expect(
    page.getByRole("button", { name: "字段排序", exact: true }),
  ).toHaveCount(0);
});

test("invalid SQL reports the failure without changing the document", async ({
  page,
}) => {
  await ready(page);
  await choose(page, "SQL");
  const source = "select 'unfinished";
  await setContent(page, source);
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await expect(page.getByText("格式化失败", { exact: true })).toBeVisible();
  expect(await content(page)).toBe(source);
});

test("invalid pasted YAML stays YAML, reports its location and formats after correction", async ({
  page,
}) => {
  await ready(page);
  const source =
    "data:\n  database:\n     driver: mysql\n    # local database\n    source: example";
  await setContent(page, source);
  await expect.poll(async () => (await settings(page)).language).toBe("yaml");
  await expect(page.getByRole("button", { name: "选择语言" })).toHaveText(
    "自动 · YAML",
  );
  const format = page.getByRole("button", { name: "格式化", exact: true });
  await format.click();
  await expect(page.getByText("格式化失败", { exact: true })).toBeVisible();
  await expect(page.locator("[data-sonner-toast]")).toContainText("(2:3)");
  expect(await content(page)).toBe(source);

  const corrected = source.replace("     driver:", "    driver:");
  await setContent(page, corrected);
  await page.evaluate(async () => {
    const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
    const { initMonacoGlobally } = await import(path);
    const monaco = await initMonacoGlobally();
    monaco.editor
      .getEditors()[0]
      .getModel()!
      .updateOptions({ tabSize: 2, insertSpaces: true });
  });
  await format.click();
  await expect.poll(() => content(page)).toBe(corrected + "\n");
  await expect.poll(async () => (await settings(page)).language).toBe("yaml");
});

test("an edit during SQL formatting cannot be overwritten by the worker", async ({
  page,
}) => {
  await ready(page);
  await choose(page, "SQL");
  await setContent(page, "select id from users;\n".repeat(3000));
  const replacement = "select name from customers;";
  await page.evaluate(async (replacement) => {
    const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
    const { initMonacoGlobally } = await import(path);
    const monaco = await initMonacoGlobally();
    const editor = monaco.editor.getEditors()[0];
    const model = editor.getModel()!;
    const formatting = editor.getAction("editor.action.formatDocument")!.run();
    await new Promise((resolve) => setTimeout(resolve, 10));
    editor.executeEdits("typing", [
      { range: model.getFullModelRange(), text: replacement },
    ]);
    await formatting;
  }, replacement);
  await expect.poll(() => content(page)).toBe(replacement);
});

test("language changes hide unsupported actions and restore JSON views and operations", async ({
  page,
}) => {
  await ready(page);
  await setContent(page, samples.json);
  const actions = page.getByRole("group", { name: "文档操作", exact: true });
  const jsonOnly = [
    "压缩",
    "字段升序",
    "字段降序",
    "转义",
    "删除转义",
    "删除注释",
  ];
  for (const [label, language, canFormat] of [
    ["YAML", "yaml", true],
    ["Protobuf", "proto", true],
    ["TOML", "toml", false],
    ["Python", "python", false],
  ] as const) {
    await choose(page, label);
    await expect
      .poll(async () => (await settings(page)).language)
      .toBe(language);
    for (const view of ["树形", "表格"])
      await expect(
        page.getByRole("button", { name: view, exact: true }),
      ).toHaveCount(0);
    for (const name of jsonOnly)
      await expect(
        actions.getByRole("button", { name, exact: true, includeHidden: true }),
      ).toHaveCount(0);
    const format = actions.getByRole("button", { name: "格式化", exact: true });
    if (canFormat) await expect(format).toBeEnabled();
    else await expect(format).toHaveCount(0);
    await expect(
      actions.getByRole("button", { name: "复制", exact: true }),
    ).toBeEnabled();
  }
  await choose(page, "JSON");
  for (const view of ["树形", "表格"])
    await expect(
      page.getByRole("button", { name: view, exact: true }),
    ).toBeEnabled();
  const overflow: string[] = [];
  for (const name of jsonOnly) {
    const button = actions.getByRole("button", { name, exact: true });
    if (await button.count()) await expect(button).toBeEnabled();
    else overflow.push(name);
  }
  if (overflow.length) {
    await actions
      .getByRole("button", { name: "更多文档操作", exact: true })
      .click();
    for (const name of overflow)
      await expect(
        page.getByRole("menuitem", { name, exact: true }),
      ).toBeEnabled();
  }
});

test("mobile overflow hides unsupported operations while retaining common document actions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  for (const language of ["YAML", "TOML"]) {
    await choose(page, language);
    const actions = page.getByRole("group", { name: "文档操作", exact: true });
    await actions
      .getByRole("button", { name: "更多文档操作", exact: true })
      .click();
    const menu = page.getByRole("menu", { name: "更多文档操作", exact: true });
    for (const name of [
      "压缩",
      "字段升序",
      "字段降序",
      "转义",
      "删除转义",
      "删除注释",
    ])
      await expect(
        menu.getByRole("menuitem", { name, exact: true }),
      ).toHaveCount(0);
    if (language === "YAML")
      await expect(
        menu.getByRole("menuitem", { name: "格式化", exact: true }),
      ).toBeEnabled();
    else
      await expect(
        menu.getByRole("menuitem", { name: "格式化", exact: true }),
      ).toHaveCount(0);
    for (const name of ["复制", "清空", "下载", "历史"])
      await expect(
        menu.getByRole("menuitem", { name, exact: true }),
      ).toBeEnabled();
    await page.keyboard.press("Escape");
  }
});

test("mixed diff menus only offer operations for supported sides", async ({
  page,
}) => {
  await ready(page);
  const original = '{"z":1,"a":2}';
  await setContent(page, original);
  await page.evaluate(async (modified) => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    const state = useTabStore.getState();
    state.setTabModifiedValue(state.activeTabKey, modified);
    state.setView(state.activeTabKey, "diff");
  }, samples.toml);
  await expect(page.locator(".monaco-diff-editor")).toBeVisible();
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await expect(
    page.getByRole("menuitem", { name: "格式化全部", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("menuitem", { name: "格式化右边", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("menuitem", { name: "格式化左边", exact: true }).click();
  await expect.poll(() => content(page)).not.toBe(original);
  await page.getByRole("button", { name: "字段排序", exact: true }).click();
  await expect(
    page.getByRole("menuitem", { name: "右边字段升序", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("menuitem", { name: "右边字段降序", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("menuitem", { name: "左边字段升序", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("menuitem", { name: "左边字段升序", exact: true })
    .click();
  await expect
    .poll(async () => {
      const text = await content(page);
      return text.indexOf('"a"') < text.indexOf('"z"');
    })
    .toBe(true);

  await setContent(page, samples.xml);
  await page.evaluate(async (modified) => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    const state = useTabStore.getState();
    state.setTabModifiedValue(state.activeTabKey, modified);
  }, samples.json);
  await expect.poll(async () => (await settings(page)).language).toBe("xml");
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await expect(
    page.getByRole("menuitem", { name: "格式化全部", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("menuitem", { name: "格式化左边", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("menuitem", { name: "格式化右边", exact: true }),
  ).toBeEnabled();
  await page.getByRole("menuitem", { name: "格式化右边", exact: true }).click();
  expect(await content(page)).toBe(samples.xml);
});
