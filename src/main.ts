import "./style.css";
import { MeadowScene } from "./scene/MeadowScene";
import { loadSettings } from "./systems/settings";
const error = document.getElementById("error")!;
try {
  const settings = loadSettings();
  const params = new URLSearchParams(location.search);
  if (params.get("desktop") === "1") settings.showUI = false;
  const mode = params.get("mode");
  if (mode === "morning" || mode === "golden" || mode === "night")
    settings.timeMode = mode;
  const scene = new MeadowScene(
    document.getElementById("meadow") as HTMLCanvasElement,
    settings,
  );
  if (params.has("diagnostics"))
    window.meadowDiagnostics = (includeField = false) =>
      scene.diagnostics(includeField);
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) scene.dispose();
  });
  if (import.meta.hot) import.meta.hot.dispose(() => scene.dispose());
} catch (e) {
  console.error(e);
  error.hidden = false;
  error.textContent =
    "Living Meadow could not start. Enable hardware acceleration and use a WebGL 2 browser (or Lively’s Chromium player). " +
    (e instanceof Error ? e.message : "Unknown graphics error.");
}
