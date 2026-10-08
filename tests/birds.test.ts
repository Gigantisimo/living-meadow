import {test} from "node:test";
import assert from "node:assert/strict";
import {PerspectiveCamera,Vector3} from "three";
import {Birds} from "../src/scene/Birds";
import {heightAt,treePosition,treeScale} from "../src/scene/Terrain";

test("canopy hover launches one flock, respects cooldown, expires and can be disabled",()=>{
  const camera=new PerspectiveCamera(48,16/9,.1,500);
  camera.position.set(0,3.3,13);camera.lookAt(-1.5,7,-25);camera.updateMatrixWorld();
  const canopy=new Vector3(treePosition.x,heightAt(treePosition.x,treePosition.z)+4.3*treeScale,treePosition.z).project(camera);
  const birds=new Birds(camera);
  try {
    birds.point(.95,.95);birds.update(1,0,true);assert.equal(birds.active,false);
    birds.point(canopy.x,canopy.y);birds.update(2,0,true);assert.equal(birds.active,true);
    const launch=birds.mesh.material.uniforms.uLaunch.value;
    birds.point(canopy.x,canopy.y);birds.update(3,0,true);
    assert.equal(birds.mesh.material.uniforms.uLaunch.value,launch,"holding over canopy cannot relaunch");
    birds.leave();birds.point(canopy.x,canopy.y);birds.update(4,0,true);
    assert.equal(birds.mesh.material.uniforms.uLaunch.value,launch,"reentry during cooldown cannot relaunch");
    birds.update(14,0,true);assert.equal(birds.active,false);
    birds.leave();birds.point(canopy.x,canopy.y);birds.update(15,1,false);
    assert.equal(birds.active,false);
    birds.point(canopy.x,canopy.y);birds.update(16,1,true);assert.equal(birds.active,true);
  } finally {birds.dispose();}
});
