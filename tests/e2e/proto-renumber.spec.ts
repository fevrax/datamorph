import { expect, test, type Page } from "@playwright/test";

test.use({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL });
const source =
  'syntax="proto3";\nmessage User{\nreserved 2;\nstring name=8;\noneof contact{string email=5;string phone=4;}\nmessage Address{string city=9;}\nAddress address=7;\nenum State{UNKNOWN=0;ACTIVE=10;}\n}';
const expected = source
  .replace("name=8", "name=1")
  .replace("email=5", "email=3")
  .replace("city=9", "city=1")
  .replace("address=7", "address=5");

async function read(page: Page) {
  return (
    await page
      .locator(".monaco-editor .view-lines")
      .first()
      .locator(".view-line")
      .allTextContents()
  )
    .join("\n")
    .replace(/\u00a0/g, " ");
}

test("Protobuf renumbering is available after import and supports undo and redo", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "重新排序编号", exact: true }),
  ).toHaveCount(0);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "users.proto",
      mimeType: "text/plain",
      buffer: Buffer.from(source),
    });
  const action = page.getByRole("button", {
    name: "重新排序编号",
    exact: true,
  });
  await expect(action).toBeVisible();
  await action.click();
  await expect.poll(() => read(page)).toBe(expected);
  await page.locator(".monaco-editor textarea.inputarea").first().focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => read(page)).toBe(source);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(() => read(page)).toBe(expected);
});

test("the overflow menu exposes renumbering and invalid input is kept intact", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  const invalid = "message M {\nstring a = 9;\nstring b = ;\n}";
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "invalid.proto",
      mimeType: "text/plain",
      buffer: Buffer.from(invalid),
    });
  await page.getByRole("button", { name: "更多文档操作", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "重新排序编号", exact: true })
    .click();
  await expect(page.getByText("处理失败", { exact: true })).toBeVisible();
  await expect.poll(() => read(page)).toBe(invalid);
});
