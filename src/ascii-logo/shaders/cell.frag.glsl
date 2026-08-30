// Cell pass: one fragment per character cell.
//
// Each cell reads its own six points plus the ten around it, so a glyph is picked by where the tone
// sits and which way an edge runs through the cell, not by an average. The winner leaves in alpha
// as `index / 255`.
//
// INNER must match INNER_SAMPLES in samples.js, or the search compares against vectors built
// some other way.

precision highp float;
out vec4 outColor;
uniform sampler2D tScene;
uniform sampler2D tShapes;
uniform vec2 uResolution;
uniform vec2 uCellPx;
uniform int uGlyphCount;

const float CONTRAST = 1.5;
const float EDGE_CONTRAST = 3.0;

const vec2 INNER[6] = vec2[6](
  vec2(0.28, 0.26), vec2(0.72, 0.14),
  vec2(0.28, 0.56), vec2(0.72, 0.44),
  vec2(0.28, 0.86), vec2(0.72, 0.74)
);
const vec2 OUTER[10] = vec2[10](
  vec2(0.28, -0.2), vec2(0.72, -0.2),
  vec2(-0.22, 0.25), vec2(1.22, 0.25),
  vec2(-0.22, 0.5), vec2(1.22, 0.5),
  vec2(-0.22, 0.75), vec2(1.22, 0.75),
  vec2(0.28, 1.2), vec2(0.72, 1.2)
);
const vec2 RING[6] = vec2[6](
  vec2(1.0, 0.0), vec2(0.5, 0.8660254), vec2(-0.5, 0.8660254),
  vec2(-1.0, 0.0), vec2(-0.5, -0.8660254), vec2(0.5, -0.8660254)
);

vec2 cellBase;

vec4 fetchTap(vec2 p) {
  vec2 uv = p / uResolution;

  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    return vec4(0.0);
  }

  return texture(tScene, uv);
}

vec4 sampleCircle(vec2 c) {
  vec2 middle = cellBase + vec2(c.x, 1.0 - c.y) * uCellPx;
  float r = uCellPx.y * 0.161;
  vec4 acc = fetchTap(middle);

  for (int k = 0; k < 6; k++) {
    acc += fetchTap(middle + RING[k] * r);
  }

  return acc / 7.0;
}

float circleLum(vec4 acc) {
  vec3 straight = acc.rgb / max(acc.a, 1e-4);

  return clamp(dot(straight, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0) * acc.a;
}

float dirContrast(float value, float ext) {
  float peak = max(value, ext);

  if (peak < 1e-4) {
    return value;
  }

  return pow(value / peak, EDGE_CONTRAST) * peak;
}

void main() {
  cellBase = floor(gl_FragCoord.xy) * uCellPx;

  float v[6];
  vec3 colAcc = vec3(0.0);
  float alphaAcc = 0.0;

  for (int i = 0; i < 6; i++) {
    vec4 acc = sampleCircle(INNER[i]);

    v[i] = circleLum(acc);
    colAcc += acc.rgb;
    alphaAcc += acc.a;
  }

  float e[10];

  for (int i = 0; i < 10; i++) {
    e[i] = circleLum(sampleCircle(OUTER[i]));
  }

  v[0] = dirContrast(v[0], max(max(e[0], e[1]), max(e[2], e[4])));
  v[1] = dirContrast(v[1], max(max(e[0], e[1]), max(e[3], e[5])));
  v[2] = dirContrast(v[2], max(e[2], max(e[4], e[6])));
  v[3] = dirContrast(v[3], max(e[3], max(e[5], e[7])));
  v[4] = dirContrast(v[4], max(max(e[4], e[6]), max(e[8], e[9])));
  v[5] = dirContrast(v[5], max(max(e[5], e[7]), max(e[8], e[9])));

  float peak = max(max(max(v[0], v[1]), max(v[2], v[3])), max(v[4], v[5]));

  if (peak > 1e-4) {
    for (int i = 0; i < 6; i++) {
      v[i] = pow(v[i] / peak, CONTRAST) * peak;
    }
  }

  int best = 0;
  float bestD = 1e9;

  for (int g = 0; g < uGlyphCount; g++) {
    float d = 0.0;

    for (int i = 0; i < 6; i++) {
      float diff = v[i] - texelFetch(tShapes, ivec2(i, g), 0).r;

      d += diff * diff;
    }

    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }

  outColor = vec4(colAcc / max(alphaAcc, 1e-4), float(best) / 255.0);
}
