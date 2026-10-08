import {test} from "node:test";
import assert from "node:assert/strict";
import {DisturbedFireflies} from "../src/scene/DisturbedFireflies";

test("disturbed fireflies launch locally on movement, expire, and respect toggles", () => {
  const flies = new DisturbedFireflies();
  try {
    const hit = {x: 1, z: 5};
    flies.update(1,0,true,hit,2,1);
    assert.equal(flies.activeCount(1),0);
    flies.update(2,1,true,hit,2,1);
    const initial = flies.activeCount(2);
    assert.ok(initial > 0);
    const positions = flies.points.geometry.attributes.position;
    for (let i=0;i<initial;i++) assert.ok(Math.hypot(positions.getX(i)-hit.x,positions.getZ(i)-hit.z) < 2);
    flies.update(2.5,1,true,hit,2,1);
    assert.equal(flies.activeCount(2.5),initial, "stationary cursor cannot keep spawning");
    flies.update(3,1,true,{x:2,z:5},2,1);
    assert.ok(flies.activeCount(3)>initial);
    flies.update(3.1,1,false,{x:3,z:5},2,1);
    assert.equal(flies.activeCount(3.1),0);
    flies.update(10,1,true,null,2,1);
    assert.equal(flies.activeCount(10),0, "all flights end after their lifetime");
    for(let i=0;i<100;i++) flies.update(11+i*.1,1,true,{x:i%10,z:5},2,1);
    assert.ok(flies.activeCount(21)<=320, "fixed pool stays bounded");
  } finally { flies.dispose(); }
});
