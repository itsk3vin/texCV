import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 20_000,
  use: { baseURL: "http://127.0.0.1:43210", headless: true },
  webServer: {
    command: "node dist-server/cli.js --no-open --port 43210 e2e/workspace",
    url: "http://127.0.0.1:43210/api/workspace",
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
