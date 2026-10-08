import { clamp } from "../utils";
export type TimeMode = "morning" | "golden" | "night" | "auto";
export type Density = "low" | "medium" | "high" | "ultra";
export type Quality = "low" | "medium" | "high";
export interface Settings {
  timeMode: TimeMode;
  windStrength: number;
  mouseInteraction: boolean;
  interactionRadius: number;
  grassDensity: Density;
  graphicsQuality: Quality;
  fireflies: boolean;
  targetFPS: 30 | 60;
  showUI: boolean;
}
export const defaults: Settings = {
  timeMode: "golden",
  windStrength: 45,
  mouseInteraction: true,
  interactionRadius: 2.1,
  grassDensity: "high",
  graphicsQuality: "high",
  fireflies: true,
  targetFPS: 60,
  showUI: true,
};
const modes: TimeMode[] = ["morning", "golden", "night", "auto"];
const densities: Density[] = ["low", "medium", "high", "ultra"];
const qualities: Quality[] = ["low", "medium", "high"];
const bool = (value: unknown) =>
  value === true || value === 1 || value === "true"
    ? true
    : value === false || value === 0 || value === "false"
      ? false
      : null;
export function propertyPatch(
  name: string,
  val: unknown,
): Partial<Settings> | null {
  const index =
    typeof val === "number" || (typeof val === "string" && val.trim() !== "")
      ? Number(val)
      : NaN;
  const checkbox = bool(val);
  switch (name) {
    case "timeMode":
      return Number.isInteger(index) && modes[index]
        ? { timeMode: modes[index] }
        : null;
    case "grassDensity":
      return Number.isInteger(index) && densities[index]
        ? { grassDensity: densities[index] }
        : null;
    case "graphicsQuality":
      return Number.isInteger(index) && qualities[index]
        ? { graphicsQuality: qualities[index] }
        : null;
    case "targetFPS":
      return index === 0
        ? { targetFPS: 30 }
        : index === 1
          ? { targetFPS: 60 }
          : null;
    case "windStrength":
      return Number.isFinite(index)
        ? { windStrength: clamp(index, 0, 100) }
        : null;
    case "interactionRadius":
      return Number.isFinite(index)
        ? { interactionRadius: clamp(index / 10, 0.5, 5) }
        : null;
    case "mouseInteraction":
      return checkbox !== null ? { mouseInteraction: checkbox } : null;
    case "fireflies":
      return checkbox !== null ? { fireflies: checkbox } : null;
    case "showUI":
      return checkbox !== null ? { showUI: checkbox } : null;
    default:
      return null;
  }
}
export function loadSettings(): Settings {
  const result = { ...defaults };
  try {
    const data = JSON.parse(localStorage.getItem("living-meadow-v1") ?? "{}");
    if (modes.includes(data.timeMode)) result.timeMode = data.timeMode;
    if (densities.includes(data.grassDensity))
      result.grassDensity = data.grassDensity;
    if (qualities.includes(data.graphicsQuality))
      result.graphicsQuality = data.graphicsQuality;
    for (const key of ["mouseInteraction", "fireflies", "showUI"] as const)
      if (typeof data[key] === "boolean") result[key] = data[key];
    if (Number.isFinite(data.windStrength))
      result.windStrength = clamp(data.windStrength, 0, 100);
    if (Number.isFinite(data.interactionRadius))
      result.interactionRadius = clamp(data.interactionRadius, 0.5, 5);
    if (data.targetFPS === 30 || data.targetFPS === 60)
      result.targetFPS = data.targetFPS;
  } catch {
    /* Storage is optional under file://; Lively restores its own values. */
  }
  return result;
}
export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem("living-meadow-v1", JSON.stringify(settings));
  } catch {
    /* Sandboxed wallpaper storage can be unavailable. */
  }
}
