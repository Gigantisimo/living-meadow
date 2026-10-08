import {
  Group,
  InstancedMesh,
  CylinderGeometry,
  SphereGeometry,
  MeshStandardMaterial,
  Object3D,
  Color,
} from "three";
import { heightAt } from "./Terrain";
import { random } from "../utils";
export class Flowers {
  readonly group = new Group();
  private stems: InstancedMesh;
  private petals: InstancedMesh;
  private centers: InstancedMesh;
  constructor() {
    const count = 55,
      rng = random(637),
      dummy = new Object3D();
    this.stems = new InstancedMesh(
      new CylinderGeometry(0.007, 0.01, 1, 4),
      new MeshStandardMaterial({ color: "#446227", roughness: 1 }),
      count,
    );
    this.petals = new InstancedMesh(
      new SphereGeometry(1, 6, 4),
      new MeshStandardMaterial({
        color: "#fff3d3",
        emissive: "#ad9b7b",
        emissiveIntensity: 0.13,
        roughness: 0.8,
      }),
      count * 5,
    );
    this.centers = new InstancedMesh(
      new SphereGeometry(0.027, 7, 4),
      new MeshStandardMaterial({
        color: "#e6b34d",
        emissive: "#e6b34d",
        emissiveIntensity: 0.08,
        roughness: 0.9,
      }),
      count,
    );
    for (let i = 0; i < count; i++) {
      const x = (rng() * 2 - 1) * 23,
        z = 7 - rng() * 22,
        h = 0.25 + rng() * 0.22,
        y = heightAt(x, z);
      dummy.position.set(x, y + h * 0.5, z);
      dummy.scale.set(1, h, 1);
      dummy.rotation.set(0, 0, (rng() - 0.5) * 0.18);
      dummy.updateMatrix();
      this.stems.setMatrixAt(i, dummy.matrix);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(x, y + h, z);
      dummy.updateMatrix();
      this.centers.setMatrixAt(i, dummy.matrix);
      const col = new Color(i % 7 === 0 ? "#b59fc8" : "#fff3d3");
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * Math.PI * 2;
        dummy.position.set(
          x + Math.sin(a) * 0.04,
          y + h,
          z + Math.cos(a) * 0.04,
        );
        dummy.scale.set(0.025, 0.011, 0.05);
        dummy.rotation.set(0.2, a, 0);
        dummy.updateMatrix();
        this.petals.setMatrixAt(i * 5 + j, dummy.matrix);
        this.petals.setColorAt(i * 5 + j, col);
      }
    }
    this.group.add(this.stems, this.petals, this.centers);
  }
  dispose() {
    for (const mesh of [this.stems, this.petals, this.centers]) {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
    }
  }
}
