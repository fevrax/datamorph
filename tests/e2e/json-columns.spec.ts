import { expect, test, type Page } from "@playwright/test";

test.use({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL });

async function load(page: Page, content: string, language = "json") {
  await page.goto("/");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await page.evaluate(
    async ({ content, language }) => {
      const modulePath = "/src/store/useTabStore.ts";
      const { useTabStore } = await import(modulePath);
      const store = useTabStore.getState();
      store.updateEditorSettings(store.activeTabKey, {
        language,
        languageMode: "manual",
      });
      store.updateTabContent(store.activeTabKey, content);
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) =>
            sessionStorage.setItem("copied-path", text),
        },
      });
    },
    { content, language },
  );
}

test("browses adjacent columns, jumps to ancestors and copies without editing", async ({
  page,
}) => {
  const source =
    '{"items":[{"name":"Ada"},{"id.num":9007199254740993123}],"ok":true}';
  await load(page, source);
  await page.getByRole("button", { name: "栏列", exact: true }).click();
  const view = page.getByRole("region", { name: "JSON 栏列浏览" });
  await view.getByRole("button", { name: /^items/ }).click();
  const items = view.getByRole("region", { name: "items 子节点" });
  await items.getByRole("button", { name: /^\[1\]/ }).click();
  const record = view.getByRole("region", { name: "[1] 子节点" });
  await expect(items).toBeVisible();
  await record.getByRole("button", { name: /^id\.num/ }).press("Enter");
  await expect(view.getByRole("status")).toHaveText('$.items[1]["id.num"]');
  await expect(view.locator("pre")).toHaveText("9007199254740993123");
  await view.getByRole("button", { name: "复制路径" }).click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("copied-path")))
    .toBe('$.items[1]["id.num"]');
  await items.getByRole("button", { name: /^\[0\]/ }).click();
  await expect(view.locator("pre")).toContainText('"Ada"');
  const crumbs = view.getByRole("navigation", { name: "节点路径" });
  await crumbs.getByRole("button", { name: "$", exact: true }).click();
  await expect(view.getByRole("status")).toHaveText("$");
  for (const label of ["格式化", "清空", "历史"]) {
    await expect(
      page.getByRole("button", { name: label, exact: true }),
    ).toHaveCount(0);
  }
  const content = await page.evaluate(async () => {
    const modulePath = "/src/store/useTabStore.ts";
    const { useTabStore } = await import(modulePath);
    return useTabStore.getState().activeTab().content;
  });
  expect(content).toBe(source);
});

test("supports JSON5, narrows the layout, and exits on non-JSON language", async ({
  page,
}) => {
  await load(page, "{ orders: [ { qty: 0x123, }, ], }", "json5");
  await page.getByRole("button", { name: "栏列", exact: true }).click();
  const view = page.getByRole("region", { name: "JSON 栏列浏览" });
  await view.getByRole("button", { name: /^orders/ }).click();
  await view.getByRole("button", { name: /^\[0\]/ }).click();
  await page.setViewportSize({ width: 375, height: 740 });
  await view.getByRole("button", { name: /^qty/ }).click();
  await expect(view.locator("pre")).toHaveText("291");
  await expect(view.getByRole("status")).toHaveText("$.orders[0].qty");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    375,
  );
  await page.getByRole("button", { name: "选择语言", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "YAML", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "栏列", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "编辑", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("offers a way back to editing for empty and invalid input", async ({
  page,
}) => {
  await load(page, "");
  const columns = page.getByRole("button", { name: "栏列", exact: true });
  await columns.click();
  await expect(page.getByText("暂无内容可浏览")).toBeVisible();
  await page.getByRole("button", { name: "返回编辑" }).click();
  await load(page, '{"broken":');
  await columns.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "无法浏览文档" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "返回编辑" }).click();
  await expect(
    page.getByRole("button", { name: "编辑", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("pages through large arrays and selects a later item", async ({
  page,
}) => {
  await load(
    page,
    JSON.stringify(Array.from({ length: 101 }, (_, index) => index)),
  );
  await page.getByRole("button", { name: "栏列", exact: true }).click();
  const view = page.getByRole("region", { name: "JSON 栏列浏览" });
  await expect(view.getByRole("button", { name: /^\[100\]/ })).toHaveCount(0);
  await view.getByRole("button", { name: "下一页" }).click();
  await view.getByRole("button", { name: /^\[100\]/ }).click();
  await expect(view.getByRole("status")).toHaveText("$[100]");
  await expect(view.locator("pre")).toHaveText("100");
});
