import {
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  Points,
  AdditiveBlending,
} from "three";
import { heightAt } from "./Terrain";
import { random } from "../utils";
export class Particles {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  constructor() {
    const rng = random(171),
      positions: number[] = [],
      seeds: number[] = [];
    for (let i = 0; i < 210; i++) {
      const x = (rng() - 0.5) * 62,
        z = 10 - rng() * 67;
      positions.push(x, heightAt(x, z) + 0.8 + rng() * 4, z);
      seeds.push(rng(), rng());
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new Float32BufferAttribute(seeds, 2));
    this.points = new Points(
      geometry,
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uNight: { value: 0 },
          uFireflies: { value: 1 },
          uRatio: { value: 1 },
        },
        vertexShader: `attribute vec2 aSeed;uniform float uTime;uniform float uNight;uniform float uRatio;varying float vPulse;varying float vNight;void main(){vec3 p=position;float t=uTime*(.17+aSeed.x*.18);p+=vec3(sin(t+aSeed.x*70.)*1.5,sin(t*.83+aSeed.y*30.)*.6,cos(t*.7+aSeed.x*30.)*1.4);vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;gl_PointSize=clamp((uNight*110.+15.)/(-view.z),1.,9.)*uRatio;vPulse=.3+.7*pow(.5+.5*sin(uTime*(1.+aSeed.x)+aSeed.y*70.),2.);vNight=uNight;}`,
        fragmentShader:
          `uniform float uFireflies;varying float vPulse;varying float vNight;void main(){float r=length(gl_PointCoord-.5)*2.;float glow=exp(-r*r*5.)*(1.-smoothstep(.75,1.,r));vec3 color=mix(vec3(.55,.40,.2),vec3(.50,.95,.35),vNight);float a=glow*mix(.16,vPulse*uFireflies,vNight);gl_FragColor=vec4(color*a,a);#include <colorspace_fragment>}`.replace(
            "#include",
            "\n#include",
          ),
      }),
    );
    this.points.frustumCulled = false;
  }
  update(time: number, night: number, enabled: boolean, ratio: number) {
    const u = this.points.material.uniforms;
    u.uTime.value = time;
    u.uNight.value = night;
    u.uFireflies.value = enabled ? 1 : 0;
    u.uRatio.value = ratio;
  }
  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
