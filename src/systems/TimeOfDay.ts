import { Color, Vector3 } from "three";
import { smoothstep } from "../utils";
import type { TimeMode } from "./settings";
export interface Palette {
  zenith: Color;
  horizon: Color;
  haze: Color;
  grass: Color;
  tips: Color;
  light: Color;
  ambient: Color;
  sun: Vector3;
  intensity: number;
  night: number;
  fogDensity: number;
}
const c = (hex: string) => new Color(hex);
export const palettes: Record<Exclude<TimeMode, "auto">, Palette> = {
  morning: {
    zenith: c("#498eb4"),
    horizon: c("#f9d9b4"),
    haze: c("#becbd0"),
    grass: c("#387921"),
    tips: c("#a7c44b"),
    light: c("#fff2d7"),
    ambient: c("#b2d4df"),
    sun: new Vector3(0.29, 0.34, -0.94).normalize(),
    intensity: 2.9,
    night: 0,
    fogDensity: 0.008,
  },
  golden: {
    zenith: c("#386b86"),
    horizon: c("#efac80"),
    haze: c("#c7ac88"),
    grass: c("#356a22"),
    tips: c("#b3b94f"),
    light: c("#ffd29a"),
    ambient: c("#a6b8b5"),
    sun: new Vector3(0.29, 0.22, -0.94).normalize(),
    intensity: 3.8,
    night: 0,
    fogDensity: 0.0095,
  },
  night: {
    zenith: c("#061326"),
    horizon: c("#263e62"),
    haze: c("#203b57"),
    grass: c("#162b18"),
    tips: c("#455e4a"),
    light: c("#c3d0ff"),
    ambient: c("#738ba9"),
    sun: new Vector3(0.42, 0.37, -0.84).normalize(),
    intensity: 0.85,
    night: 1,
    fogDensity: 0.014,
  },
};
export function autoMode(date = new Date()): Exclude<TimeMode, "auto"> {
  const hour = date.getHours() + date.getMinutes() / 60;
  return hour >= 6 && hour < 16
    ? "morning"
    : hour >= 16 && hour < 20
      ? "golden"
      : "night";
}
export function copyPalette(p: Palette): Palette {
  return {
    ...p,
    zenith: p.zenith.clone(),
    horizon: p.horizon.clone(),
    haze: p.haze.clone(),
    grass: p.grass.clone(),
    tips: p.tips.clone(),
    light: p.light.clone(),
    ambient: p.ambient.clone(),
    sun: p.sun.clone(),
  };
}
export class TimeOfDay {
  current = copyPalette(palettes.golden);
  private from = copyPalette(this.current);
  private target = copyPalette(this.current);
  private elapsed = 3;
  private resolved: Exclude<TimeMode, "auto"> = "golden";
  mode: TimeMode = "golden";
  get transitioning() {
    return this.elapsed < 2.7;
  }
  setMode(mode: TimeMode, instant = false) {
    this.mode = mode;
    const next = mode === "auto" ? autoMode() : mode;
    if (next === this.resolved && !instant) return;
    this.resolved = next;
    this.from = copyPalette(this.current);
    this.target = copyPalette(palettes[next]);
    this.elapsed = instant ? 3 : 0;
    if (instant) this.current = copyPalette(this.target);
  }
  update(dt: number) {
    if (this.mode === "auto" && autoMode() !== this.resolved)
      this.setMode("auto");
    this.elapsed += dt;
    const t = smoothstep(this.elapsed / 2.7);
    for (const key of [
      "zenith",
      "horizon",
      "haze",
      "grass",
      "tips",
      "light",
      "ambient",
    ] as const)
      this.current[key].copy(this.from[key]).lerp(this.target[key], t);
    this.current.sun.copy(this.from.sun).lerp(this.target.sun, t).normalize();
    for (const key of ["intensity", "night", "fogDensity"] as const)
      this.current[key] =
        this.from[key] + (this.target[key] - this.from[key]) * t;
  }
}
