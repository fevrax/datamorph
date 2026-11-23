import { expect, test } from "@playwright/test";

test.use({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL });

test("renaming a tab supports Chinese IME composition without premature submit or dismiss and persists across reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();

  const firstTab = page.getByRole("tab", { name: "New Tab 1", exact: true });
  await expect(firstTab).toBeVisible();

  await firstTab.dblclick();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const input = dialog.getByLabel("文件名称");
  await expect(input).toBeFocused();
  await input.fill("");

  // Simulate Chinese IME composition: Enter and Escape during composition must not submit or close the dialog.
  await input.evaluate((el) => {
    const target = el as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;

    target.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true, data: "" }),
    );
    setValue?.call(target, "yonghu");
    target.dispatchEvent(new Event("input", { bubbles: true }));

    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
        isComposing: true,
      }),
    );
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
        isComposing: true,
      }),
    );
  });

  await expect(dialog).toBeVisible();
  await expect(input).toHaveValue("yonghu");
  await expect(page.locator('[role="tab"]').first()).toHaveText("New Tab 1");

  // Finish Chinese composition and simulate Safari's post-compositionend keyCode 229 Enter.
  await input.evaluate((el) => {
    const target = el as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;

    setValue?.call(target, "用户配置");
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(
      new CompositionEvent("compositionend", {
        bubbles: true,
        data: "用户配置",
      }),
    );

    const safariImeEnter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
      isComposing: false,
    });
    Object.defineProperty(safariImeEnter, "keyCode", { value: 229 });
    target.dispatchEvent(safariImeEnter);
  });

  await expect(dialog).toBeVisible();
  await expect(input).toHaveValue("用户配置");

  // Real Enter after composition ends commits the Chinese tab title.
  await input.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("tab", { name: "用户配置", exact: true }),
  ).toBeVisible();

  // Wait for debounced store persistence and verify reload keeps the Chinese title.
  await page.waitForTimeout(800);
  await page.reload();
  const renamedTab = page.getByRole("tab", { name: "用户配置", exact: true });
  await expect(renamedTab).toBeVisible();

  // Context menu rename should focus the input and allow updating to another Chinese name.
  await renamedTab.click({ button: "right" });
  await page.getByRole("menuitem", { name: "重命名", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(input).toBeFocused();
  await input.fill("订单接口数据.json");
  await dialog.getByRole("button", { name: "保存", exact: true }).click();

  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("tab", { name: "订单接口数据.json", exact: true }),
  ).toBeVisible();
});
