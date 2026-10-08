import { test } from "node:test";
import assert from "node:assert/strict";
import { TimeOfDay, autoMode, palettes } from "../src/systems/TimeOfDay";
import { defaults, propertyPatch } from "../src/systems/settings";
import { parsePlayback } from "../src/integrations/lively";
import { pixelRatio, densityCounts, renderRatio, AdaptiveDetail } from "../src/systems/QualityManager";

test("day transition is continuous, takes 2.7s, and reaches the exact destination", () => {
  const time = new TimeOfDay();
  time.setMode("night");
  assert.equal(time.current.night, 0);
  time.update(0.9);
  assert.ok(time.current.night > 0 && time.current.night < 0.5);
  const before = time.current.zenith.clone();
  time.setMode("morning");
  assert.ok(time.current.zenith.equals(before));
  time.update(2.7);
  assert.equal(time.transitioning, false);
  assert.equal(time.current.night, 0);
  assert.ok(time.current.grass.equals(palettes.morning.grass));
});
test("automatic clock boundaries use local hours", () => {
  for (const [hour, expected] of [
    [5, "night"],
    [6, "morning"],
    [15, "morning"],
    [16, "golden"],
    [19, "golden"],
    [20, "night"],
  ] as const) {
    assert.equal(autoMode(new Date(2026, 9, 8, hour)), expected);
  }
});
test("Lively dropdowns map zero-based indices; malformed values cannot change settings", () => {
  assert.deepEqual(propertyPatch("timeMode", 0), { timeMode: "morning" });
  assert.deepEqual(propertyPatch("timeMode", 3), { timeMode: "auto" });
  assert.deepEqual(propertyPatch("targetFPS", 0), { targetFPS: 30 });
  assert.deepEqual(propertyPatch("targetFPS", 1), { targetFPS: 60 });
  assert.equal(propertyPatch("timeMode", 1.5), null);
  assert.equal(propertyPatch("graphicsQuality", -1), null);
  assert.equal(propertyPatch("timeMode", 8), null);
  assert.equal(propertyPatch("windStrength", "nope"), null);
  assert.equal(propertyPatch("unknown", 42), null);
  assert.equal(propertyPatch("timeMode", null), null);
  assert.equal(propertyPatch("windStrength", ""), null);
  assert.equal(propertyPatch("fireflies", {}), null);
});
test("interaction radius and wind are clamped, checkboxes accept actual host values", () => {
  assert.deepEqual(propertyPatch("windStrength", 900), { windStrength: 100 });
  assert.deepEqual(propertyPatch("interactionRadius", 0), {
    interactionRadius: 0.5,
  });
  assert.deepEqual(propertyPatch("interactionRadius", 999), {
    interactionRadius: 5,
  });
  assert.deepEqual(propertyPatch("mouseInteraction", false), {
    mouseInteraction: false,
  });
  assert.deepEqual(propertyPatch("fireflies", "false"), { fireflies: false });
  assert.deepEqual(propertyPatch("fireflies", "true"), { fireflies: true });
});
test("official pause payload is parsed safely", () => {
  assert.equal(parsePlayback('{"IsPaused":true}'), true);
  assert.equal(parsePlayback({ IsPaused: false }), false);
  assert.equal(parsePlayback("invalid JSON"), null);
  assert.equal(parsePlayback('{"IsPaused":"false"}'), null);
});
test("quality presets cap DPI and density is progressive", () => {
  assert.equal(pixelRatio("high", 2), 1.35);
  assert.equal(pixelRatio("low", 2), 0.8);
  assert.equal(pixelRatio("medium", 1), 1);
  assert.ok(
    densityCounts.low < densityCounts.medium &&
      densityCounts.medium < densityCounts.high &&
      densityCounts.high < densityCounts.ultra,
  );
  assert.equal(defaults.timeMode, "golden");
});

test("render budget caps high-DPI 4K without changing aspect ratio", () => {
  const ratio = renderRatio("high", 2, 3840, 2160);
  assert.ok(3840*2160*ratio*ratio <= 2300001);
  assert.equal(renderRatio("high", 1, 1280, 720), 1);
});
test("adaptive LOD reacts gradually, is bounded, and ignores paused/transition frames", () => {
  const detail = new AdaptiveDetail();
  for(let i=0;i<1000;i++) detail.update(.05,60);
  assert.ok(detail.value >= .65 && detail.value < .67);
  const before=detail.value;
  detail.update(10,60);
  detail.update(.05,60,false);
  assert.equal(detail.value,before);
  for(let i=0;i<6000;i++) detail.update(1/60,60);
  assert.ok(detail.value > .99 && detail.value <= 1);
});
