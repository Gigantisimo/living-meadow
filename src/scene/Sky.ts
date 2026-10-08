import {
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  PerspectiveCamera,
  BufferGeometry,
  Float32BufferAttribute,
  MeshBasicMaterial,
  Color,
  Group,
  DoubleSide,
} from "three";
import fragmentShader from "../shaders/sky.frag.glsl?raw";
import type { Palette } from "../systems/TimeOfDay";
export class Sky {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  readonly mountains = new Group();
  constructor(camera: PerspectiveCamera) {
    this.mesh = new Mesh(
      new PlaneGeometry(2, 2),
      new ShaderMaterial({
        vertexShader:
          "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.99999,1.);}",
        fragmentShader,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          uZenith: { value: null },
          uHorizon: { value: null },
          uSun: { value: null },
          uNight: { value: 0 },
          uTime: { value: 0 },
          uInverseProjection: { value: camera.projectionMatrixInverse },
          uCameraWorld: { value: camera.matrixWorld },
        },
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -100;
    for (let layer = 0; layer < 3; layer++) {
      const vertices: number[] = [],
        indices: number[] = [];
      for (let i = 0; i <= 160; i++) {
        const x = (i / 160 - 0.5) * 1000;
        const y =
          2 +
          Math.sin(x * 0.012 + layer) * 3.2 +
          Math.sin(x * 0.031 + layer * 8) * 1.5 +
          Math.sin(x * 0.064) * 0.6 +
          layer * 2;
        vertices.push(x, y, -180 - layer * 42, x, -35, -180 - layer * 42);
        if (i < 160) {
          const a = i * 2;
          indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
        }
      }
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      g.setIndex(indices);
      const m = new Mesh(
        g,
        new MeshBasicMaterial({
          color: "#9daca9",
          side: DoubleSide,
          fog: false,
        }),
      );
      this.mountains.add(m);
    }
  }
  update(time: number, p: Palette) {
    const u = this.mesh.material.uniforms;
    u.uZenith.value = p.zenith;
    u.uHorizon.value = p.horizon;
    u.uSun.value = p.sun;
    u.uNight.value = p.night;
    u.uTime.value = time;
    this.mountains.children.forEach((child, i) => {
      const m = child as Mesh<BufferGeometry, MeshBasicMaterial>;
      m.material.color
        .copy(p.haze)
        .lerp(p.zenith, 0.13 + (2 - i) * 0.06)
        .multiplyScalar(0.78 + i * 0.065);
    });
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mountains.children.forEach((child) => {
      const m = child as Mesh<BufferGeometry, MeshBasicMaterial>;
      m.geometry.dispose();
      m.material.dispose();
    });
  }
}
