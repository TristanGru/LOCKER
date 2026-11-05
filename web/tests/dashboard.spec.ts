import { expect, test, type Page } from "@playwright/test";

async function pixelState(page: Page) {
  return page
    .getByTestId("ship-canvas")
    .evaluate((element: HTMLCanvasElement) => {
      const context = element.getContext("webgl2")!;
      const pixels = new Uint8Array(element.width * element.height * 4);
      context.readPixels(
        0,
        0,
        element.width,
        element.height,
        context.RGBA,
        context.UNSIGNED_BYTE,
        pixels,
      );
      let lit = 0,
        checksum = 0;
      for (let index = 0; index < pixels.length; index += 64) {
        if (
          pixels[index] > 50 &&
          pixels[index + 1] > 50 &&
          pixels[index + 2] > 50
        )
          lit++;
        checksum = (checksum + pixels[index] * ((index % 97) + 1)) >>> 0;
      }
      return { width: element.width, height: element.height, lit, checksum };
    });
}

test.beforeEach(async ({ page, request }) => {
  const state = await (await request.get("/api/scenario/version")).json();
  await request.post("/api/reset", { data: { base_version: state.version } });
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  await page.goto('/?legacy=1');
  // With the CIC trainer refreshed in port, Mission A is green at reset; Mission B (COMPTUEX) is lowest.
  await expect(
    page.getByRole("heading", { name: "Mission B needs attention." }),
  ).toBeVisible();
});

test("mission overview opens highlighted source and changes ship", async ({
  page,
}, info) => {
  await expect(page.locator(".mission-row")).toHaveCount(2);
  await expect(page.getByLabel('Readiness over time')).toBeVisible();
  await expect(page.locator('.readiness-timeline path').last()).toHaveAttribute('d', /^M/);
  // Rows are ordered lowest interval readiness first: Mission B (COMPTUEX) leads at reset.
  await expect(page.locator(".mission-row").first()).toContainText(
    "21 days out",
  );
  await page
    .getByRole("button", { name: "EVT-KESSLER-01", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Source evidence" }),
  ).toBeVisible();
  await expect(page.locator(".source-lines")).toContainText("SYNTHETIC");
  await page.keyboard.press("Escape");
  await page.getByLabel("Selected ship").selectOption("VARNELL");
  await expect(page.locator(".mission-row")).toHaveCount(1);
  await page.screenshot({
    path: info.outputPath("desktop-missions.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("DDG canvas renders, camera moves, pins and clipping work", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page
    .getByRole("button", { name: "Ship overview", exact: true })
    .click();
  await expect(page.getByTestId("ship-canvas")).toBeVisible();
  await expect
    .poll(async () => (await pixelState(page)).lit)
    .toBeGreaterThan(100);
  const before = await pixelState(page);
  await page.getByRole("button", { name: "side view", exact: true }).click();
  await expect
    .poll(async () => (await pixelState(page)).checksum)
    .not.toBe(before.checksum);
  await page
    .locator(".system-grid button")
    .filter({ hasText: "SPY1D-CW" })
    .click();
  await expect(page.locator(".system-inspector h2")).toHaveText(
    "Radar cooling water pump",
  );
  await page.getByLabel("Section", { exact: true }).check();
  await expect(page.getByLabel("Section direction")).toBeVisible();
  await page.getByLabel("Section direction").selectOption("z");
  await expect
    .poll(async () => (await pixelState(page)).lit)
    .toBeGreaterThan(100);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath("desktop-ship-section.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Material state", exact: true })
    .click();
  await page.getByLabel("Assessment date").fill("8");
  await expect(page.locator(".assessment-slider")).toContainText(
    "Mean material score",
  );
  for (let visit = 0; visit < 2; visit++) {
    await page
      .getByRole("button", { name: "Mission overview", exact: true })
      .click();
    await expect(page.locator("canvas")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Ship overview", exact: true })
      .click();
    await expect(page.getByTestId("ship-canvas")).toHaveCount(1);
    await expect
      .poll(async () => (await pixelState(page)).lit)
      .toBeGreaterThan(100);
  }
  expect(errors).toEqual([]);
});

test("mobile workspace remains usable with nonblank ship scene", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("mobile-missions.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page
    .getByRole("button", { name: "Ship overview", exact: true })
    .click();
  await expect
    .poll(async () => (await pixelState(page)).lit)
    .toBeGreaterThan(100);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath("mobile-ship.png"),
    fullPage: true,
  });
});

test("preview does not mutate until confirmed; stale writes fail", async ({
  page,
  request,
}) => {
  await page.getByRole("button", { name: "What-if lab", exact: true }).click();
  const initial = await (await request.get("/api/scenario/version")).json();
  await page.getByLabel("Days to shift", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Calculate preview", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Consequences across the squadron" }),
  ).toBeVisible();
  expect(
    (await (await request.get("/api/scenario/version")).json()).version,
  ).toBe(initial.version);
  await page.getByRole("button", { name: "Review and apply" }).click();
  await page.getByRole("button", { name: "Confirm exercise change" }).click();
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/scenario/version")).json()).version,
    )
    .toBe(initial.version + 1);
  const stale = await request.post("/api/events/play", {
    data: { base_version: initial.version },
  });
  expect(stale.status()).toBe(409);
  await page.getByRole("button", { name: "Undo last change" }).click();
  await expect
    .poll(
      async () => (await (await request.get("/api/log")).json()).changes.length,
    )
    .toBe(0);
});

test("feed, graph, ranked fixes, evidence and brief connect end to end", async ({
  page,
  request,
}, info) => {
  test.setTimeout(180000);
  for (let event = 0; event < 4; event++) {
    const state = await (await request.get("/api/scenario/version")).json();
    await request.post("/api/events/play", {
      data: { base_version: state.version },
    });
  }
  await expect(page.locator(".playback-controls")).toContainText(
    "4 / 5 events",
  );
  await page.getByRole("button", { name: "Dominoes", exact: true }).click();
  await expect(page.locator(".react-flow__node.next-domino")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("dependency-graph.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Fix comparison", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Apply to exercise", exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await page
    .getByRole("button", { name: "Apply to exercise", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm exercise change" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Updating shared exercise" }),
  ).toBeHidden();
  await page
    .getByRole("button", { name: "Evidence & feed", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Data profiles" }),
  ).toBeVisible();
  await page.getByLabel("Profile", { exact: true }).selectOption("reference");
  await expect(page.locator(".data-profiles")).toContainText("REVIEW ONLY");
  await page
    .getByLabel("Dataset", { exact: true })
    .selectOption("KESSLER/roster.csv");
  await page.getByRole("button", { name: "Open source", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("NOT used by forecast");
  await page.getByRole("button", { name: "Close source evidence" }).click();
  await page
    .getByRole("button", { name: "Readiness brief", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generate brief", exact: true })
    .click();
  await expect(page.locator(".brief-document")).toContainText("SYNTHETIC");
  await expect(page.locator(".brief-citations button").first()).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download text", exact: true })
    .click();
  expect((await download).suggestedFilename()).toContain("KESSLER");
});
