// Scene pass, fragment stage: gradient dome, key lobe, rim lobe, Fresnel, ACES, sRGB.
//
// The tone curve is baked in rather than left linear, so the glyph pass can average taps in an
// 8-bit target without crushing what the shadows hold.

precision highp float;
in vec3 vNormal;
in vec3 vWorld;
out vec4 outColor;
uniform float uPaper;

const vec3 KEY = normalize(vec3(-0.45, 0.85, 0.45));
const vec3 RIM = normalize(vec3(0.62, -0.12, -0.75));
const float ROUGHNESS = 0.32;

vec3 studio(vec3 d) {
  float up = d.y * 0.5 + 0.5;

  // Floor lifted off black: the shaded side is one wide field, and at near-black the cell pass
  // finds nothing to tell apart down there.
  return mix(vec3(0.05), vec3(0.4), up * up) + pow(max(dot(d, KEY), 0.0), 6.0) * 1.85 + pow(max(dot(d, RIM), 0.0), 40.0) * 4.5;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec3 encodeSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorld);
  vec3 lobe = normalize(mix(reflect(-v, n), n, ROUGHNESS));
  float fresnel = 0.05 + 0.95 * pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 4.0);

  vec3 lit = encodeSrgb(aces(studio(n) * 0.6 + studio(lobe) * fresnel * 1.35));

  // uPaper: 1 on a light ground, 0 on a dark one. The cell pass spends dense glyphs on high tone,
  // and on paper density reads as darkness, so light grounds need the tone inverted or the mark
  // prints as its own negative. The 0.18 floor is the lit side's minimum ink: without it fully lit
  // tone inverts to zero and the silhouette dissolves exactly where the light lands.
  outColor = vec4(mix(lit, mix(vec3(0.18), vec3(1.0), 1.0 - lit), uPaper), 1.0);
}
