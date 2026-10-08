uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSun;
uniform float uNight;
uniform float uTime;
uniform mat4 uInverseProjection;
uniform mat4 uCameraWorld;
varying vec2 vUv;
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
}
float fbm(vec2 p) {
  float f = 0.; float a = .5;
  for(int i=0;i<4;i++){f+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.1;a*=.5;}
  return f;
}
float brightStar(vec2 skyPoint, vec2 starPoint) {
  vec2 d = skyPoint - starPoint;
  return exp(-dot(d,d) / .000004);
}
void main() {
  vec4 eye = uInverseProjection * vec4(vUv*2.-1., 1., 1.);
  vec3 ray = normalize((uCameraWorld * vec4(eye.xyz,0.)).xyz);
  // Grass and terrain cover this region. Avoid expensive cloud/galaxy noise
  // below the horizon while still providing a valid background colour.
  if(ray.y < .02) {
    gl_FragColor=vec4(uHorizon,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    return;
  }
  float altitude = max(ray.y,0.);
  vec3 sky = mix(uHorizon, uZenith, pow(clamp(altitude*1.6,0.,1.),.65));
  float angle = max(0., dot(ray,uSun));
  float halo = pow(angle,45.)*.28 + pow(angle,350.)*.48 + pow(angle,1600.)*.15;
  sky += mix(vec3(1.,.47,.18),vec3(.13,.23,.46),uNight)*halo;
  float disc = smoothstep(.99967,.99976,angle);
  vec3 sunColor = mix(vec3(2.2,1.5,.69),vec3(1.1,1.4,1.8),uNight);
  // Craters and a shaded crescent edge are procedural, never a flat image.
  float craters = 1.;
  if (disc > .001 && uNight > .001) {
    vec2 moonUV = (ray.xz - uSun.xz) * 130.;
    craters = .78 + .22 * fbm(moonUV * 2.);
  }
  sky += sunColor * disc * mix(1.,craters,uNight);
  vec2 cloudUV = ray.xz / max(.11,ray.y+.15) * 1.8;
  cloudUV += vec2(uTime*.005,0.);
  float cloud = fbm(cloudUV*1.2 + vec2(12.,23.));
  float wisps = fbm(cloudUV*vec2(.6,2.3)+cloud*.7);
  float mask = smoothstep(.45,.72,cloud*.62+wisps*.38) * smoothstep(.0,.12,ray.y) * (1.-smoothstep(.42,.8,ray.y));
  sky = mix(sky, mix(uHorizon*.86+vec3(.08),vec3(.065,.095,.16),uNight),mask*.57);
  // Stable celestial coordinates; stars twinkle slowly, not frame-to-frame noise.
  vec2 starUV = vec2(atan(ray.x,-ray.z),asin(clamp(ray.y,-1.,1.))) * 245.;
  vec2 cell = floor(starUV), f = fract(starUV)-.5;
  float h = hash(cell);
  float star = pow(max(0.,1.-length(f)*4.8),5.) * step(.987,h);
  star *= .62 + .38*sin(uTime*.7+h*80.);
  sky += vec3(.65,.82,1.) * star * uNight * smoothstep(.03,.18,ray.y) * 1.4;
  // A broad celestial band with soft dust lanes, stable as the wind moves clouds.
  if (uNight > .001) {
    float band = exp(-pow((ray.x + ray.y*.72 + .05) * 6., 2.));
    if(band > .01) {
    float dust = fbm(ray.xy*22.+vec2(53.,9.));
    float veil = band * (.3 + .7*dust) * smoothstep(.06,.23,ray.y);
    sky += mix(vec3(.06,.10,.17),vec3(.13,.10,.19),dust) * veil * uNight * (1.-mask*.75);
    vec2 galaxyUV = starUV * 1.35;
    float tiny = pow(max(0.,1.-length(fract(galaxyUV)-.5)*5.),4.) * step(.975,hash(floor(galaxyUV)));
    sky += vec3(.38,.46,.65) * tiny * veil * uNight;
    }
    // A seven-star dipper-shaped asterism, brighter than the background stars.
    vec2 celestial = starUV / 245.;
    float dipper = brightStar(celestial,vec2(-.38,.38))
      + brightStar(celestial,vec2(-.31,.40)) + brightStar(celestial,vec2(-.25,.35))
      + brightStar(celestial,vec2(-.19,.37)) + brightStar(celestial,vec2(-.15,.45))
      + brightStar(celestial,vec2(-.05,.43)) + brightStar(celestial,vec2(-.07,.34));
    sky += vec3(.9,1.1,1.5) * dipper * uNight * (1.-mask*.65);
  }
  gl_FragColor=vec4(sky,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
