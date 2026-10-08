import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const out = resolve("artifacts");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: false,
  ...(process.env.MEADOW_CHROME
    ? { executablePath: process.env.MEADOW_CHROME }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  offline: true,
});
const page = await context.newPage();
const errors = [],
  network = [],
  checks = [],
  benchmarks = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("request", (request) => {
  if (/^https?:/.test(request.url())) network.push(request.url());
});
const diag = (field = false) =>
  page.evaluate((field) => window.meadowDiagnostics(field), field);
const host = (name, val) =>
  page.evaluate(
    ([name, val]) => window.livelyPropertyListener(name, val),
    [name, val],
  );
const sleep = (ms) => page.waitForTimeout(ms);
const record = (name, data = true) => {
  checks.push({ name, data });
  console.log(`PASS ${name}`);
};
async function benchmark(label) {
  await page.mouse.move(0, 0);
  await sleep(16000);
  const samples = [];
  for (let i = 0; i < 8; i++) {
    await sleep(350);
    samples.push((await diag()).fps);
  }
  const d = await diag();
  const result = {
    label,
    settings: d.settings,
    resolution: d.resolution,
    gpu: d.gpu,
    drawCalls: d.drawCalls,
    triangles: d.triangles,
    adaptiveDetail: d.adaptiveDetail,
    grassDrawCalls: d.grassDrawCalls,
    fps: {
      mean: samples.reduce((a, b) => a + b, 0) / samples.length,
      min: Math.min(...samples),
      max: Math.max(...samples),
    },
  };
  benchmarks.push(result);
  console.log("FPS", label, result.fps);
  return result;
}
async function clearBrush() {
  await host("mouseInteraction", false);
  await host("mouseInteraction", true);
}
async function stroke({ steps = 36, delay = 0, y = 765 } = {}) {
  await page.mouse.move(500, y);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  for (let i = 0; i <= steps; i++) {
    await page.mouse.move(500 + (850 * i) / steps, y);
    if (delay) await sleep(delay);
  }
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return (await diag(true)).field;
}
try {
  await page.goto(
    pathToFileURL(resolve("dist/index.html")).href + "?diagnostics",
  );
  await sleep(800);
  assert.equal(await page.title(), "Living Meadow");
  assert.equal(await page.locator("#error").isVisible(), false);
  assert.equal((await diag()).blades, 145000);
  assert.equal((await diag()).settings.timeMode, "golden");
  record("Production file:// starts offline with geometric grass");
  await benchmark("1080p High / High / 60 Golden");
  await page.mouse.move(910, 340);
  await sleep(450);
  assert.equal((await diag()).birdsFlying, true);
  await sleep(550);
  await page.screenshot({path: resolve(out, "Birds-flight.png")});
  record("Real pointer hover on canopy launches instanced bird flock");
  await page.mouse.move(20,100);
  for (const mode of ["morning", "golden", "night"]) {
    await page.locator(`[data-mode=${mode}]`).click();
    await sleep(350);
    const intermediate = await diag();
    if (mode === "night") {
      assert.ok(intermediate.night > 0 && intermediate.night < 1);
      record(
        "Night transition has visible intermediate values",
        intermediate.night,
      );
    }
    await sleep(3000);
    assert.equal((await diag()).transitioning, false);
    await page.screenshot({
      path: resolve(out, mode[0].toUpperCase() + mode.slice(1) + ".png"),
    });
    if (mode === "golden")
      await page.screenshot({
        path: resolve("public/thumbnail.jpg"),
        type: "jpeg",
        quality: 90,
      });
    record(`Time mode ${mode} via visible control`);
  }
  // Shader field evidence supplements, rather than replaces, the captured visible bend.
  await host("windStrength", 0);
  await clearBrush();
  const slow = await stroke({ steps: 36, delay: 60 });
  await clearBrush();
  const fast = await stroke();
  assert.ok(fast.max > 0.12);
  assert.ok(fast.max > slow.max);
  assert.ok(fast.affectedFraction < 0.04);
  record("Faster mouse movement bends more; deformation is local", {
    slow,
    fast,
  });
  await page.screenshot({ path: resolve(out, "Night-brush.png") });
  assert.ok((await diag()).risingFireflies > 0);
  await sleep(1000);
  await page.screenshot({path: resolve(out, "Night-rising-fireflies.png")});
  await host("fireflies", false);
  assert.equal((await diag()).settings.fireflies, false);
  await sleep(100);
  assert.equal((await diag()).risingFireflies, 0);
  await host("fireflies", true);
  record("Real night brush launches fireflies from grass; switch hides them");
  await page.mouse.move(20, 100);
  await sleep(3500);
  const settled = (await diag(true)).field;
  assert.ok(settled.energy < fast.energy * 0.03);
  record("Grass springs back and field settles", settled);
  await host("interactionRadius", 5);
  await clearBrush();
  const small = await stroke();
  await host("interactionRadius", 50);
  await clearBrush();
  const large = await stroke();
  assert.ok(large.affectedFraction > small.affectedFraction);
  record("Brush radius changes affected area", { small, large });
  await host("interactionRadius", 21);
  await host("windStrength", 45);
  await host("mouseInteraction", false);
  await stroke();
  assert.equal((await diag(true)).field.max, 0);
  await host("mouseInteraction", true);
  record("Mouse interaction disables and restores");
  await page.getByRole("button", { name: "Open meadow settings" }).click();
  await page.locator("#wind").focus();
  await page.keyboard.press("Home");
  assert.equal((await diag()).settings.windStrength, 0);
  await page.keyboard.press("End");
  assert.equal((await diag()).settings.windStrength, 100);
  await page.locator("#radius").focus();
  await page.keyboard.press("Home");
  assert.equal((await diag()).settings.interactionRadius, 0.5);
  await page.keyboard.press("End");
  assert.equal((await diag()).settings.interactionRadius, 5);
  await page.locator("#interaction").uncheck();
  assert.equal((await diag()).settings.mouseInteraction, false);
  await page.locator("#interaction").check();
  await page.locator("#fireflies").uncheck();
  assert.equal((await diag()).settings.fireflies, false);
  await page.locator("#fireflies").check();
  await page.locator("#auto-time").check();
  assert.equal((await diag()).settings.timeMode, "auto");
  await page.locator("#auto-time").uncheck();
  await page.locator("#density").selectOption("low");
  await sleep(300);
  assert.equal((await diag()).blades, 42000);
  await page.locator("#quality").selectOption("low");
  await sleep(300);
  const lowBuffer = (await diag()).resolution;
  assert.ok(lowBuffer.width * lowBuffer.height <= 1100000);
  assert.ok(lowBuffer.width >= 1200);
  await page.locator("#fps").selectOption("30");
  assert.equal((await diag()).settings.targetFPS, 30);
  await benchmark("1080p Low / Low / 30");
  await page.locator("#density").selectOption("medium");
  await page.locator("#quality").selectOption("medium");
  await page.locator("#fps").selectOption("60");
  await page.locator("#hide-ui").click();
  assert.equal(await page.locator("#controls").isVisible(), false);
  await page.keyboard.press("h");
  assert.equal(await page.locator("#controls").isVisible(), true);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#settings-panel").isVisible(), false);
  record("All preview controls, full toggle cycles and H / Escape");
  await host("windStrength", 45);
  await host("interactionRadius", 21);
  await host("graphicsQuality", 2);
  await host("grassDensity", 2);
  await host("targetFPS", 1);
  await host("timeMode", 1);
  await sleep(3300);
  const stable = (await diag()).resources;
  for (let i = 0; i < 3; i++) {
    await host("grassDensity", 3);
    await host("graphicsQuality", 0);
    await sleep(220);
    await host("grassDensity", 2);
    await host("graphicsQuality", 2);
    await sleep(220);
  }
  assert.deepEqual((await diag()).resources, stable);
  record(
    "Repeated LOD/density rebuilds retain stable GPU resource counts",
    stable,
  );
  await page.evaluate(() =>
    window.livelyWallpaperPlaybackChanged('{"IsPaused":true}'),
  );
  const pausedTime = (await diag()).time;
  await sleep(700);
  assert.equal((await diag()).time, pausedTime);
  await host("grassDensity", 0);
  await sleep(200);
  await host("grassDensity", 2);
  await sleep(200);
  await page.evaluate(() =>
    window.livelyWallpaperPlaybackChanged('{"IsPaused":false}'),
  );
  await sleep(300);
  assert.ok((await diag()).time > pausedTime);
  record(
    "Official Lively pause/resume callback, including a quality change while paused",
  );
  // This automation Chromium keeps document.visibilityState visible even when minimized.
  // Exercise the handler explicitly; actual host pausing is covered above by Lively's callback.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await sleep(300);
  assert.equal((await diag()).paused, true);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await sleep(300);
  assert.equal((await diag()).paused, false);
  record(
    "Visibilitychange handler stops rendering (simulated document.hidden)",
  );
  await host("timeMode", 2);
  await sleep(350);
  await host("timeMode", 0);
  await sleep(150);
  await host("timeMode", 1);
  await sleep(3000);
  assert.equal((await diag()).transitioning, false);
  assert.equal((await diag()).night, 0);
  record("Rapid reversal during a transition");
  await page.evaluate(() => {
    window.livelyPropertyListener("timeMode", 999);
    window.livelyWallpaperPlaybackChanged("{broken}");
  });
  assert.equal((await diag()).settings.timeMode, "golden");
  record("Malformed host callbacks are ignored safely");
  for (const [width, height] of [
    [2560, 1440],
    [3440, 1440],
    [390, 844],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await sleep(500);
    const fit = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      canvas: [
        document.getElementById("meadow").width,
        document.getElementById("meadow").height,
      ],
      panel: (() => {
        const r = document.querySelector(".time-panel").getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      })(),
    }));
    assert.equal(fit.scrollWidth, width);
    assert.equal(fit.scrollHeight, height);
    assert.ok(fit.panel.left >= 0 && fit.panel.right <= width);
    await page.screenshot({
      path: resolve(out, `Viewport-${width}x${height}.png`),
    });
    record(`Viewport fits ${width}x${height}`, fit);
    if (width === 2560) await benchmark("1440p High / High / 60 Golden");
    if (width === 3440) await benchmark("Ultrawide High / High / 60 Golden");
  }
  await page.setViewportSize({ width: 2560, height: 1440 });
  await host("grassDensity", 1);
  await host("graphicsQuality", 1);
  await host("targetFPS", 0);
  await sleep(300);
  await benchmark("1440p Medium / Medium / 30 Golden");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await host("grassDensity", 2);
  await host("graphicsQuality", 2);
  await host("targetFPS", 1);
  await sleep(400);
  const lost = await page.evaluate(() => {
    const gl = document.getElementById("meadow").getContext("webgl2"),
      ext = gl.getExtension("WEBGL_lose_context");
    if (!ext) return false;
    window.restoreTestContext = () => ext.restoreContext();
    ext.loseContext();
    return true;
  });
  if (lost) {
    await sleep(250);
    assert.equal((await diag()).paused, true);
    await page.evaluate(() => window.restoreTestContext());
    await sleep(1200);
    assert.equal((await diag()).paused, false);
    assert.ok((await diag()).drawCalls > 0);
    record("WebGL context loss / restore");
  }
  await page.getByRole("button", { name: "Open meadow settings" }).click();
  await page.locator("#density").selectOption("medium");
  await page.locator("#fireflies").uncheck();
  await sleep(250);
  await page.reload();
  await sleep(500);
  assert.equal((await diag()).settings.grassDensity, "medium");
  assert.equal((await diag()).settings.fireflies, false);
  record("Browser settings persist across reload");
  // Final gallery has a clean desktop composition and final default settings.
  await host("grassDensity", 2);
  await host("graphicsQuality", 2);
  await host("fireflies", true);
  await host("windStrength", 45);
  await host("interactionRadius", 21);
  await host("showUI", false);
  await page.mouse.move(0, 0);
  for (const [mode, index] of [
    ["morning", 0],
    ["golden", 1],
    ["night", 2],
  ]) {
    await host("timeMode", index);
    await sleep(3100);
    await page.screenshot({ path: resolve(out, `${mode}-desktop.png`) });
    if (mode === "golden")
      await page.screenshot({
        path: resolve("public/thumbnail.jpg"),
        type: "jpeg",
        quality: 90,
      });
  }
  assert.deepEqual(network, []);
  assert.deepEqual(errors, []);
  record("No external network requests or JavaScript/GLSL errors");
  const finalPerformance = await diag();
  assert.equal(finalPerformance.grassDrawCalls, 4);
  assert.ok(finalPerformance.resolution.width * finalPerformance.resolution.height <= 2300000);
  assert.ok(finalPerformance.adaptiveDetail >= .65 && finalPerformance.adaptiveDetail <= 1);
  record("Adaptive LOD stays bounded; grass uses four draws and respects pixel budget", finalPerformance);
  await writeFile(
    resolve(out, "browser-report.json"),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        checks,
        benchmarks,
        errors,
        network,
        final: await diag(),
      },
      null,
      2,
    ),
  );
  console.log(
    `Completed ${checks.length} checks. Evidence: artifacts/browser-report.json`,
  );
} finally {
  await browser.close();
}
