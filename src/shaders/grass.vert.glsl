attribute vec3 aRoot;
attribute vec4 aShape;
attribute float aRank;
uniform float uDetail;
uniform float uTime;
uniform float uWind;
uniform sampler2D uField;
uniform vec4 uFieldBounds;
uniform vec3 uSun;
varying vec2 vUv;
varying float vShade;
varying float vVariation;
varying float vDistance;
varying float vTouch;
varying vec3 vWorld;
void main() {
  float t = uv.y;
  float angle = aShape.z + sin(aShape.w * 12.0) * t * t * .24;
  vec2 side = vec2(cos(angle), sin(angle));
  vec2 forward = vec2(-side.y, side.x);
  float h = aShape.x * (1.0 - smoothstep(uDetail, uDetail + .08, aRank));
  float phase = aShape.w * 6.28318;
  vec2 fieldUv = (aRoot.xz - uFieldBounds.xy) / uFieldBounds.zw;
  vec2 bend = texture2D(uField, clamp(fieldUv, 0.001, 0.999)).rg;
  float inside = step(0.0, fieldUv.x) * step(fieldUv.x, 1.0) * step(0.0, fieldUv.y) * step(fieldUv.y, 1.0);
  bend *= inside;
  float wave = sin(aRoot.x * .37 + aRoot.z * .22 + uTime * 1.2)
             + .4 * sin(aRoot.z * .71 - aRoot.x * .15 + uTime * 1.85 + phase)
             + .16 * sin(uTime * 3.2 + phase * 3.0);
  vec2 wind = vec2(1.0, .38) * (wave * .26 + .24) * uWind;
  vec2 natural = forward * (.19 + .50 * aShape.w);
  vec2 offset = (wind + natural + bend) * h * t * t * (1.15 - .15*t);
  float width = aShape.y * pow(max(0.0, 1.0 - t), 1.35);
  width *= 1.0 + smoothstep(30.0, 65.0, length(cameraPosition-aRoot)) * .35;
  vec3 p = aRoot + vec3(side.x * position.x * width, t * h, side.y * position.x * width);
  p.xz += offset;
  p.xz += forward * sin(t * 3.14159) * h * .055;
  p.y -= min(.72, length(wind + natural + bend) * .28) * h * t * t;
  // Double-sided ribbon bends over seven joints; the central ridge is shaded per fragment.
  vec3 n = normalize(vec3(forward.x, .28 + t * .4, forward.y));
  float diffuse = abs(dot(n, uSun));
  vShade = .68 + .32 * diffuse;
  vVariation = aShape.w;
  vTouch = length(bend);
  vDistance = length(cameraPosition - p);
  vUv = uv;
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
