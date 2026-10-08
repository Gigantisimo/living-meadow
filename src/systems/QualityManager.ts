import type { Density, Quality } from "./settings";
export const densityCounts: Record<Density, number> = {
  low: 42000,
  medium: 82000,
  high: 145000,
  ultra: 230000,
};
export const qualityPresets: Record<
  Quality,
  { ratio: number; segments: number; field: number }
> = {
  low: { ratio: 0.8, segments: 4, field: 128 },
  medium: { ratio: 1, segments: 6, field: 192 },
  high: { ratio: 1.35, segments: 7, field: 256 },
};
export function pixelRatio(quality: Quality, deviceRatio = 1) {
  return Math.min(deviceRatio, qualityPresets[quality].ratio);
}

// Keep the drawing buffer bounded even on 4K/high-DPI desktops.
export function renderRatio(quality: Quality, deviceRatio: number, width: number, height: number, scale = 1) {
  const budget = quality === 'low' ? 1100000 : quality === 'medium' ? 1650000 : 2300000;
  return Math.min(pixelRatio(quality, deviceRatio), Math.sqrt(budget / Math.max(1, width * height))) * scale;
}

export class AdaptiveDetail {
  value = 1;
  private seconds = 0;
  private frames = 0;
  private desired = 1;
  update(elapsed: number, target: number, enabled = true) {
    if (!enabled || elapsed > .2) { this.seconds = 0; this.frames = 0; return; }
    this.seconds += elapsed;
    this.frames++;
    if (this.seconds >= 3) {
      const fps = this.frames / this.seconds;
      if (fps < target * .78) this.desired = Math.max(.65, this.desired - .08);
      else if (fps > target * .97) this.desired = Math.min(1, this.desired + .025);
      this.seconds = 0;
      this.frames = 0;
    }
    this.value += (this.desired - this.value) * Math.min(1, elapsed * .6);
  }
}
