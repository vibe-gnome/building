export const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const BLUR_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;
uniform float uMorph;
uniform sampler2D uTexB;
uniform float uUseMorph;
uniform float uPartOut;
uniform float uPartIn;
uniform float uLetterSpread;
uniform vec2 uFocus;
uniform float uFocusAmt;

float bhash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float bvnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = bhash(i), b = bhash(i + vec2(1.0, 0.0));
  float c = bhash(i + vec2(0.0, 1.0)), d = bhash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float bfbm(vec2 p) {
  float value = 0.0, amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * bvnoise(p);
    p = p * 2.0 + 11.0;
    amplitude *= 0.5;
  }
  return value;
}

float bTransition(vec2 uv, float morph) {
  vec2 q = vec2(bfbm(uv * 2.1 + 3.7), bfbm(uv * 2.1 - 1.3));
  float noise = bfbm(uv * 3.0 + q * 1.1);
  float bias = (uv.x * 0.8 + uv.y * 0.2) * 0.30;
  float field = clamp(noise * 0.74 + bias, 0.0, 1.0);
  const float BAND = 0.26;
  float threshold = mix(1.0 + BAND, -BAND, morph);
  return smoothstep(threshold - BAND, threshold + BAND, field);
}

float bLetterPhase(sampler2D tex, vec2 uv, float morph, float spread) {
  float index = texture2D(tex, uv).r;
  return clamp((morph * (1.0 + spread)) - index * spread, 0.0, 1.0);
}

vec4 sampleMorph(vec2 uv) {
  if (uUseMorph > 0.5) {
    vec4 fromTexture = texture2D(uTex, uv);
    vec4 toTexture = texture2D(uTexB, uv);
    float outMorph = bTransition(
      uv,
      bLetterPhase(uTex, uv, uPartOut, uLetterSpread)
    );
    float inMorph = bTransition(
      uv,
      bLetterPhase(uTexB, uv, uPartIn, uLetterSpread)
    );
    return max(fromTexture * (1.0 - outMorph), toTexture * inMorph);
  }
  return texture2D(uTex, uv);
}

void main() {
  float midpoint = (uFocus.x + uFocus.y) * 0.5;
  float halfWidth = max(0.001, (uFocus.y - uFocus.x) * 0.5);
  float ends = clamp(abs(vUv.x - midpoint) / halfWidth, 0.0, 1.6);
  float focus = 1.0 + uFocusAmt * ends * ends;
  vec2 direction = uDir * focus;

  float w0 = 0.2270270270;
  float w1 = 0.1945945946;
  float w2 = 0.1216216216;
  float w3 = 0.0540540541;
  float w4 = 0.0162162162;
  vec4 color = sampleMorph(vUv) * w0;
  color += sampleMorph(vUv + direction * 1.0) * w1;
  color += sampleMorph(vUv - direction * 1.0) * w1;
  color += sampleMorph(vUv + direction * 2.0) * w2;
  color += sampleMorph(vUv - direction * 2.0) * w2;
  color += sampleMorph(vUv + direction * 3.0) * w3;
  color += sampleMorph(vUv - direction * 3.0) * w3;
  color += sampleMorph(vUv + direction * 4.0) * w4;
  color += sampleMorph(vUv - direction * 4.0) * w4;
  gl_FragColor = color;
}`;

export const COMPOSITE_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;

uniform sampler2D uMask;
uniform sampler2D uMaskB;
uniform sampler2D uL0;
uniform sampler2D uL1;
uniform sampler2D uL2;
uniform sampler2D uL3;
uniform vec2 uRes;
uniform float uMorph;
uniform float uPartOut;
uniform float uPartIn;
uniform float uLetterSpread;
uniform float uFront;
uniform vec2 uCursor;
uniform float uCursorOn;
uniform float uWarpRadius;
uniform float uWarpAmp;
uniform float uWarpSwirl;
uniform vec2 uWarpVel;
uniform float uWarpDrag;
uniform float uWarpStretch;
uniform float uPhase;
uniform float uBloom;
uniform vec2 uCast0;
uniform vec2 uCast1;
uniform vec2 uCast2;
uniform vec2 uCast3;
uniform float uPos[5];
uniform vec3 uCol[5];
uniform vec3 uInk;
uniform vec3 uPaper;
uniform float uGrain;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0, amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * vnoise(p);
    p = p * 2.0 + 11.0;
    amplitude *= 0.5;
  }
  return value;
}

float transitionMask(vec2 uv, float morph) {
  vec2 q = vec2(fbm(uv * 2.1 + 3.7), fbm(uv * 2.1 - 1.3));
  float noise = fbm(uv * 3.0 + q * 1.1);
  float bias = (uv.x * 0.8 + uv.y * 0.2) * 0.30;
  float field = clamp(noise * 0.74 + bias, 0.0, 1.0);
  const float BAND = 0.26;
  float threshold = mix(1.0 + BAND, -BAND, morph);
  return smoothstep(threshold - BAND, threshold + BAND, field);
}

float letterPhase(sampler2D tex, vec2 uv, float morph, float spread) {
  float index = texture2D(tex, uv).r;
  return clamp((morph * (1.0 + spread)) - index * spread, 0.0, 1.0);
}

float coverA(vec2 uv) {
  return texture2D(uMask, uv).a;
}

float coverB(vec2 uv) {
  return texture2D(uMaskB, uv).a;
}

float cover(vec2 uv) {
  float outMorph = transitionMask(
    uv,
    letterPhase(uMask, uv, uPartOut, uLetterSpread)
  );
  float inMorph = transitionMask(
    uv,
    letterPhase(uMaskB, uv, uPartIn, uLetterSpread)
  );
  return max(coverA(uv) * (1.0 - outMorph), coverB(uv) * inMorph);
}

vec3 gradientMap(float value) {
  vec3 color = uCol[0];
  color = mix(color, uCol[1], smoothstep(uPos[0], uPos[1], value));
  color = mix(color, uCol[2], smoothstep(uPos[1], uPos[2], value));
  color = mix(color, uCol[3], smoothstep(uPos[2], uPos[3], value));
  color = mix(color, uCol[4], smoothstep(uPos[3], uPos[4], value));
  return color;
}

vec3 softLight(vec3 base, float grain) {
  vec3 source = vec3(grain);
  vec3 low = 2.0 * base * source + base * base * (1.0 - 2.0 * source);
  vec3 high = 2.0 * base * (1.0 - source) + sqrt(base) * (2.0 * source - 1.0);
  return mix(low, high, step(0.5, source));
}

vec2 warpUv(vec2 uv) {
  if (uCursorOn < 0.001) return uv;
  float aspect = uRes.x / max(1.0, uRes.y);
  vec2 delta = (uv - uCursor) * vec2(aspect, 1.0);
  float radius = length(delta);
  if (radius > uWarpRadius || radius < 0.00001) return uv;

  float force = 1.0 - radius / uWarpRadius;
  force = force * force * (3.0 - 2.0 * force);
  vec2 direction = delta / radius;
  vec2 swirl = vec2(-direction.y, direction.x);
  vec2 push = mix(direction, swirl, uWarpSwirl) + uWarpVel * uWarpDrag;

  float speed = length(uWarpVel);
  if (speed > 0.02) {
    vec2 velocityDirection = uWarpVel / speed;
    float along = dot(delta / radius, velocityDirection);
    float stretch = 1.0 + uWarpStretch * clamp(speed, 0.0, 1.0) * (along * along - 0.35);
    force *= clamp(stretch, 0.0, 2.2);
  }

  float ripple = 1.0 + 0.16 * sin(radius / uWarpRadius * 3.1416 - uPhase * 5.0);
  float lead = 0.5 + 0.5 * dot(normalize(delta + 0.000001), normalize(uWarpVel + 0.000001));
  float viscosity = mix(1.15, 0.85, lead);
  return uv + push * (force * ripple * viscosity * uWarpAmp * uCursorOn) / vec2(aspect, 1.0);
}

void main() {
  vec2 uv = warpUv(vUv);
  float cursorDistance = distance(vUv * uRes, uCursor * uRes);
  float hotspot = uCursorOn * smoothstep(
    min(uRes.x, uRes.y) * uWarpRadius * 2.4,
    0.0,
    cursorDistance
  );
  float bloom = 1.0 + (uBloom - 1.0) * 1.25 + 0.14 * hotspot;

  float glow =
      1.00 * cover(uv)
    + 0.92 * texture2D(uL0, uv + uCast0).a
    + 0.78 * texture2D(uL1, vUv + uCast1).a * bloom
    + 0.58 * texture2D(uL2, vUv + uCast2).a * bloom
    + 0.40 * texture2D(uL3, vUv + uCast3).a * bloom;
  glow = clamp(glow / 2.45, 0.0, 1.0);

  float field = pow(glow, 0.6);
  field = clamp(field + hotspot * 0.16 * field, 0.0, 1.0);

  if (uFront > 0.001) {
    vec2 q = vec2(fbm(uv * 2.1 + 3.7), fbm(uv * 2.1 - 1.3));
    float noise = fbm(uv * 3.0 + q * 1.1);
    float noiseField = clamp(
      noise * 0.74 + (uv.x * 0.8 + uv.y * 0.2) * 0.30,
      0.0,
      1.0
    );
    float incomingThreshold = mix(1.26, -0.26, uPartIn);
    float edge = 1.0 - smoothstep(
      0.0,
      0.30,
      abs(noiseField - incomingThreshold)
    );
    field = clamp(
      field + edge * uFront * 0.30 * smoothstep(0.02, 0.45, glow),
      0.0,
      1.0
    );
  }

  float drift = 0.022 * sin(uPhase + uv.x * 3.0 + uv.y * 2.0);
  float gradientValue = clamp(
    1.0 - field + drift - hotspot * 0.10,
    0.0,
    1.0
  );
  vec3 color = gradientMap(gradientValue);
  vec3 bounced = mix(
    uPaper,
    uCol[2],
    texture2D(uL3, vUv + uCast3).a * 0.16
  );
  color = mix(bounced, color, smoothstep(0.0, 0.06, field));

  float softCoverage = clamp(
    texture2D(uL0, uv).a * 1.05 + cover(uv) * 0.25,
    0.0,
    1.0
  );
  float interior = smoothstep(0.18, 0.62, softCoverage);
  vec3 bodyColor = mix(uInk, uCol[1], 0.5);
  bodyColor = mix(bodyColor, uCol[2], (1.0 - interior) * 0.5);
  float solid = smoothstep(0.35, 0.95, cover(uv));
  bodyColor = mix(
    mix(bodyColor, uCol[2], 0.30),
    mix(bodyColor, uInk, 0.22),
    solid
  );
  color = mix(color, bodyColor, interior * 0.9);

  float grain = hash(gl_FragCoord.xy);
  vec3 grained = softLight(color, grain);
  color = mix(color, grained, uGrain * (0.5 + 0.7 * field));
  float edgeFade =
      smoothstep(0.0, 0.12, vUv.x)
    * smoothstep(0.0, 0.12, 1.0 - vUv.x)
    * smoothstep(0.0, 0.16, vUv.y)
    * smoothstep(0.0, 0.16, 1.0 - vUv.y);
  float alpha = smoothstep(0.12, 0.38, field) * edgeFade;
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha);
}`;
