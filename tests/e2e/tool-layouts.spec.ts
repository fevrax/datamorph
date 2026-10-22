import { expect, test, type Page } from "@playwright/test";

test.use({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL });

async function openTool(page: Page, id: string) {
  await page.goto(`/#/toolbox/${id}`);
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator(".tool-workspace")).toBeVisible();
  await expect(page.locator(".monaco-editor:visible").first()).toBeVisible();
}

async function setEditor(page: Page, selector: string, value: string) {
  await expect(page.locator(selector)).toBeVisible();
  await expect.poll(() => editorValue(page, selector)).not.toBeUndefined();
  await page.locator(selector).evaluate(async (element, value) => {
    const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
    const { initMonacoGlobally } = await import(path);
    const monaco = await initMonacoGlobally();
    const editor = monaco.editor
      .getEditors()
      .find((editor: { getDomNode: () => HTMLElement }) =>
        element.contains(editor.getDomNode()),
      );
    if (!editor) throw new Error("Editor not mounted");
    editor.setValue(value);
  }, value);
}

async function editorValue(page: Page, selector: string) {
  return page.locator(selector).evaluate(async (element) => {
    const path = "/src/components/monacoEditor/decorations/decorationInit.ts";
    const { initMonacoGlobally } = await import(path);
    const monaco = await initMonacoGlobally();
    return monaco.editor
      .getEditors()
      .find((editor: { getDomNode: () => HTMLElement }) =>
        element.contains(editor.getDomNode()),
      )
      ?.getValue();
  });
}

async function toolState(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(path);
    return useTabStore.getState().activeTab().toolState;
  });
}

test("all toolbox editor headers stay compact without clipping their controls", async ({
  page,
}) => {
  for (const id of [
    "protoSort",
    "jsonPath",
    "jsonAIRepair",
    "jsonTypeConverter",
    "dataFormatConverter",
    "jwtParse",
    "jsonKeyNaming",
    "encodingConverter",
  ]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openTool(page, id);
    const headers = page.locator(
      ".tool-panel-header, .tool-editor-header, .tool-diff-labels",
    );
    await expect(headers.first()).toBeVisible();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(async () => {
          const sizes = await headers.evaluateAll((elements) =>
            elements.map((element) => {
              const bounds = element.getBoundingClientRect();
              const controls = element.querySelectorAll("button");
              return {
                height: bounds.height,
                fits: element.scrollWidth <= element.clientWidth + 1,
                controlsFit: Array.from(controls).every((control) => {
                  const controlBounds = control.getBoundingClientRect();
                  return (
                    controlBounds.height >= 28 &&
                    controlBounds.top >= bounds.top &&
                    controlBounds.bottom <= bounds.bottom
                  );
                }),
              };
            }),
          );
          return sizes.every(
            (size) =>
              size.height >= 32 &&
              size.height <= (width === 1440 ? 37 : 64) &&
              size.fits &&
              size.controlsFit,
          );
        }, `${id} headers at ${width}px`)
        .toBe(true);
    }
  }
});

test("central format controls convert, swap and retain the source", async ({
  page,
}) => {
  await openTool(page, "dataFormatConverter");
  await setEditor(
    page,
    ".tool-conversion-layout > section:first-child",
    '{"name":"Lin","active":true}',
  );
  await page.getByRole("button", { name: "转换格式", exact: true }).click();
  await expect
    .poll(async () => (await toolState(page)).outputValue)
    .toContain("name: Lin");
  const converted = (await toolState(page)).outputValue;
  await page.getByRole("button", { name: "交换格式", exact: true }).click();
  expect(await toolState(page)).toMatchObject({
    inputFormat: "yaml",
    outputFormat: "json",
    inputValue: converted,
  });
  await page.getByRole("button", { name: "转换格式", exact: true }).click();
  await expect
    .poll(async () => JSON.parse((await toolState(page)).outputValue || "null"))
    .toEqual({ name: "Lin", active: true });
});

test("output language selection still generates types and repair requires an explicit apply", async ({
  page,
}) => {
  await openTool(page, "jsonTypeConverter");
  await setEditor(
    page,
    '.tool-panel:has(h2:text-is("输入 JSON"))',
    '{"name":"Lin","age":28}',
  );
  await page.getByRole("combobox", { name: "目标语言" }).click();
  await page.getByRole("option", { name: "Go", exact: true }).click();
  await page.getByRole("button", { name: "生成类型", exact: true }).click();
  await expect
    .poll(async () => (await toolState(page)).outputValue)
    .toContain("struct");
  await openTool(page, "jsonAIRepair");
  const broken = '{name: "Lin",}';
  await setEditor(page, ".monaco-diff-editor .editor.original", broken);
  await page.getByRole("button", { name: "自动修复", exact: true }).click();
  await expect
    .poll(async () => JSON.parse((await toolState(page)).fixedValue || "null"))
    .toEqual({ name: "Lin" });
  expect((await toolState(page)).originalValue).toBe(broken);
  await page.getByRole("button", { name: "应用修复", exact: true }).click();
  await expect
    .poll(async () => JSON.parse((await toolState(page)).originalValue))
    .toEqual({ name: "Lin" });
  await expect(
    page.getByRole("button", { name: "应用修复", exact: true }),
  ).toBeDisabled();
});

test("query console keeps results in place on narrow screens and handles invalid queries", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await openTool(page, "jsonPath");
  await expect(
    page.getByText("输入 JSONPath 表达式，匹配结果会在这里实时显示。"),
  ).toBeVisible();
  await setEditor(
    page,
    ".query-console-source",
    '{"users":[{"name":"Lin"},{"name":"Alex"}]}',
  );
  const query = page.getByRole("textbox", { name: "JSONPath 表达式" });
  await query.fill("$.users[*].name");
  await expect
    .poll(() => editorValue(page, ".query-console aside"))
    .toContain('"Alex"');
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await query.fill("$.users[");
  await expect(query).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(".query-console [role=alert]")).toBeVisible();
  await page.getByRole("button", { name: "清空查询", exact: true }).click();
  await expect(
    page.getByText("输入 JSONPath 表达式，匹配结果会在这里实时显示。"),
  ).toBeVisible();
});

test("encoding sidebar preserves options and conversion in both directions", async ({
  page,
}) => {
  await openTool(page, "encodingConverter");
  const panels = ".tool-sidebar-layout [data-panel]";
  await setEditor(page, `${panels}:first-child`, "Hello");
  await expect
    .poll(async () => (await toolState(page)).encodedText)
    .toBe("SGVsbG8=");
  await page.getByRole("button", { name: /^URL 编码/ }).click();
  await setEditor(page, `${panels}:first-child`, "a b");
  await expect
    .poll(async () => (await toolState(page)).encodedText)
    .toBe("a%20b");
  await page.getByRole("combobox", { name: "URL 编码模式" }).click();
  await page
    .getByRole("option", { name: "表单模式（空格转 +）", exact: true })
    .click();
  await expect
    .poll(async () => (await toolState(page)).encodedText)
    .toBe("a+b");
  await setEditor(page, `${panels}:last-child`, "hello+world");
  await expect
    .poll(async () => (await toolState(page)).plainText)
    .toBe("hello world");
});

test("JWT inspector verifies and generates from the visible payload", async ({
  page,
}) => {
  await openTool(page, "jwtParse");
  await page.getByRole("button", { name: "载入示例", exact: true }).click();
  await page.getByRole("button", { name: "验证签名", exact: true }).click();
  await expect
    .poll(async () => (await toolState(page)).isTokenValid)
    .toBe(true);
  await setEditor(
    page,
    ".tool-jwt-main > section:last-child",
    '{"sub":"custom-user","name":"Alex"}',
  );
  await page.getByRole("button", { name: "生成 JWT", exact: true }).click();
  await expect
    .poll(async () => {
      const token = (await toolState(page)).jwtToken;
      return JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString(),
      );
    })
    .toMatchObject({ sub: "custom-user", name: "Alex" });
  await page
    .getByRole("textbox", { name: "密钥", exact: true })
    .fill("wrong-secret");
  expect((await toolState(page)).isTokenValid).toBe(null);
  await page.getByRole("button", { name: "验证签名", exact: true }).click();
  await expect
    .poll(async () => (await toolState(page)).isTokenValid)
    .toBe(false);
});
