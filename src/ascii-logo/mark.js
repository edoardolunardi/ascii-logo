// The Codrops mark as a lens: a disc with the droplet cut through it, both faces domed.

import { BufferAttribute, BufferGeometry } from "three";

/** The mark's bounding box, in modules. The disc fills it edge to edge. */
export const LOGO_SIZE = 7;

const OUTER_RADIUS = LOGO_SIZE / 2;

/** The droplet, as fractions of the disc's radius: bulb, bulb centre, apex. */
const BULB_RADIUS = 0.21 * OUTER_RADIUS;
const BULB_Y = -0.17 * OUTER_RADIUS;
const APEX_Y = 0.38 * OUTER_RADIUS;

/** Thickness at the rim, and how much higher each face sits at the middle. The side view. */
const RIM_DEPTH = 0.9;
const DOME_SAG = 0.8;

/** SEGMENTS is a multiple of four, so one step lands on the apex and the corner stays sharp. */
const SEGMENTS = 192;
const RADIAL = 10;

// Where a tangent meets the bulb. Past that angle the outline is the bulb's own arc.
const TANGENT_COS = BULB_RADIUS / (APEX_Y - BULB_Y);
const TANGENT_X = BULB_RADIUS * Math.sqrt(1 - TANGENT_COS * TANGENT_COS);
const TANGENT_Y = BULB_Y + BULB_RADIUS * TANGENT_COS;
const TANGENT_FROM = Math.atan2(TANGENT_Y, TANGENT_X);
const TANGENT_SPAN = Math.PI - 2 * TANGENT_FROM;

// The right-hand tangent as `n . p = c`. The outline is mirror-symmetric, so the left side reuses
// it against `|x|`.
const TANGENT_NX = TANGENT_Y - APEX_Y;
const TANGENT_NY = -TANGENT_X;
const TANGENT_C = TANGENT_NY * APEX_Y;

const TAU = Math.PI * 2;

/** The droplet's outline at `theta`, as a distance from the centre. The droplet is convex and the
 * centre is inside it, so every ray leaves once and this is single valued. */
function dropletRadius(theta) {
  const dy = Math.sin(theta);
  const turn = theta - TANGENT_FROM - Math.floor((theta - TANGENT_FROM) / TAU) * TAU;

  if (turn <= TANGENT_SPAN) {
    return TANGENT_C / (TANGENT_NX * Math.abs(Math.cos(theta)) + TANGENT_NY * dy);
  }

  const along = dy * BULB_Y;

  return along + Math.sqrt(Math.max(along * along - BULB_Y * BULB_Y + BULB_RADIUS * BULB_RADIUS, 0));
}

/** `domeSag` is a debug-only override; the shipped path passes nothing. It cannot be 0, since
 * the dome radius divides by it. Use 0.001 for a near-flat face. */
export function buildLogoGeometry({ domeSag = DOME_SAG } = {}) {
  // The sphere each face is cut from, placed so it passes through the rim and the middle.
  const DOME_RADIUS = (OUTER_RADIUS * OUTER_RADIUS + domeSag * domeSag) / (2 * domeSag);
  const DOME_CENTRE = Math.sqrt(DOME_RADIUS * DOME_RADIUS - OUTER_RADIUS * OUTER_RADIUS) - RIM_DEPTH / 2;

  const domeZ = (r) => Math.sqrt(Math.max(DOME_RADIUS * DOME_RADIUS - r * r, 0)) - DOME_CENTRE;

  const quads = SEGMENTS * (2 + RADIAL * 2);
  const positions = new Float32Array(quads * 6 * 3);
  const normals = new Float32Array(quads * 6 * 3);

  let at = 0;

  const vertex = ([p, n]) => {
    positions.set(p, at);
    normals.set(n, at);
    at += 3;
  };

  /** Corners are `[position, normal]`, wound counter-clockwise seen from outside. */
  const quad = (a, b, c, d) => {
    vertex(a);
    vertex(b);
    vertex(c);
    vertex(a);
    vertex(c);
    vertex(d);
  };

  /** A point on a face, `t` of the way from the droplet out to the rim. The normal is the dome
   * sphere's own radius through it, so it is exact rather than differenced. */
  const onFace = (theta, innerRadius, t, side) => {
    const radius = innerRadius + (OUTER_RADIUS - innerRadius) * t;
    const z = domeZ(radius) * side;
    const x = Math.cos(theta) * radius;
    const y = Math.sin(theta) * radius;
    const nz = (Math.abs(z) + DOME_CENTRE) * side;
    const length = Math.hypot(x, y, nz) || 1;

    return [
      [x, y, z],
      [x / length, y / length, nz / length],
    ];
  };

  const angles = new Float32Array(SEGMENTS);
  const radii = new Float32Array(SEGMENTS);

  for (let i = 0; i < SEGMENTS; i++) {
    angles[i] = (i / SEGMENTS) * TAU;
    radii[i] = dropletRadius(angles[i]);
  }

  for (let i = 0; i < SEGMENTS; i++) {
    const j = (i + 1) % SEGMENTS;

    for (let k = 0; k < RADIAL; k++) {
      const inner = k / RADIAL;
      const outer = (k + 1) / RADIAL;

      for (const side of [1, -1]) {
        const a = onFace(angles[i], radii[i], outer, side);
        const b = onFace(angles[j], radii[j], outer, side);
        const c = onFace(angles[j], radii[j], inner, side);
        const d = onFace(angles[i], radii[i], inner, side);

        if (side === 1) {
          quad(a, b, c, d);
        } else {
          quad(a, d, c, b);
        }
      }
    }

    const mid = ((i + 0.5) / SEGMENTS) * TAU;
    const rim = [Math.cos(mid), Math.sin(mid), 0];
    const ox = Math.cos(angles[i]) * OUTER_RADIUS;
    const oy = Math.sin(angles[i]) * OUTER_RADIUS;
    const px = Math.cos(angles[j]) * OUTER_RADIUS;
    const py = Math.sin(angles[j]) * OUTER_RADIUS;
    const lip = RIM_DEPTH / 2;

    quad([[ox, oy, lip], rim], [[ox, oy, -lip], rim], [[px, py, -lip], rim], [[px, py, lip], rim]);

    // The droplet's wall faces into the void. Flat per step, so the apex stays a hard corner.
    const ix = Math.cos(angles[i]) * radii[i];
    const iy = Math.sin(angles[i]) * radii[i];
    const jx = Math.cos(angles[j]) * radii[j];
    const jy = Math.sin(angles[j]) * radii[j];
    const ez = domeZ(radii[i]);
    const fz = domeZ(radii[j]);
    const ex = jx - ix;
    const ey = jy - iy;
    const length = Math.hypot(ex, ey) || 1;
    const wall = [-ey / length, ex / length, 0];

    quad([[ix, iy, -ez], wall], [[ix, iy, ez], wall], [[jx, jy, fz], wall], [[jx, jy, -fz], wall]);
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(normals, 3));

  return geometry;
}

// The outline math, exported for tooling and diagnostics. Nothing in the shipped path imports
// these.
export { APEX_Y, BULB_RADIUS, BULB_Y, dropletRadius, OUTER_RADIUS, TANGENT_FROM, TANGENT_SPAN, TANGENT_X, TANGENT_Y };
