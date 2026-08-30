// The sample points the atlas baker measures with, mirrored by the cell shader.

/** Six sample points per cell, as fractions, y down. Matching on layout rather than on average
 * brightness is what lands an edge on a slash instead of a block. The right column rides higher
 * than the left so a diagonal reads as a diagonal, not as two stacked dots.
 *
 * Hard-coded again as `INNER` in `shaders/cell.frag.glsl`. The two have to agree. */
export const INNER_SAMPLES = [
  [0.28, 0.26],
  [0.72, 0.14],
  [0.28, 0.56],
  [0.72, 0.44],
  [0.28, 0.86],
  [0.72, 0.74],
];
