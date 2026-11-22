import { expect, test } from "@playwright/test";

test.use({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL });

test("typing and pasting replace the welcome state without remounting the editor", async ({
  page,
}) => {
  await page.goto("/");
  const welcome = page.getByRole("region", { name: "开始编辑文档" });
  const input = page.locator(".monaco-editor textarea.inputarea");
  await expect(welcome).toBeVisible();
  await expect(input).toBeFocused();
  await expect(
    page.getByRole("button", { name: "开始编辑", exact: true }),
  ).toHaveCount(0);

  const originalInput = await input.elementHandle();
  await page.keyboard.insertText("typed");
  await expect(welcome).toBeHidden();
  await expect(page.locator(".view-lines")).toContainText("typed");
  await expect(input).toBeFocused();
  expect(await originalInput!.evaluate((element) => element.isConnected)).toBe(
    true,
  );
  await page.keyboard.press("ControlOrMeta+Z");
  await expect(welcome).toBeVisible();

  await page.getByRole("button", { name: "新建文档", exact: true }).click();
  await expect(welcome).toBeVisible();
  await expect(input).toBeFocused();
  const heading = await welcome.getByRole("heading").boundingBox();
  await page.getByRole("button", { name: "新建文档", exact: true }).focus();
  await page.mouse.click(
    heading!.x + heading!.width / 2,
    heading!.y + heading!.height / 2,
  );
  await expect(input).toBeFocused();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(() =>
    navigator.clipboard.writeText("pasted:\n  value: true"),
  );
  await page.keyboard.press("ControlOrMeta+V");
  await expect(welcome).toBeHidden();
  await expect(page.locator(".view-lines")).toContainText("pasted:");
  await expect(page.getByRole("button", { name: "选择语言" })).toHaveText(
    "自动 · YAML",
  );
});

test("the welcome state still offers file import and a sample", async ({
  page,
}) => {
  await page.goto("/");
  const welcome = page.getByRole("region", { name: "开始编辑文档" });
  await welcome.getByRole("button", { name: "载入示例" }).click();
  await expect(welcome).toBeHidden();
  await expect(page.locator(".view-lines")).toContainText('"user"');

  await page.getByRole("button", { name: "新建文档", exact: true }).click();
  const picker = page.waitForEvent("filechooser");
  await welcome.getByRole("button", { name: "打开文件" }).click();
  const chooser = await picker;
  await chooser.setFiles({
    name: "opened.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"opened":true}'),
  });
  await expect(page.getByRole("tab", { name: "opened.json" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(welcome).toBeHidden();
  await expect(page.locator(".view-lines")).toContainText('"opened"');
});

test("the morph welcome preview switches formats, loads templates, and opens import dialogs", async ({
  page,
}) => {
  await page.goto("/");
  const welcome = page.getByRole("region", { name: "开始编辑文档" });
  const modes = welcome.getByRole("group", { name: "预览数据形态" });

  await modes.getByRole("button", { name: "YAML", exact: true }).click();
  await expect(welcome).toContainText("autoDetect");
  await welcome.getByRole("button", { name: "载入示例" }).click();
  await expect(welcome).toBeHidden();
  await expect(page.getByRole("button", { name: "选择语言" })).toHaveText(
    "自动 · YAML",
  );

  await page.getByRole("button", { name: "新建文档", exact: true }).click();
  await expect(welcome).toBeVisible();
  await modes.getByRole("button", { name: "Protobuf", exact: true }).click();
  await expect(welcome).toContainText("DocumentEvent");
  await welcome.getByRole("button", { name: "载入示例" }).click();
  await expect(welcome).toBeHidden();
  await expect(page.getByRole("button", { name: "选择语言" })).toHaveText(
    "自动 · Protobuf",
  );

  await page.getByRole("button", { name: "新建文档", exact: true }).click();
  await expect(welcome).toBeVisible();
  await modes.getByRole("button", { name: "表格视图", exact: true }).click();
  await expect(welcome).toContainText("Datamorph (Base64)");
  await welcome.getByRole("button", { name: "载入示例" }).click();
  await expect(
    page.getByRole("button", { name: "表格", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "新建文档", exact: true }).click();
  await expect(welcome).toBeVisible();
  await welcome.getByRole("button", { name: "URL 导入" }).click();
  await expect(page.getByRole("dialog").getByText("从 URL 导入")).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();

  await welcome.getByRole("button", { name: "Base64" }).click();
  await expect(
    page.getByRole("dialog").getByText("从 Base64 导入"),
  ).toBeVisible();
});
