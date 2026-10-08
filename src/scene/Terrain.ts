import { PlaneGeometry, Mesh, MeshStandardMaterial, Color } from "three";
export function heightAt(x: number, z: number) {
  const hill = 8.5 * Math.exp(-((x + 2) ** 2 / 850 + (z + 24) ** 2 / 1000));
  const rolls =
    0.32 * Math.sin(x * 0.14 + z * 0.1) + 0.18 * Math.cos(z * 0.22 - x * 0.07);
  const crest = 1.1 * Math.exp(-((x + 3) ** 2 / 220 + (z + 25) ** 2 / 340));
  const shoulder = .65 * Math.exp(-((x - 17) ** 2 / 240 + (z + 13) ** 2 / 430));
  return hill + crest + shoulder + rolls - 0.35;
}
export const treePosition = { x: -3, z: -25 };
export const treeScale = 1.65;
export class Terrain {
  readonly mesh: Mesh<PlaneGeometry, MeshStandardMaterial>;
  constructor() {
    const geometry = new PlaneGeometry(220, 220, 180, 180);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0, -60);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++)
      positions.setY(i, heightAt(positions.getX(i), positions.getZ(i)));
    geometry.computeVertexNormals();
    const material = new MeshStandardMaterial({
      color: "#273b12",
      roughness: 1,
    });
    this.mesh = new Mesh(geometry, material);
    this.mesh.receiveShadow = true;
  }
  update(color: Color) {
    this.mesh.material.color.copy(color).multiplyScalar(0.60);
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
