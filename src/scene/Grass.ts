import {
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  Float32BufferAttribute,
  ShaderMaterial,
  Mesh,
  DoubleSide,
  Vector4,
  Texture,
  Group,
} from "three";
import vertexShader from "../shaders/grass.vert.glsl?raw";
import fragmentShader from "../shaders/grass.frag.glsl?raw";
import { heightAt, treePosition } from "./Terrain";
import { random } from "../utils";
import { densityCounts, qualityPresets } from "../systems/QualityManager";
import type { Density, Quality } from "../systems/settings";
import type { Palette } from "../systems/TimeOfDay";
export class Grass {
  readonly group = new Group();
  material!: ShaderMaterial;
  bladeCount = 0;
  private lodMaterials: ShaderMaterial[] = [];
  private lodCounts: number[] = [];
  constructor(
    density: Density,
    quality: Quality,
    field: Texture,
    bounds: Vector4,
  ) {
    this.build(density, quality, field, bounds);
  }
  private build(
    density: Density,
    quality: Quality,
    field: Texture,
    bounds: Vector4,
  ) {
    const count = densityCounts[density];
    this.bladeCount = count;
    const buckets = [0, 1, 2, 3].map(() => ({
      roots: [] as number[],
      shapes: [] as number[],
    }));
    const rng = random(7231);
    // Concentrate geometry where a low camera can see it; spread the remaining blades over the crest.
    for (let i = 0; i < count; i++) {
      const zone = rng();
      const near = zone < .78;
      const short = i % 3 === 0;
      const z = short ? 12 - rng() * 26 : zone < .52 ? 12 - Math.pow(rng(), 1.45) * 24
        : near ? -12 - rng() * 23 : -35 - rng() * 56;
      const halfWidth = short ? 3 + (14-z)*.52 : near ? 7 + (14 - z) * 0.53 : 60;
      let x = (rng() * 2 - 1) * halfWidth;
      if (Math.hypot(x - treePosition.x, z - treePosition.z) < 0.6) x += 1.2;
      const bucket = buckets[short ? 3 : z > -5 ? 0 : z > -32 ? 1 : 2];
      bucket.roots.push(x, heightAt(x, z) - 0.035, z);
      const v = rng();
      const clump = 0.5 + 0.5 * Math.sin(x * 0.73 + Math.sin(z * 0.41));
      const distance = Math.max(0, 14 - z);
      const cameraClearance = z > 7 ? 0.4 + (0.6 * (12 - z)) / 5 : 1;
      let h =
        (0.44 + rng() * 0.43 + clump * 0.16) *
        (1 - Math.min(0.3, distance * 0.0025)) *
        cameraClearance;
      // Short blades close the gaps at the roots without raising the whole lawn.
      if (short) h *= .55;
      bucket.shapes.push(h, short ? .028 + rng() * .016 : .011 + rng() * .015, rng() * Math.PI * 2, v);
    }
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      side: DoubleSide,
      uniforms: {
        uDetail: { value: 1 },
        uTime: { value: 0 },
        uWind: { value: 0.4 },
        uField: { value: field },
        uFieldBounds: { value: bounds },
        uBase: { value: null },
        uTips: { value: null },
        uLight: { value: null },
        uSun: { value: null },
        uHaze: { value: null },
        uNight: { value: 0 },
        uFog: { value: 0.01 },
      },
    });
    this.material = material;
    buckets.forEach((bucket, lod) => {
      const segments = lod === 3 ? 3 : Math.max(2, qualityPresets[quality].segments - lod * 3);
      const geometry = new InstancedBufferGeometry();
      const positions: number[] = [],
        uvs: number[] = [],
        indices: number[] = [];
      for (let i = 0; i <= segments; i++) {
        for (let j = 0; j < 2; j++) {
          positions.push(j * 2 - 1, i / segments, 0);
          uvs.push(j, i / segments);
        }
        if (i < segments) {
          const a = i * 2;
          indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      geometry.setAttribute(
        "position",
        new Float32BufferAttribute(positions, 3),
      );
      geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.setAttribute(
        "aRoot",
        new InstancedBufferAttribute(new Float32Array(bucket.roots), 3),
      );
      geometry.setAttribute(
        "aShape",
        new InstancedBufferAttribute(new Float32Array(bucket.shapes), 4),
      );
      geometry.instanceCount = bucket.roots.length / 3;
      geometry.setAttribute("aRank", new InstancedBufferAttribute(
        Float32Array.from({length: geometry.instanceCount}, (_, i) => i / geometry.instanceCount), 1));
      const lodMaterial = material.clone();
      // Share palette/field uniforms; only the per-distance detail threshold differs.
      lodMaterial.uniforms = {...material.uniforms, uDetail: {value: 1}};
      this.lodMaterials.push(lodMaterial);
      this.lodCounts.push(geometry.instanceCount);
      const mesh = new Mesh(geometry, lodMaterial);
      mesh.frustumCulled = false;
      this.group.add(mesh);
    });
  }
  update(time: number, wind: number, p: Palette, field: Texture) {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uWind.value = wind;
    u.uField.value = field;
    u.uBase.value = p.grass;
    u.uTips.value = p.tips;
    u.uLight.value = p.light;
    u.uHaze.value = p.haze;
    u.uSun.value = p.sun;
    u.uNight.value = p.night;
    u.uFog.value = p.fogDensity;
  }
  setDetail(detail: number) {
    this.group.children.forEach((child, lod) => {
      // Preserve the foreground and root cover; reduce mostly the distant blades.
      const fraction = lod === 3 ? 1 : 1 - (1-detail) * [0.25, 1, 1.8][lod];
      this.lodMaterials[lod].uniforms.uDetail.value = fraction;
      (child as Mesh<InstancedBufferGeometry>).geometry.instanceCount =
        Math.min(this.lodCounts[lod], Math.ceil(this.lodCounts[lod] * (fraction + .08)));
    });
  }
  dispose() {
    this.group.children.forEach((mesh) => (mesh as Mesh).geometry.dispose());
    this.material.dispose();
    this.lodMaterials.forEach(material => material.dispose());
  }
}
