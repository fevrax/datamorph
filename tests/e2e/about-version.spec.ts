import { expect, test, type Page } from "@playwright/test";
import {
  compareReleaseVersions,
  LATEST_RELEASE_API_URL,
  RELEASES_URL,
  REPOSITORY_URL,
  releaseUrl,
} from "../../src/utils/appVersion";

test.use({
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL,
  serviceWorkers: "block",
});
const current = process.env.TEST_APP_VERSION ?? null;
const currentLabel = current ? `v${current}` : "开发构建";
const payload = (version: string) => ({
  tag_name: `v${version}`,
  draft: false,
  prerelease: false,
});

async function openAbout(page: Page) {
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "关于", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "关于 Datamorph" }),
  ).toBeVisible();
}

function currentVersion(page: Page) {
  return page
    .getByText("当前版本", { exact: true })
    .locator("..")
    .locator("dd");
}

test("build metadata is independent of manual update checks and survives cached checks", async ({
  page,
}) => {
  let requests = 0;
  await page.route(LATEST_RELEASE_API_URL, (route) => {
    requests++;
    return route.fulfill({ json: payload("1.31.0") });
  });
  await openAbout(page);
  await expect(currentVersion(page)).toHaveText(currentLabel);
  if (current) {
    await expect(currentVersion(page).getByRole("link")).toHaveAttribute(
      "href",
      releaseUrl(current),
    );
  }
  if (process.env.TEST_BUILD_SHA) {
    await expect(
      page.getByRole("link", {
        name: process.env.TEST_BUILD_SHA.slice(0, 7),
        exact: true,
      }),
    ).toHaveAttribute(
      "href",
      `${REPOSITORY_URL}/commit/${process.env.TEST_BUILD_SHA}`,
    );
  }
  if (process.env.TEST_BUILD_TIME) {
    await expect(
      page.locator(`time[datetime="${process.env.TEST_BUILD_TIME}"]`),
    ).toBeVisible();
  }
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "检查更新", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "查看更新日志" }),
  ).toHaveAttribute("href", releaseUrl("1.31.0"));
  await expect(currentVersion(page)).toHaveText(currentLabel);
  const checkedAt = await page.getByText(/上次检查：/).textContent();
  await page.getByRole("button", { name: "快捷键", exact: true }).click();
  await page.getByRole("button", { name: "关于", exact: true }).click();
  await page.getByRole("button", { name: "检查更新", exact: true }).click();
  await expect(page.getByText(/上次检查：/)).toHaveText(checkedAt!);
  expect(requests).toBe(1);
});

for (const version of ["1.30.0", "1.31.0", "1.9.0"]) {
  test(`latest ${version} gives an accurate comparison without changing this build`, async ({
    page,
  }) => {
    await page.route(LATEST_RELEASE_API_URL, (route) =>
      route.fulfill({ json: payload(version) }),
    );
    await openAbout(page);
    await page.getByRole("button", { name: "检查更新", exact: true }).click();
    const comparison = compareReleaseVersions(current, version);
    const expected = {
      development: `GitHub 最新正式版 v${version}`,
      newer: `发现新版本 v${version}`,
      current: "已是最新正式版",
      ahead: "当前版本高于最新正式版",
    }[comparison];
    await expect(
      page.getByRole("status").filter({ hasText: expected }),
    ).toBeVisible();
    if (comparison === "development") {
      await expect(
        page.getByText("当前为开发构建，无法与正式版本比较。"),
      ).toBeVisible();
    }
    await expect(currentVersion(page)).toHaveText(currentLabel);
  });
}

test("loading prevents duplicate requests and failed checks can be retried", async ({
  page,
}) => {
  let requests = 0;
  let respond!: () => void;
  const gate = new Promise<void>((resolve) => {
    respond = resolve;
  });
  await page.route(LATEST_RELEASE_API_URL, async (route) => {
    if (++requests === 1) {
      await gate;
      await route.fulfill({ status: 429 });
    } else {
      await route.fulfill({ json: payload("1.31.0") });
    }
  });
  await openAbout(page);
  await page.getByRole("button", { name: "检查更新", exact: true }).click();
  const button = page.getByRole("button", { name: "检查中…", exact: true });
  await expect(button).toBeDisabled();
  await button.evaluate((element: HTMLButtonElement) => {
    element.click();
    element.click();
  });
  await expect.poll(() => requests).toBe(1);
  respond();
  await expect(page.getByText("GitHub 请求过于频繁，请稍后重试")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "查看全部发布" }),
  ).toHaveAttribute("href", RELEASES_URL);
  await expect(currentVersion(page)).toHaveText(currentLabel);
  await page.getByRole("button", { name: "重新检查", exact: true }).click();
  await expect(page.getByRole("link", { name: "查看更新日志" })).toBeVisible();
  expect(requests).toBe(2);
});

test("offline state preserves build information and offers the release list", async ({
  page,
  context,
}) => {
  await openAbout(page);
  await context.setOffline(true);
  await page.getByRole("button", { name: "检查更新", exact: true }).click();
  await expect(page.getByText("当前处于离线状态，请联网后重试")).toBeVisible();
  await expect(currentVersion(page)).toHaveText(currentLabel);
  await expect(
    page.getByRole("link", { name: "查看全部发布" }),
  ).toHaveAttribute("href", RELEASES_URL);
});

test("a stalled request times out after ten seconds", async ({ page }) => {
  await page.route(LATEST_RELEASE_API_URL, () => {});
  await openAbout(page);
  await page.clock.install();
  await page.getByRole("button", { name: "检查更新", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "检查中…", exact: true }),
  ).toBeDisabled();
  await page.clock.fastForward(10_001);
  await expect(page.getByText("检查更新超时，请稍后重试")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "重新检查", exact: true }),
  ).toBeEnabled();
});

test("about page fits narrow screens in light and dark themes", async ({
  page,
}) => {
  await page.route(LATEST_RELEASE_API_URL, (route) =>
    route.fulfill({ json: payload("1.31.0") }),
  );
  await openAbout(page);
  await page.screenshot({
    path: "artifacts/about-version-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "检查更新", exact: true }).click();
  await expect(page.getByRole("link", { name: "查看更新日志" })).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.classList.toggle("dark", value === "dark");
    }, theme);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/about-version-${theme}.png`,
      fullPage: true,
    });
  }
});
