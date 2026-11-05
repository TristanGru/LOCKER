import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const FLEET_STATE = join(tmpdir(), "locker-fleet-session.json");

export default defineConfig({
  testDir: "./tests",
  // Signs in once as the fleet account; every test (page and request) reuses that session.
  globalSetup: "./tests/global-setup.ts",
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  outputDir:
    process.env.LOCKER_TEST_OUTPUT || join(tmpdir(), "locker-browser-results"),
  use: {
    baseURL: process.env.LOCKER_URL || "http://127.0.0.1:8000",
    channel:
      process.env.PLAYWRIGHT_CHANNEL ||
      (process.platform === "win32" ? "msedge" : undefined),
    headless: true,
    storageState: FLEET_STATE,
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
