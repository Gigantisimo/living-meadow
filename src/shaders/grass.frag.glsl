uniform vec3 uBase;
uniform vec3 uTips;
uniform vec3 uLight;
uniform vec3 uHaze;
uniform vec3 uSun;
uniform float uNight;
uniform float uFog;
varying vec2 vUv;
varying float vShade;
varying float vVariation;
varying float vDistance;
varying float vTouch;
varying vec3 vWorld;
void main() {
  float t = clamp(vUv.y, 0.0, 1.0);
  vec3 color = mix(uBase * .79, uBase, smoothstep(0.0, .45, t));
  color = mix(color, uTips, pow(t, 2.2) * .64);
  color *= mix(.86 + vVariation * .28, 1.0, smoothstep(18.0, 48.0, vDistance)) * vShade;
  color *= .93 + .07 * sin(vWorld.x*.18 + vWorld.z*.21);
  float ridge = pow(max(0.0, 1.0 - abs(clamp(vUv.x, 0.0, 1.0) * 2.0 - 1.0)), 9.0);
  color *= .86 + .14 * ridge;
  float backlight = pow(max(0.0, dot(normalize(vWorld - cameraPosition), uSun)), 4.0);
  float edge = 1.0 - smoothstep(.0,.32,min(clamp(vUv.x,0.,1.),1.0-clamp(vUv.x,0.,1.)));
  color += uLight * backlight * (pow(t, 2.2)*.14 + edge*t*.06) * (1.0 - uNight);
  // A broad, soft canopy shadow extending toward the observer at sunset.
  vec2 delta = vWorld.xz - vec2(-3.0, -25.0);
  vec2 shadowDelta = delta + uSun.xz * (5.1 / max(uSun.y, .15));
  float shadow = exp(-dot(shadowDelta / vec2(7.2, 12.0), shadowDelta / vec2(7.2, 12.0)));
  color *= 1.0 - shadow * .38 * (1.0 - .65 * uNight);
  color += uLight * pow(t,3.0) * uNight * .008;
  color += vec3(.025, .44, .48) * smoothstep(.5, 1.2, vTouch) * uNight * t * t * .095;
  float fog = 1.0 - exp(-pow(vDistance * uFog, 1.6));
  color = mix(color, uHaze, min(.95, fog));
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
