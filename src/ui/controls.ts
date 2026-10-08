import type { Settings, TimeMode, Quality, Density } from "../systems/settings";
export class Controls {
  private root: HTMLElement;
  constructor(
    settings: Settings,
    private change: (patch: Partial<Settings>) => void,
  ) {
    this.root = document.getElementById("controls")!;
    this.root.innerHTML = `
      <nav class="time-panel" aria-label="Time of day">
        <button type="button" data-mode="morning" aria-pressed="false"><span class="symbol">☀</span> Morning</button>
        <button type="button" data-mode="golden" aria-pressed="true"><span class="symbol">◒</span> Golden</button>
        <button type="button" data-mode="night" aria-pressed="false"><span class="symbol">☾</span> Night</button>
        <span class="panel-divider"></span>
        <button type="button" id="settings-toggle" aria-label="Open meadow settings" aria-expanded="false" aria-controls="settings-panel">⚙</button>
      </nav>
      <section id="settings-panel" class="settings-panel" aria-label="Meadow settings" hidden>
        <div class="settings-heading">Make it yours <span>Living Meadow</span></div>
        <label>Follow local time <input id="auto-time" type="checkbox"></label>
        <label>Wind <input id="wind" type="range" min="0" max="100" aria-label="Wind strength"></label>
        <label>Brush radius <input id="radius" type="range" min=".5" max="5" step=".1" aria-label="Interaction radius"></label>
        <label>Mouse interaction <input id="interaction" type="checkbox"></label>
        <label>Grass density <select id="density"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="ultra">Ultra</option></select></label>
        <label>Graphics <select id="quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        <label>Fireflies <input id="fireflies" type="checkbox"></label>
        <label>Frame limit <select id="fps"><option value="30">30 FPS</option><option value="60">60 FPS</option></select></label>
        <button type="button" id="hide-ui" class="hide-ui">Hide controls <span>press H to bring back</span></button>
      </section>
      <div class="signature"><span class="signature-mark">✳</span><div>LIVING MEADOW<span>A little room to breathe.</span></div></div>
      <div class="brush-hint"><span class="hint-dot"></span> Move your cursor. Feel the meadow.</div>`;
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-mode]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          change({ timeMode: button.dataset.mode as TimeMode }),
        ),
      );
    const panel = this.root.querySelector<HTMLElement>("#settings-panel")!;
    this.root
      .querySelector("#settings-toggle")!
      .addEventListener("click", () => {
        panel.hidden = !panel.hidden;
        this.root
          .querySelector("#settings-toggle")!
          .setAttribute("aria-expanded", String(!panel.hidden));
      });
    this.root
      .querySelector("#auto-time")!
      .addEventListener("change", (e) =>
        change({
          timeMode: (e.target as HTMLInputElement).checked ? "auto" : "golden",
        }),
      );
    this.root
      .querySelector("#wind")!
      .addEventListener("input", (e) =>
        change({ windStrength: Number((e.target as HTMLInputElement).value) }),
      );
    this.root
      .querySelector("#radius")!
      .addEventListener("input", (e) =>
        change({
          interactionRadius: Number((e.target as HTMLInputElement).value),
        }),
      );
    this.root
      .querySelector("#interaction")!
      .addEventListener("change", (e) =>
        change({ mouseInteraction: (e.target as HTMLInputElement).checked }),
      );
    this.root
      .querySelector("#density")!
      .addEventListener("change", (e) =>
        change({
          grassDensity: (e.target as HTMLSelectElement).value as Density,
        }),
      );
    this.root
      .querySelector("#quality")!
      .addEventListener("change", (e) =>
        change({
          graphicsQuality: (e.target as HTMLSelectElement).value as Quality,
        }),
      );
    this.root
      .querySelector("#fireflies")!
      .addEventListener("change", (e) =>
        change({ fireflies: (e.target as HTMLInputElement).checked }),
      );
    this.root
      .querySelector("#fps")!
      .addEventListener("change", (e) =>
        change({
          targetFPS: Number((e.target as HTMLSelectElement).value) as 30 | 60,
        }),
      );
    this.root
      .querySelector("#hide-ui")!
      .addEventListener("click", () => change({ showUI: false }));
    window.addEventListener("keydown", this.onKey);
    this.update(settings);
  }
  private onKey = (e: KeyboardEvent) => {
    if (
      e.code === "KeyH" &&
      !(
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement
      )
    )
      this.change({ showUI: this.root.hidden });
    if (e.code === "Escape") {
      this.root.querySelector<HTMLElement>("#settings-panel")!.hidden = true;
      this.root
        .querySelector("#settings-toggle")!
        .setAttribute("aria-expanded", "false");
    }
  };
  update(s: Settings) {
    this.root.hidden = !s.showUI;
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-mode]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(s.timeMode === b.dataset.mode)),
      );
    const set = (id: string, value: string | boolean) => {
      const el = this.root.querySelector<HTMLInputElement | HTMLSelectElement>(
        id,
      )!;
      if (typeof value === "boolean") (el as HTMLInputElement).checked = value;
      else el.value = value;
    };
    set("#auto-time", s.timeMode === "auto");
    set("#wind", String(s.windStrength));
    set("#radius", String(s.interactionRadius));
    set("#interaction", s.mouseInteraction);
    set("#density", s.grassDensity);
    set("#quality", s.graphicsQuality);
    set("#fireflies", s.fireflies);
    set("#fps", String(s.targetFPS));
  }
  dispose() {
    window.removeEventListener("keydown", this.onKey);
    this.root.replaceChildren();
  }
}
