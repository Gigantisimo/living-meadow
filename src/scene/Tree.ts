import {
  Group,
  Mesh,
  TubeGeometry,
  SphereGeometry,
  CatmullRomCurve3,
  MeshStandardMaterial,
  Vector3,
  BufferGeometry,
  InstancedMesh,
  Float32BufferAttribute,
  Object3D,
  Color,
  DoubleSide,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { heightAt, treePosition, treeScale } from "./Terrain";
import { random } from "../utils";
import type { Palette } from "../systems/TimeOfDay";
export class Tree {
  readonly group = new Group();
  private bark: Mesh<BufferGeometry, MeshStandardMaterial>;
  private leaves: InstancedMesh<BufferGeometry, MeshStandardMaterial>;
  private timeUniform = { value: 0 };
  private windUniform = { value: 0.4 };
  private lightUniform = {value: new Color("#ffd29a")};
  private nightUniform = {value: 0};
  constructor() {
    const rng = random(317);
    this.group.position.set(
      treePosition.x,
      heightAt(treePosition.x, treePosition.z),
      treePosition.z,
    );
    this.group.scale.setScalar(treeScale);
    const wood: BufferGeometry[] = [];
    const tips: Vector3[] = [];
    const branch = (
      start: Vector3,
      end: Vector3,
      radius: number,
      depth: number,
    ) => {
      const dir = new Vector3().subVectors(end, start);
      const midpoint = start.clone().lerp(end, .5);
      midpoint.x += (rng()-.5)*dir.length()*.18;
      midpoint.z += (rng()-.5)*dir.length()*.15;
      const curve = new CatmullRomCurve3([start, midpoint, end]);
      const g = new TubeGeometry(curve, 8, radius, 7, false);
      const positions = g.attributes.position;
      for(let ring=0;ring<=8;ring++) {
        const center = curve.getPointAt(ring/8);
        const taper = 1 - .20*ring/8;
        for(let side=0;side<=7;side++) {
          const index=ring*8+side;
          const point=new Vector3().fromBufferAttribute(positions,index).sub(center).multiplyScalar(taper).add(center);
          positions.setXYZ(index,point.x,point.y,point.z);
        }
      }
      g.computeVertexNormals();
      wood.push(g);
      // Seal curved tube junctions so backlit branches have no sky-coloured cracks.
      const joint = new SphereGeometry(radius * .98, 8, 6);
      joint.translate(start.x, start.y, start.z);
      wood.push(joint);
      if (depth === 0) {
        tips.push(end);
        return;
      }
      const forks = 2;
      for (let i = 0; i < forks; i++) {
        const angle = Math.atan2(dir.z, dir.x) + (i === 0 ? -.8 : 1.25) + (rng() - .5) * 1.5;
        const spread = (.55 + rng() * .85) * (depth === 3 ? 1.1 : .85);
        const next = end
          .clone()
          .add(
            new Vector3(
              Math.cos(angle) * spread,
              (.45 + rng() * .85) * (i === 0 ? 1.1 : .8),
              Math.sin(angle) * spread,
            ),
          );
        branch(end, next, radius * 0.56, depth - 1);
      }
    };
    // A curved leader with staggered lateral limbs, rather than a single symmetric fork.
    branch(new Vector3(), new Vector3(.10, 1.1, -.04), .27, 0);
    branch(new Vector3(.10, 1.1, -.04), new Vector3(-.13, 2.3, .12), .22, 0);
    branch(new Vector3(-.13, 2.3, .12), new Vector3(.34, 3.4, .03), .17, 2);
    branch(new Vector3(.04, 1.6, .02), new Vector3(-1.35, 2.9, .36), .14, 2);
    branch(new Vector3(-.10, 2.15, .10), new Vector3(1.3, 3.0, -.6), .125, 2);
    branch(new Vector3(.08, 2.8, .08), new Vector3(-.5, 3.65, -1.1), .10, 2);
    branch(new Vector3(.22, 3.15, .04), new Vector3(.15, 4.55, .2), .09, 1);
    // Visible root flare and a gently curved trunk.
    for (let i = 0; i < 5; i++) {
      const a = i * 1.256;
      branch(
        new Vector3(0, 0.13, 0),
        new Vector3(Math.cos(a) * 0.67, -0.02, Math.sin(a) * 0.67),
        0.1,
        0,
      );
    }
    const merged = mergeGeometries(wood)!;
    wood.forEach((g) => g.dispose());
    const barkMaterial = new MeshStandardMaterial({
      color: "#65543c",
      roughness: 1,
    });
    this.bark = new Mesh(merged, barkMaterial);
    this.bark.castShadow = true;
    this.bark.receiveShadow = true;
    this.group.add(this.bark);
    const leafGeometry = new BufferGeometry();
    // Curved almond-shaped leaves replace the four sharp diamond facets.
    const leafVertices = [0,.027,0], leafIndices: number[] = [];
    for(let i=0;i<10;i++) {
      const a=i/10*Math.PI*2;
      leafVertices.push(Math.sin(a)*.083, .008*Math.abs(Math.cos(a)), Math.cos(a)*.17);
      leafIndices.push(0,i+1,(i+1)%10+1);
    }
    leafGeometry.setAttribute("position",new Float32BufferAttribute(leafVertices,3));
    leafGeometry.setIndex(leafIndices);
    leafGeometry.computeVertexNormals();
    const leafMaterial = new MeshStandardMaterial({
      color: "#668936",
      roughness: 0.86,
      side: DoubleSide,
    });
    leafMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTreeTime = this.timeUniform;
      shader.uniforms.uTreeWind = this.windUniform;
      shader.uniforms.uTreeLight = this.lightUniform;
      shader.uniforms.uTreeNight = this.nightUniform;
      shader.vertexShader =
        "uniform float uTreeTime;uniform float uTreeWind;varying float vCanopyDepth;varying float vTreeRim;\n" +
        shader.vertexShader;
      shader.fragmentShader = "uniform vec3 uTreeLight;uniform float uTreeNight;varying float vCanopyDepth;varying float vTreeRim;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <lights_fragment_end>", `
        #include <lights_fragment_end>
        reflectedLight.indirectDiffuse *= .72 + .28 * vCanopyDepth;
        reflectedLight.directDiffuse += uTreeLight * vTreeRim * mix(.065, .018, uTreeNight);
      `);
      shader.vertexShader = shader.vertexShader.replace(
        "#include <defaultnormal_vertex>",
        `#include <defaultnormal_vertex>
        #ifdef USE_INSTANCING
          vec3 crownNormal = normalize((instanceMatrix[3].xyz - vec3(.0,4.6,.0)) / vec3(3.0,2.2,2.3));
          transformedNormal = normalMatrix * crownNormal * .65 + transformedNormal * .35;
          vCanopyDepth = clamp(length((instanceMatrix[3].xyz-vec3(0.,4.6,0.))/vec3(3.,2.2,2.3)),0.,1.);
          vTreeRim = smoothstep(.3,3.,instanceMatrix[3].x) * vCanopyDepth;
        #endif`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `\n#include <project_vertex>\n#ifdef USE_INSTANCING\nfloat branchPhase=instanceMatrix[3].x*2.3+instanceMatrix[3].z*1.7;\nvec3 sway=vec3(sin(uTreeTime*1.1+branchPhase)*.07, sin(uTreeTime*1.7+branchPhase)*.026,cos(uTreeTime*.8+branchPhase)*.04)*uTreeWind;\nmvPosition.xyz+=(modelViewMatrix*vec4(sway,0.)).xyz;\ngl_Position=projectionMatrix*mvPosition;\n#endif`,
      );
    };
    const count = 21000;
    this.leaves = new InstancedMesh(leafGeometry, leafMaterial, count);
    const dummy = new Object3D(),
      color = new Color();
    // Overlapping, irregular leaf volumes yield a rounded crown without solid "broccoli" spheres.
    const clusters = tips
      .filter((t) => t.y > 3.6)
      .map((t) => ({center: t.clone().add(new Vector3(0, .15, 0)), radius: .68 + rng() * .62, squash: .65 + rng() * .5}));
    for (let i = 0; i < count; i++) {
      const cluster = clusters[i % clusters.length];
      const center = cluster.center;
      const theta = rng() * Math.PI * 2,
        cos = rng() * 2 - 1,
        r = Math.pow(rng(), 1 / 3) * cluster.radius,
        s = Math.sqrt(1 - cos * cos);
      dummy.position.set(
        center.x + r * s * Math.cos(theta) * 1.2,
        center.y + 0.2 + r * cos * cluster.squash,
        center.z + r * s * Math.sin(theta),
      );
      dummy.rotation.set(rng() * Math.PI, rng() * Math.PI * 2, rng() * Math.PI);
      dummy.scale.setScalar(0.6 + rng() * 0.7);
      dummy.updateMatrix();
      this.leaves.setMatrixAt(i, dummy.matrix);
      const variation = rng();
      color.setHSL(
        0.22 + variation * 0.038,
        0.46 + variation * 0.12,
        0.30 + variation * 0.10,
      );
      this.leaves.setColorAt(i, color);
    }
    this.leaves.castShadow = true;
    this.leaves.receiveShadow = true;
    this.group.add(this.leaves);
  }
  update(time: number, wind: number, p: Palette) {
    this.timeUniform.value = time;
    this.windUniform.value = wind;
    this.lightUniform.value.copy(p.light);this.nightUniform.value=p.night;
    this.group.rotation.z = Math.sin(time * 0.54) * 0.009 * wind;
    this.leaves.material.color
      .set("#d4ddb8")
      .lerp(new Color("#92aaa2"), p.night * 0.40);
    this.bark.material.color
      .set("#73604a")
      .lerp(new Color("#345263"), p.night * 0.65);
  }
  dispose() {
    this.bark.geometry.dispose();
    this.bark.material.dispose();
    this.leaves.geometry.dispose();
    this.leaves.material.dispose();
  }
}
