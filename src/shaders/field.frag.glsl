uniform sampler2D uPrevious;
uniform float uDt;
uniform vec4 uBounds;
uniform vec2 uStart;
uniform vec2 uEnd;
uniform vec2 uDirection;
uniform float uRadius;
uniform float uStrength;
varying vec2 vUv;
void main() {
  vec4 state = texture2D(uPrevious, vUv);
  vec2 offset = state.rg;
  vec2 velocity = state.ba;
  vec2 world = uBounds.xy + vUv * uBounds.zw;
  vec2 segment = uEnd - uStart;
  float along = clamp(dot(world - uStart, segment) / max(dot(segment, segment), .0001), 0.0, 1.0);
  vec2 radial = world - mix(uStart, uEnd, along);
  float r = length(radial) / uRadius;
  float influence = pow(max(0.0, 1.0 - r), 2.0);
  vec2 force = (uDirection * 1.3 + radial / max(length(radial), .1) * .55) * influence * uStrength;
  // Semi-implicit spring: critically bounded dt; underdamped return leaves a small settling ripple.
  velocity += (force * 47.0 - offset * 24.0 - velocity * 6.8) * uDt;
  velocity = clamp(velocity, vec2(-8.0), vec2(8.0));
  offset += velocity * uDt;
  offset = clamp(offset, vec2(-1.6), vec2(1.6));
  gl_FragColor = vec4(offset, velocity);
}
