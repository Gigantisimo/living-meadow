import { DoubleSide, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Raycaster, ShaderMaterial, SphereGeometry, Vector2 } from "three";
import { heightAt, treePosition, treeScale } from "./Terrain";
import { random } from "../utils";

/** One instanced flock; the invisible canopy proxy avoids raycasting thousands of leaves. */
export class Birds {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  private readonly canopy = new Mesh(new SphereGeometry(1, 12, 8), new MeshBasicMaterial());
  private readonly ray = new Raycaster();
  private readonly pointer = new Vector2();
  private pending = false;
  private inside = false;
  private launchTime = -1000;
  constructor(private camera: PerspectiveCamera) {
    this.canopy.position.set(treePosition.x, heightAt(treePosition.x, treePosition.z) + 4.3*treeScale, treePosition.z);
    this.canopy.scale.set(3.3*treeScale, 2.1*treeScale, 2.5*treeScale);
    this.canopy.updateMatrixWorld();
    const geometry = new InstancedBufferGeometry();
    // Two tapered wings and a small fuselage, with a gull-like silhouette.
    geometry.setAttribute("position", new Float32BufferAttribute([
      0,0,.08, -.48,0,-.06, -.16,0,-.14,
      0,0,.08, .16,0,-.14, .48,0,-.06,
      -.055,0,-.22, .055,0,-.22, 0,0,.19,
    ],3));
    const rng = random(506), seeds: number[] = [];
    for(let i=0;i<9;i++) seeds.push(rng(),rng(),rng());
    geometry.setAttribute("aSeed",new InstancedBufferAttribute(new Float32Array(seeds),3));
    geometry.instanceCount = 9;
    const material = new ShaderMaterial({
      side: DoubleSide, transparent: true, depthWrite: false,
      uniforms: {uTime:{value:0},uLaunch:{value:-1000},uOrigin:{value:this.canopy.position.clone()},uNight:{value:0}},
      vertexShader: `
        attribute vec3 aSeed;
        uniform float uTime, uLaunch;
        uniform vec3 uOrigin;
        varying float vFade;
        void main(){
          float age = uTime - uLaunch;
          float t = max(0.,age-aSeed.x*.55);
          vec3 p = position;
          p.y += abs(p.x) * sin(t * (10.+aSeed.y*3.)+aSeed.z*6.28) * .8;
          p *= .72 + aSeed.y*.25;
          vec3 flight = vec3((5.+aSeed.y*3.)*t, 1.1*t + sin(t*.7+aSeed.x*4.)*.25, -7.*t);
          p += uOrigin + flight + vec3((aSeed.x-.5)*2.,aSeed.y*.8,(aSeed.z-.5)*2.);
          gl_Position = projectionMatrix * viewMatrix * vec4(p,1.);
          vFade = step(0.,age) * (1.-smoothstep(8.,11.,age));
        }`,
      fragmentShader: `uniform float uNight;varying float vFade;void main(){
        gl_FragColor=vec4(mix(vec3(.055,.07,.045),vec3(.14,.19,.25),uNight),vFade);
        #include <colorspace_fragment>
      }`,
    });
    this.mesh = new Mesh(geometry,material); this.mesh.frustumCulled=false; this.mesh.visible=false;
  }
  point(x: number,y: number) {this.pointer.set(x,y);this.pending=true;}
  leave() {this.inside=false;this.pending=false;}
  update(time: number,night: number,enabled: boolean) {
    if(!enabled) this.leave();
    if(this.pending && enabled) {
      this.camera.updateMatrixWorld();
      this.ray.setFromCamera(this.pointer,this.camera);
      const over = this.ray.intersectObject(this.canopy,false).length>0;
      if(over && !this.inside && time-this.launchTime>12) this.launchTime=time;
      this.inside=over;this.pending=false;
    }
    this.mesh.material.uniforms.uTime.value=time;
    this.mesh.material.uniforms.uLaunch.value=this.launchTime;
    this.mesh.material.uniforms.uNight.value=night;
    this.mesh.visible=time-this.launchTime<11;
  }
  get active() {return this.mesh.visible;}
  dispose() {this.mesh.geometry.dispose();this.mesh.material.dispose();this.canopy.geometry.dispose();this.canopy.material.dispose();}
}
