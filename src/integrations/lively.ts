import { propertyPatch, type Settings } from "../systems/settings";
declare global {
  interface Window {
    livelyPropertyListener: (name: string, val: unknown) => void;
    livelyWallpaperPlaybackChanged: (
      data: string | { IsPaused: boolean },
    ) => void;
    meadowDiagnostics?: (includeField?: boolean) => unknown;
  }
}
export function parsePlayback(data: unknown): boolean | null {
  try {
    const value = typeof data === "string" ? JSON.parse(data) : data;
    return value && typeof value.IsPaused === "boolean" ? value.IsPaused : null;
  } catch {
    return null;
  }
}
export function installLively(
  onSettings: (patch: Partial<Settings>, source: "lively") => void,
  onPause: (paused: boolean) => void,
) {
  window.livelyPropertyListener = (name, val) => {
    const patch = propertyPatch(name, val);
    if (patch) onSettings(patch, "lively");
  };
  window.livelyWallpaperPlaybackChanged = (data) => {
    const paused = parsePlayback(data);
    if (paused !== null) onPause(paused);
  };
  return () => {
    delete (window as Partial<Window>).livelyPropertyListener;
    delete (window as Partial<Window>).livelyWallpaperPlaybackChanged;
  };
}
