import { HemisphereLight, DirectionalLight, Scene, FogExp2 } from "three";
import type { Palette } from "../systems/TimeOfDay";
export class Lighting {
  readonly fill = new HemisphereLight("#cbdcdd", "#253719", 2.1);
  readonly sun = new DirectionalLight("#ffcf97", 3);
  constructor(private scene: Scene) {
    this.sun.target.position.set(-3, 6, -25);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -18,
      right: 18,
      top: 18,
      bottom: -18,
      near: 1,
      far: 130,
    });
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 3;
    scene.add(this.fill, this.sun, this.sun.target);
    scene.fog = new FogExp2("#b6ac87", 0.009);
  }
  update(p: Palette) {
    this.sun.position.copy(this.sun.target.position).addScaledVector(p.sun, 65);
    this.sun.color.copy(p.light);
    this.sun.intensity = p.intensity;
    this.fill.color.copy(p.ambient);
    this.fill.groundColor.copy(p.grass).multiplyScalar(0.3);
    this.fill.intensity = 1.65 - p.night * .70;
    const fog = this.scene.fog as FogExp2;
    fog.color.copy(p.haze);
    fog.density = p.fogDensity;
  }
  dispose() {
    this.sun.shadow.dispose();
  }
}
