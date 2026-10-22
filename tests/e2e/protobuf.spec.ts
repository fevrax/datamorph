import { expect, test, type Page } from "@playwright/test";

test.use({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL });
const source =
  'syntax="proto3";message User{string name=1;map<string,int64> ids=2;}service Users{rpc Get(User)returns(User);}';
async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
}
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
async function importProto(page: Page) {
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "users.proto",
      mimeType: "text/plain",
      buffer: Buffer.from(source),
    });
  await expect(
    page.getByRole("button", { name: "选择语言", exact: true }),
  ).toHaveText("自动 · Protobuf");
}
async function expectFormatted(page: Page) {
  await expect
    .poll(() => read(page))
    .toContain('syntax = "proto3";\nmessage User {');
  const text = await read(page);
  expect(text).toContain("  string name = 1;");
  expect(text).toContain("map<string, int64> ids = 2;");
  expect(text).toContain("rpc Get(User) returns (User);");
}

test("Protobuf import, toolbar formatting and undo preserve the schema", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  await importProto(page);
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await expectFormatted(page);
  await page.locator(".monaco-editor textarea.inputarea").first().focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => read(page)).toBe(source);
  expect(errors).toEqual([]);
});

test("pasted Protobuf is detected and supports the formatting shortcut", async ({
  page,
}) => {
  await ready(page);
  await page.locator(".monaco-editor textarea.inputarea").first().focus();
  await page.keyboard.insertText(source);
  await expect(
    page.getByRole("button", { name: "选择语言", exact: true }),
  ).toHaveText("自动 · Protobuf");
  await page.keyboard.press("Alt+Shift+f");
  await expectFormatted(page);
  await page.getByRole("button", { name: "选择语言", exact: true }).click();
  await page
    .getByRole("menuitemradio", { name: "Protobuf", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "选择语言", exact: true }),
  ).toHaveText("Protobuf");
});

test("the production PWA can format Protobuf offline before the first use", async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.TEST_PRODUCTION,
    "Requires the built PWA and service worker",
  );
  await ready(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await importProto(page);
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await expectFormatted(page);
});
