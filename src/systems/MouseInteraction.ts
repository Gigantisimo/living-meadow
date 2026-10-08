import {
  WebGLRenderTarget,
  HalfFloatType,
  LinearFilter,
  Scene,
  OrthographicCamera,
  PlaneGeometry,
  ShaderMaterial,
  Mesh,
  Vector2,
  Vector4,
  Raycaster,
  PerspectiveCamera,
  WebGLRenderer,
  Color,
  DataUtils,
} from "three";
import fieldFragment from "../shaders/field.frag.glsl?raw";
import type { Terrain } from "../scene/Terrain";
import { clamp } from "../utils";
export class MouseInteraction {
  readonly bounds = new Vector4(-65, -88, 130, 104);
  private targets: WebGLRenderTarget[];
  private simulation = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: ShaderMaterial;
  private quad: Mesh;
  private ray = new Raycaster();
  private pointer = new Vector2(-10, -10);
  private start = new Vector2();
  private end = new Vector2();
  private direction = new Vector2();
  private lastEvent = 0;
  private lastHit = 0;
  private dirty = false;
  private stroke = false;
  private speed = 0;
  private strength = 0;
  enabled = true;
  radius = 2.1;
  hit: { x: number; z: number } | null = null;
  get texture() {
    return this.targets[0].texture;
  }
  constructor(
    private canvas: HTMLCanvasElement,
    private view: PerspectiveCamera,
    private terrain: Terrain,
    private renderer: WebGLRenderer,
    size: number,
  ) {
    if (!renderer.extensions.has("EXT_color_buffer_float"))
      throw new Error(
        "This GPU does not support the floating-point WebGL 2 buffers required for interactive grass.",
      );
    this.targets = [0, 1].map(
      () =>
        new WebGLRenderTarget(size, size, {
          type: HalfFloatType,
          minFilter: LinearFilter,
          magFilter: LinearFilter,
          depthBuffer: false,
          stencilBuffer: false,
        }),
    );
    this.material = new ShaderMaterial({
      vertexShader:
        "varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}",
      fragmentShader: fieldFragment,
      uniforms: {
        uPrevious: { value: this.texture },
        uDt: { value: 0 },
        uBounds: { value: this.bounds },
        uStart: { value: this.start },
        uEnd: { value: this.end },
        uDirection: { value: this.direction },
        uRadius: { value: this.radius },
        uStrength: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.simulation.add(this.quad);
    const old = renderer.getClearColor(new Color()).clone(),
      alpha = renderer.getClearAlpha();
    renderer.setClearColor(0, 0);
    for (const target of this.targets) {
      renderer.setRenderTarget(target);
      renderer.clear();
    }
    renderer.setRenderTarget(null);
    renderer.setClearColor(old, alpha);
    window.addEventListener("pointermove", this.onMove, { passive: true });
    window.addEventListener("mouseout", this.onLeave);
  }
  private onLeave = (event: MouseEvent) => {
    if (!event.relatedTarget) this.resetPointer();
  };
  resetPointer() {
    this.hit = null;
    this.stroke = false;
    this.dirty = false;
    this.strength = 0;
  }
  private onMove = (event: PointerEvent) => {
    if (
      !this.enabled ||
      (event.target instanceof Element && event.target.closest("#controls"))
    )
      return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((event.clientY - rect.top) / rect.height) * 2,
    );
    this.lastEvent = performance.now();
    this.dirty = true;
  };
  update(dt: number) {
    const now = performance.now();
    if (this.dirty && this.enabled) {
      this.ray.setFromCamera(this.pointer, this.view);
      const intersection = this.ray.intersectObject(
        this.terrain.mesh,
        false,
      )[0];
      if (intersection) {
        const next = new Vector2(intersection.point.x, intersection.point.z);
        const eventDt = Math.max(0.012, (this.lastEvent - this.lastHit) / 1000);
        const continuous =
          this.stroke &&
          now - this.lastHit < 160 &&
          next.distanceTo(this.end) < 14;
        this.start.copy(continuous ? this.end : next);
        this.end.copy(next);
        this.direction.subVectors(this.end, this.start);
        this.speed = continuous ? this.direction.length() / eventDt : 0;
        if (this.direction.lengthSq() > 0.0001) this.direction.normalize();
        this.strength = continuous
          ? clamp(0.3 + this.speed * 0.045, 0.3, 2.5)
          : 0.12;
        this.stroke = true;
        this.lastHit = this.lastEvent;
        this.hit = { x: next.x, z: next.y };
      } else this.resetPointer();
      this.dirty = false;
    } else {
      this.start.copy(this.end);
      this.strength *= Math.exp(-dt * 18);
    }
    if (!this.enabled || now - this.lastEvent > 180) this.strength = 0;
    const steps = Math.max(1, Math.ceil(dt / 0.016));
    for (let i = 0; i < steps; i++) {
      const u = this.material.uniforms;
      u.uPrevious.value = this.targets[0].texture;
      u.uDt.value = dt / steps;
      u.uRadius.value = this.radius;
      u.uStrength.value = this.strength;
      this.renderer.setRenderTarget(this.targets[1]);
      this.renderer.render(this.simulation, this.camera);
      this.targets.reverse();
    }
    this.renderer.setRenderTarget(null);
  }
  resize(size: number) {
    for (const target of this.targets) target.setSize(size, size);
    this.clear();
  }
  fieldStats() {
    const target = this.targets[0],
      data = new Uint16Array(target.width * target.height * 4);
    this.renderer.readRenderTargetPixels(
      target,
      0,
      0,
      target.width,
      target.height,
      data,
    );
    let max = 0,
      energy = 0,
      cells = 0;
    for (let i = 0; i < data.length; i += 4) {
      const length = Math.hypot(
        DataUtils.fromHalfFloat(data[i]),
        DataUtils.fromHalfFloat(data[i + 1]),
      );
      max = Math.max(max, length);
      energy += length;
      if (length > 0.02) cells++;
    }
    return {
      max,
      energy,
      affectedFraction: cells / (target.width * target.height),
    };
  }
  clear() {
    const old = this.renderer.getClearColor(new Color()).clone(),
      alpha = this.renderer.getClearAlpha();
    this.renderer.setClearColor(0, 0);
    for (const target of this.targets) {
      this.renderer.setRenderTarget(target);
      this.renderer.clear();
    }
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(old, alpha);
    this.resetPointer();
  }
  dispose() {
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("mouseout", this.onLeave);
    for (const target of this.targets) target.dispose();
    this.quad.geometry.dispose();
    this.material.dispose();
  }
}
