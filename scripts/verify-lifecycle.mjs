import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const browser = await chromium.launch({
  headless: false,
  ...(process.env.MEADOW_CHROME
    ? { executablePath: process.env.MEADOW_CHROME }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 3840, height: 2160 },
  offline: true,
});
const page = await context.newPage(),
  errors = [],
  checks = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
const diag = () => page.evaluate(() => window.meadowDiagnostics());
const host = (name, val) =>
  page.evaluate(
    ([name, val]) => window.livelyPropertyListener(name, val),
    [name, val],
  );
try {
  await page.goto(
    pathToFileURL(resolve("dist/index.html")).href + "?diagnostics",
  );
  await host("showUI", false);
  await host("grassDensity", 3);
  await page.waitForTimeout(1800);
  await host("timeMode", 2);
  const began = Date.now();
  await page.waitForTimeout(2950);
  const heavy = await diag();
  assert.equal(heavy.transitioning, false);
  assert.equal(heavy.night, 1);
  checks.push({
    name: "Transition completes in 2.7 seconds under 4K Ultra load",
    elapsedMs: Date.now() - began,
    diagnostics: heavy,
  });
  console.log(
    "PASS wall-clock lighting transition under heavy GPU load",
    heavy.fps,
  );
  await page.setViewportSize({ width: 640, height: 360 });
  await host("grassDensity", 0);
  await host("graphicsQuality", 0);
  await host("timeMode", 1);
  await host("targetFPS", 1);
  await page.waitForTimeout(3500);
  const active = await diag();
  assert.ok(active.fps > 40);
  console.log(
    "Active FPS",
    active.fps,
    "— waiting for 45-second inactivity threshold",
  );
  await page.waitForTimeout(45000);
  const idle = await diag();
  assert.ok(idle.fps <= 31 && idle.fps > 20);
  await page.mouse.move(300, 260);
  await page.waitForTimeout(1600);
  const resumed = await diag();
  assert.ok(resumed.fps > 40);
  checks.push({
    name: "Idle caps rendering to 30 FPS; pointer movement restores 60 target",
    activeFPS: active.fps,
    idleFPS: idle.fps,
    resumedFPS: resumed.fps,
  });
  console.log(
    "PASS idle reduction and wake-up",
    active.fps,
    idle.fps,
    resumed.fps,
  );
  assert.deepEqual(errors, []);
  await writeFile(
    resolve("artifacts/lifecycle-report.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
} finally {
  await browser.close();
}
