import { expect, test, type Page } from "@playwright/test";

test.use({ locale: "en-US", channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL });

async function chooseLanguage(page: Page, option: "简体中文" | "English") {
  await page
    .getByRole("combobox", { name: /^(Interface language|界面语言)$/ })
    .click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("a fresh Traditional Chinese browser starts in Simplified Chinese", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ locale: "zh-Hant-TW" });
  try {
    const page = await context.newPage();
    await page.goto(baseURL!);
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(
      page.getByRole("tab", { name: "New Tab 1", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "开始编辑文档" }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("the language switches immediately, persists on reload, and resets to the browser language", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Datamorph - Data workbench");
  await expect(
    page.getByRole("tab", { name: "New Tab 1", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const input = page.locator(".monaco-editor textarea.inputarea").first();
  await input.focus();
  await page.keyboard.insertText('{"retained":true}');
  await expect(page.locator(".view-lines").first()).toContainText("retained");
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await chooseLanguage(page, "简体中文");
  await expect(page.getByRole("heading", { name: "通用设置" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "界面语言" })).toHaveText(
    "简体中文",
  );
  await page.getByRole("button", { name: "编辑器", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "New Tab 1", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".view-lines").first()).toContainText("retained");

  await page.getByRole("button", { name: "工具箱", exact: true }).click();
  await page.getByRole("button", { name: /^Protobuf 排序工具/ }).click();
  const original = page.locator(
    ".monaco-diff-editor .editor.original textarea.inputarea",
  );
  await original.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText("message Sample }");
  await page.getByRole("button", { name: "重新排序编号", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Protobuf 括号不匹配" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "设置", exact: true }).click();
  await chooseLanguage(page, "English");
  await expect(
    page.getByRole("heading", { name: "General settings" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "AI Assistant", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "AI settings" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Toolbox", exact: true }).click();
  await page
    .getByRole("tab", { name: "Protobuf renumbering", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Protobuf renumbering" }),
  ).toBeVisible();
  await expect(
    page.locator(".monaco-diff-editor .editor.original .view-lines"),
  ).toContainText("message Sample }");
  await page.getByRole("button", { name: "Renumber", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Mismatched Protobuf brackets" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "General settings", exact: true })
    .click();
  await chooseLanguage(page, "简体中文");
  await page.getByRole("button", { name: "重置…", exact: true }).click();
  await page
    .getByRole("button", { name: "删除全部数据并重置", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Interface language" }),
  ).toHaveText("English");
});

test("changing locale while the editor is open keeps its instance and selection", async ({
  page,
}) => {
  await page.goto("/");
  const editor = page.locator(".monaco-editor textarea.inputarea").first();
  await editor.focus();
  await page.keyboard.insertText('{"retained":true}');
  await page.keyboard.press("ControlOrMeta+A");
  const initialInput = await editor.elementHandle();
  await page.evaluate(async () => {
    const settingsPath = "/src/store/useSettingsStore.ts";
    const { useSettingsStore } = await import(settingsPath);
    await useSettingsStore.getState().setInterfaceLocale("zh-CN");
  });
  await expect(
    page.getByRole("tab", { name: "New Tab 1", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", { name: "选择语言", exact: true }),
  ).toHaveText("自动 · JSON");
  expect(await initialInput!.evaluate((element) => element.isConnected)).toBe(
    true,
  );
  await expect(editor).toBeFocused();
  await page.keyboard.insertText('{"replacedSelection":true}');
  await expect(page.locator(".view-lines").first()).toContainText(
    "replacedSelection",
  );
  await expect(page.locator(".view-lines").first()).not.toContainText(
    "retained",
  );
});
