// Post pass: the glyph sheet composited in the page's own ink.

precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tCells;
uniform sampler2D tAtlas;
uniform vec2 uCellsPerUv;
uniform vec2 uGrid;
uniform vec2 uAtlasGrid;
uniform vec2 uAtlasPad;
uniform vec2 uAtlasInner;
uniform vec3 uColor;

void main() {
  vec2 cellPos = vUv * uCellsPerUv;
  vec2 cell = clamp(floor(cellPos), vec2(0.0), uGrid - 1.0);
  float glyph = floor(texelFetch(tCells, ivec2(cell), 0).a * 255.0 + 0.5);
  vec2 local = clamp(cellPos - cell, 0.0, 1.0);
  float gx = mod(glyph, uAtlasGrid.x);
  float gy = floor(glyph / uAtlasGrid.x);
  vec2 atlasUv = vec2(
    (gx + uAtlasPad.x + local.x * uAtlasInner.x) / uAtlasGrid.x,
    (uAtlasGrid.y - gy - 1.0 + uAtlasPad.y + local.y * uAtlasInner.y) / uAtlasGrid.y
  );
  vec2 atlasStep = uAtlasInner / uAtlasGrid;
  float mask = textureGrad(tAtlas, atlasUv, dFdx(cellPos) * atlasStep, dFdy(cellPos) * atlasStep).a;

  outColor = vec4(uColor * mask, mask);
}
