import { AdditiveBlending, BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Points, ShaderMaterial } from "three";
import { heightAt } from "./Terrain";
import { random } from "../utils";

/** Fixed pool: JS only launches small bursts; flight, blinking and fading run on the GPU. */
export class DisturbedFireflies {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  private readonly rng = random(812);
  private readonly capacity = 128;
  private cursor = 0;
  private previous: {x: number; z: number} | null = null;
  private lastBurst = -100;
  private readonly origins = new Float32BufferAttribute(new Float32Array(this.capacity * 3), 3).setUsage(DynamicDrawUsage);
  private readonly launches = new Float32BufferAttribute(new Float32Array(this.capacity * 3), 3).setUsage(DynamicDrawUsage);
  constructor() {
    for (let i = 0; i < this.capacity; i++) this.launches.setXYZ(i, -1000, this.rng(), this.rng());
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", this.origins);
    geometry.setAttribute("aLaunch", this.launches);
    const material = new ShaderMaterial({
      transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: {uTime: {value: 0}, uNight: {value: 0}, uRatio: {value: 1}},
      vertexShader: `
        attribute vec3 aLaunch;
        uniform float uTime, uNight, uRatio;
        varying float vAlpha, vSeed;
        void main() {
          float age = uTime - aLaunch.x;
          float alive = step(0., age) * (1. - step(3.8, age));
          float t = max(0., age);
          float phase = aLaunch.y * 6.28318;
          vec3 p = position;
          p.y += t * (.24 + aLaunch.z * .12) + sin(t * 2. + phase) * .10;
          p.xz += vec2(cos(phase), sin(phase)) * t * .18
            + vec2(sin(t * 1.4 + phase)-sin(phase),cos(t * 1.1 + phase)-cos(phase)) * .22;
          vec4 view = modelViewMatrix * vec4(p,1.);
          gl_Position = projectionMatrix * view;
          gl_PointSize = clamp((30. + aLaunch.z * 28.) / max(1., -view.z), 2., 8.) * uRatio;
          vAlpha = alive * smoothstep(0., .3, t) * (1. - smoothstep(2.4,3.8,t))
            * (.65 + .35 * sin(t * 5. + phase)) * uNight;
          vSeed = aLaunch.z;
        }`,
      fragmentShader: `
        varying float vAlpha, vSeed;
        void main() {
          float r = length(gl_PointCoord - .5) * 2.;
          float halo = exp(-r*r*4.) * (1. - smoothstep(.75,1.,r));
          vec3 color = mix(vec3(.35,1.,.70), vec3(.95,1.,.45), vSeed);
          gl_FragColor = vec4(color * 1.3, halo * vAlpha);
          #include <colorspace_fragment>
        }`,
    });
    this.points = new Points(geometry, material);
    this.points.frustumCulled = false;
  }
  update(time: number, night: number, enabled: boolean, hit: {x: number; z: number} | null, radius: number, ratio: number) {
    const u = this.points.material.uniforms;
    u.uTime.value = time; u.uNight.value = night; u.uRatio.value = ratio;
    this.points.visible = enabled && night > .01;
    if (!this.points.visible || !hit) { this.previous = null; return; }
    const distance = this.previous ? Math.hypot(hit.x - this.previous.x, hit.z - this.previous.z) : 1;
    if (distance > .13 && time - this.lastBurst > .12) {
      const count = Math.min(7, 2 + Math.ceil(distance * 2));
      for (let i = 0; i < count; i++) {
        const a = this.rng() * Math.PI * 2, r = Math.sqrt(this.rng()) * radius * .65;
        const x = hit.x + Math.cos(a) * r, z = hit.z + Math.sin(a) * r;
        this.origins.setXYZ(this.cursor, x, heightAt(x,z) + .55 + this.rng() * .25, z);
        this.launches.setXYZ(this.cursor, time, this.rng(), this.rng());
        this.cursor = (this.cursor + 1) % this.capacity;
      }
      this.origins.needsUpdate = true; this.launches.needsUpdate = true;
      this.lastBurst = time; this.previous = {...hit};
    }
  }
  activeCount(time: number) {
    if (!this.points.visible) return 0;
    let active = 0;
    for (let i = 0; i < this.capacity; i++) {
      const age = time - this.launches.getX(i);
      if (age >= 0 && age < 3.8) active++;
    }
    return active;
  }
  dispose() { this.points.geometry.dispose(); this.points.material.dispose(); }
}
