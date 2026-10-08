import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  ACESFilmicToneMapping,
  SRGBColorSpace,
  PCFSoftShadowMap,
} from "three";
import { Terrain } from "./Terrain";
import { Grass } from "./Grass";
import { Tree } from "./Tree";
import { Sky } from "./Sky";
import { Lighting } from "./Lighting";
import { Flowers } from "./Flowers";
import { Particles } from "./Particles";
import { DisturbedFireflies } from "./DisturbedFireflies";
import { Birds } from "./Birds";
import { TimeOfDay } from "../systems/TimeOfDay";
import { WindSystem } from "../systems/WindSystem";
import { MouseInteraction } from "../systems/MouseInteraction";
import { renderRatio, AdaptiveDetail, qualityPresets } from "../systems/QualityManager";
import { saveSettings, type Settings } from "../systems/settings";
import { Controls } from "../ui/controls";
import { installLively } from "../integrations/lively";
export class MeadowScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(48, 1, 0.1, 500);
  readonly renderer: WebGLRenderer;
  readonly terrain = new Terrain();
  readonly tree = new Tree();
  readonly flowers = new Flowers();
  readonly particles = new Particles();
  readonly disturbedFireflies = new DisturbedFireflies();
  readonly birds = new Birds(this.camera);
  readonly time = new TimeOfDay();
  readonly wind = new WindSystem();
  readonly mouse: MouseInteraction;
  readonly sky: Sky;
  readonly lighting: Lighting;
  grass: Grass;
  private ui: Controls;
  private removeLively: () => void;
  private frame = 0;
  private adaptive = new AdaptiveDetail();
  private resolutionTimer = 0;
  private lastFrame = 0;
  private lastActivity = performance.now();
  private livelyPaused = false;
  private contextLost = false;
  private disposed = false;
  private metrics = {
    fps: 0,
    frames: 0,
    seconds: 0,
    drawCalls: 0,
    triangles: 0,
  };
  private qualityTimer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private canvas: HTMLCanvasElement,
    readonly settings: Settings,
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.13;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.info.autoReset = false;
    this.camera.position.set(0, 3.3, 13);
    this.camera.lookAt(-1.5, 8.8, -25);
    this.camera.updateMatrixWorld();
    this.scene.add(
      this.terrain.mesh,
      this.tree.group,
      this.flowers.group,
      this.particles.points,
      this.disturbedFireflies.points,
      this.birds.mesh,
    );
    this.sky = new Sky(this.camera);
    this.scene.add(this.sky.mesh, this.sky.mountains);
    this.lighting = new Lighting(this.scene);
    this.time.setMode(settings.timeMode, true);
    this.mouse = new MouseInteraction(
      canvas,
      this.camera,
      this.terrain,
      this.renderer,
      qualityPresets[settings.graphicsQuality].field,
    );
    this.grass = new Grass(
      settings.grassDensity,
      settings.graphicsQuality,
      this.mouse.texture,
      this.mouse.bounds,
    );
    this.scene.add(this.grass.group);
    this.ui = new Controls(settings, (patch) => this.applySettings(patch));
    this.removeLively = installLively(
      (patch) => this.applySettings(patch, true),
      (paused) => {
        this.livelyPaused = paused;
        this.refreshPlayback();
      },
    );
    this.mouse.enabled = settings.mouseInteraction;
    this.mouse.radius = settings.interactionRadius;
    this.wind.strength = settings.windStrength / 100;
    this.onResize();
    window.addEventListener("resize", this.onResize);
    window.addEventListener("pointermove", this.onActivity, { passive: true });
    window.addEventListener("pointermove", this.onBirdPointer, { passive: true });
    window.addEventListener("blur", this.onBirdLeave);
    document.addEventListener("visibilitychange", this.refreshPlayback);
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    this.lighting.update(this.time.current);
    this.renderer.shadowMap.needsUpdate = true;
    this.frame = requestAnimationFrame(this.tick);
  }
  applySettings(patch: Partial<Settings>, fromLively = false) {
    const rebuild =
      (patch.grassDensity !== undefined &&
        patch.grassDensity !== this.settings.grassDensity) ||
      (patch.graphicsQuality !== undefined &&
        patch.graphicsQuality !== this.settings.graphicsQuality);
    Object.assign(this.settings, patch);
    if (patch.timeMode) this.time.setMode(patch.timeMode);
    this.mouse.enabled = this.settings.mouseInteraction;
    this.mouse.radius = this.settings.interactionRadius;
    this.wind.strength = this.settings.windStrength / 100;
    if (!this.mouse.enabled) this.mouse.clear();
    if (rebuild) {
      clearTimeout(this.qualityTimer);
      // Lively initializes all properties consecutively; batch expensive buffer rebuilds.
      this.qualityTimer = setTimeout(() => {
        if (this.disposed) return;
        this.scene.remove(this.grass.group);
        this.grass.dispose();
        this.mouse.resize(qualityPresets[this.settings.graphicsQuality].field);
        this.grass = new Grass(
          this.settings.grassDensity,
          this.settings.graphicsQuality,
          this.mouse.texture,
          this.mouse.bounds,
        );
        this.scene.add(this.grass.group);
        this.onResize();
      }, 100);
    }
    if (fromLively) this.lastActivity = performance.now();
    else saveSettings(this.settings);
    this.ui.update(this.settings);
    this.onActivity();
  }
  private onActivity = () => {
    this.lastActivity = performance.now();
  };
  private onBirdLeave = () => this.birds.leave();
  private onBirdPointer = (event: PointerEvent) => {
    if(event.target instanceof Element && event.target.closest("#controls")) {this.birds.leave();return;}
    const rect=this.canvas.getBoundingClientRect();
    this.birds.point((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
  };
  private onResize = () => {
    this.camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(
      renderRatio(this.settings.graphicsQuality, window.devicePixelRatio, window.innerWidth, window.innerHeight, .75 + .25*this.adaptive.value),
    );
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  };
  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.contextLost = true;
    this.refreshPlayback();
  };
  private onContextRestored = () => {
    this.contextLost = false;
    this.mouse.clear();
    this.renderer.shadowMap.needsUpdate = true;
    this.refreshPlayback();
  };
  private refreshPlayback = () => {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.lastFrame = 0;
    this.mouse.resetPointer();
    if (
      !this.disposed &&
      !document.hidden &&
      !this.livelyPaused &&
      !this.contextLost
    )
      this.frame = requestAnimationFrame(this.tick);
  };
  private tick = (now: number) => {
    if (
      this.disposed ||
      document.hidden ||
      this.livelyPaused ||
      this.contextLost
    ) {
      this.frame = 0;
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
    const idle = now - this.lastActivity > 45000 && !this.time.transitioning;
    const fps = idle
      ? Math.min(30, this.settings.targetFPS)
      : this.settings.targetFPS;
    if (this.lastFrame && now - this.lastFrame < 1000 / fps - 0.75) return;
    const elapsed = this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / fps;
    const dt = Math.min(0.15, elapsed);
    this.lastFrame = now;
    this.adaptive.update(elapsed, fps, !idle && !this.time.transitioning);
    this.grass.setDetail(this.adaptive.value);
    this.resolutionTimer += elapsed;
    if(this.resolutionTimer > 3) {
      this.resolutionTimer = 0;
      const ratio = renderRatio(this.settings.graphicsQuality, window.devicePixelRatio, window.innerWidth, window.innerHeight, .75 + .25*this.adaptive.value);
      if(Math.abs(ratio-this.renderer.getPixelRatio()) > .015) this.onResize();
    }
    this.renderer.info.reset();
    // Lighting must take 2.7 wall-clock seconds even on a slow GPU.
    // Only the spring field needs a bounded simulation step.
    this.time.update(elapsed);
    this.wind.update(elapsed);
    this.mouse.update(dt);
    const p = this.time.current;
    this.sky.update(this.wind.time, p);
    this.lighting.update(p);
    this.terrain.update(p.grass);
    this.grass.update(this.wind.time, this.wind.gust, p, this.mouse.texture);
    this.tree.update(this.wind.time, this.wind.gust, p);
    this.birds.update(this.wind.time,p.night,this.settings.mouseInteraction);
    this.particles.update(
      this.wind.time,
      p.night,
      this.settings.fireflies,
      this.renderer.getPixelRatio(),
    );
    this.disturbedFireflies.update(this.wind.time, p.night,
      this.settings.fireflies && this.settings.mouseInteraction, this.mouse.hit,
      this.settings.interactionRadius, this.renderer.getPixelRatio());
    if (this.time.transitioning) this.renderer.shadowMap.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
    this.metrics.frames++;
    this.metrics.seconds += elapsed;
    if (this.metrics.seconds > 1) {
      this.metrics.fps = this.metrics.frames / this.metrics.seconds;
      this.metrics.frames = 0;
      this.metrics.seconds = 0;
    }
    this.metrics.drawCalls = this.renderer.info.render.calls;
    this.metrics.triangles = this.renderer.info.render.triangles;
  };
  diagnostics(includeField = false) {
    const gl = this.renderer.getContext(),
      debug = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      settings: { ...this.settings },
      fps: Math.round(this.metrics.fps * 10) / 10,
      drawCalls: this.metrics.drawCalls,
      triangles: this.metrics.triangles,
      blades: this.grass.bladeCount,
      adaptiveDetail: this.adaptive.value,
      grassDrawCalls: this.grass.group.children.length,
      night: this.time.current.night,
      transitioning: this.time.transitioning,
      mouseHit: this.mouse.hit,
      risingFireflies: this.disturbedFireflies.activeCount(this.wind.time),
      birdsFlying: this.birds.active,
      paused: this.livelyPaused || document.hidden || this.contextLost,
      time: this.wind.time,
      resources: { ...this.renderer.info.memory },
      resolution: { width: this.canvas.width, height: this.canvas.height },
      field: includeField ? this.mouse.fieldStats() : undefined,
      gpu: debug
        ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.qualityTimer);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("pointermove", this.onActivity);
    window.removeEventListener("pointermove", this.onBirdPointer);
    window.removeEventListener("blur", this.onBirdLeave);
    document.removeEventListener("visibilitychange", this.refreshPlayback);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas.removeEventListener(
      "webglcontextrestored",
      this.onContextRestored,
    );
    this.removeLively();
    this.ui.dispose();
    this.mouse.dispose();
    this.grass.dispose();
    this.terrain.dispose();
    this.tree.dispose();
    this.flowers.dispose();
    this.sky.dispose();
    this.particles.dispose();
    this.disturbedFireflies.dispose();
    this.birds.dispose();
    this.lighting.dispose();
    this.renderer.dispose();
  }
}
