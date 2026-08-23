# ASCII Logo

_The Codrops mark as a draggable 3D solid, printed in ASCII characters on the GPU._

<!-- TODO: replace with the Codrops featured image once it exists, e.g.
     https://tympanus.net/codrops/wp-content/uploads/2026/XX/edoardo-lunardi-ascii-logo-featured-image.jpg -->

![ASCII Logo](TODO-featured-image.jpg)

[Article on Codrops](https://tympanus.net/codrops/?p=TODO)

[Demo](https://tympanus.net/Tutorials/ASCIILogo/)

## Features

- **Real geometry** - the mark is a swept solid with domed faces, not an extruded disc faked in shading
- **Glyph search on the GPU** - every character cell picks its own glyph from 95 ASCII candidates each frame
- **Drag to orbit** - pointer drag with exponential damping, easing back into an idle float on release
- **Light and dark** - one switch flips the page, the ink and the direction the tone runs
- **Resolution independent** - the cell count is capped, so a bigger box spends it on bigger characters
- **Considerate by default** - pauses offscreen, holds still under `prefers-reduced-motion`, reveals only a finished frame

## Getting Started

```bash
nvm use
npm install
npm run dev
```

That opens the page. Drag the mark to orbit the camera; release and it eases back into its idle
float. `npm run build` writes a static `dist/`, and `npm run preview` serves that build.

`npm run check` lints and checks formatting; `npm run format` fixes both. ESLint runs first in each,
because `eslint --fix` reorders import specifiers without spacing them and the formatter has to have
the last word.

Note that the page will not work opened straight off disk as a `file://` URL, and no amount of
configuration changes that: `src/main.js` is an ES module, a module is _fetched_, and a fetch from
`file://` counts as cross-origin from a null origin. Every browser blocks it. That is what `npm run
dev` is for.

## Tech Stack

- three.js
- WebGL2 and GLSL
- Custom elements
- Vanilla HTML, CSS and JavaScript
- Vite

## Structure

```
ascii-logo/
  index.html                     the font link, the demo frame, the custom element, its canvas
  vite.config.js                 two settings
  .nvmrc                         the Node this is built and run against
  src/
    main.js                      registers the element, wires the theme switch
    styles.css                   the page, the frame, the box, the two opacity states
    ascii-logo/
      mark.js                    the outline, and the lens swept from it
      glyph-atlas.js             the glyph sheet, and the shape vector that searches it
      renderer.js                the three passes, and the three.js objects carrying them
      element.js                 measuring, dragging, the frame loop, revealing the print
      shaders/
        scene.vert.glsl
        scene.frag.glsl          the analytic lighting, and the domed cap normal
        quad.vert.glsl           shared by the two full-frame passes
        cell.frag.glsl           the glyph search
        post.frag.glsl           the composite, in the page's ink
```

Nothing stands in for the print. The canvas is served hidden and faded in once it has a first frame
on it, so what appears is finished rather than half-built. Off disk, on a browser without WebGL2, or
if a driver rejects one of the shaders, the element stays empty: it keeps its box, so nothing on the
page shifts, but the mark is simply not there. That is the deliberate trade for never showing a
stand-in, and it is one `aspect-ratio` rule and one class away from being reversed.

## How it works

Four modules, in the order the frame flows through them:

1. **`mark.js`.** Measured, not traced, and swept, not extruded: an extrusion's caps are flat and
   stay flat, so the mark would read as a coin from the side. Here both faces are shallow spherical
   domes, 0.9 modules thick at the rim swelling to 2.5 in the middle, so the profile is a hill and
   the silhouette carries the volume from every angle. The droplet is a bulb of 0.735 modules
   centred 0.595 below the disc's centre, an apex 1.33 above it, and the two tangents between,
   closed analytically by `dropletRadius(theta)`; both outlines are swept on the same angular
   parameterisation, which is what lets each face close with a clean quad strip between the droplet
   and the rim. Real positions, real normals, watertight, uploaded once as a `BufferGeometry`.
2. **`glyph-atlas.js`.** The 95 printable ASCII characters rasterized to a 2D canvas after
   `document.fonts.ready`, then reduced to a **shape vector**: six coverage values per glyph, one
   per sample point inside the cell, normalized per sample point. That vector is what the search
   matches against, which is why an edge lands on a slash instead of a block. The sheet leaves as a
   `CanvasTexture` and the vectors as a one-row-per-glyph `DataTexture`.
3. **`renderer.js`.** Three passes, each a `render()` into a `WebGLRenderTarget`:
   - _scene_: the solid into a small offscreen target (12px per character row, so cost holds as
     DPR climbs), lit analytically: a gradient dome, a key lobe, a rim lobe, Fresnel, ACES, sRGB.
     `samples: 4` on the target is the whole of the MSAA setup.
   - _cell_: one fragment **per character cell**. Each reads its own six points plus ten outside
     the cell, sharpens each inner sample against its neighbours in that direction, then linearly
     searches all 95 glyphs for the nearest shape vector. The winner is packed into the alpha
     channel as `index / 255`.
   - _post_: full-frame, reads the winning index per cell, samples the atlas with `textureGrad`,
     and outputs `currentColor * mask`, so the print inherits the page's ink.
4. **`element.js`.** `<ascii-logo>`: measure, cap the cell count, orbit on pointer drag with
   exponential damping, idle rock and bob, pause when offscreen, hold the frame under
   `prefers-reduced-motion`, and reveal the canvas only once a first frame has come back clean.

### The shaders are files

The five shaders are `.glsl` files under `shaders/`, pulled in with Vite's `?raw`, which hands a
file over as a string with no plugin and no config. They were template literals in one big module
before; as files an editor highlights them, and `renderer.js` stays about wiring rather than about
GLSL.

One thing crosses that boundary, commented at both ends: the six sample points in `cell.frag.glsl`
are the same six the atlas measures every glyph at in `glyph-atlas.js`. If they drift, the search
compares a cell against vectors built some other way.

### The relief is real geometry

Earlier drafts extruded a flat disc and faked the volume in shading, bending the cap normals into a
dome the geometry did not have. That kept the head-on print alive but the side view stayed a coin,
so the fake was retired for a swept solid whose faces really are domes: the hill is in the
silhouette now, not just in the tone. It also made the pipeline simpler, since the fragment shader
no longer needs the mark's orientation and the scene pass carries exactly one uniform, `uPaper`.

### What three.js replaced

The first version of this was hand-rolled WebGL2. three.js took out roughly a third of it, and all
of the parts that were plumbing rather than the effect:

| Gone                                                                          | Now                                             |
| ----------------------------------------------------------------------------- | ----------------------------------------------- |
| `perspective`, `lookAtOrigin`, `multiply`, `rotation`, `modelFromRotation`    | `PerspectiveCamera`, `Spherical`, `Object3D`    |
| `compile`, `link`, `uniforms`, and every `gl.uniform*` call                   | `ShaderMaterial` with a `uniforms` object       |
| VAOs, buffers, attribute pointers, a hand-built full-screen triangle          | `BufferGeometry`, `PlaneGeometry(2, 2)`         |
| Two FBOs, a depth renderbuffer, an MSAA colour renderbuffer, a resolve blit   | two `WebGLRenderTarget`s, one with `samples: 4` |
| `texImage2D`, filter and wrap params, `UNPACK_FLIP_Y_WEBGL`, `generateMipmap` | `CanvasTexture`, `DataTexture`                  |
| Context creation, viewport, clear, cull and depth state per pass              | `WebGLRenderer`                                 |

What is left is the part three.js has no opinion about: the shape of the mark, the glyph atlas, and
the three shaders. The mesh itself went the other way: it was `Shape` + `Path` + `ExtrudeGeometry`
for a while, until the profile needed to be a lens rather than a slab, and extrusion cannot dome its
caps. It is hand-swept again, handed over as a plain `BufferGeometry`.

Vite's job is smaller and entirely mechanical: resolve the bare `three` import, serve the page over
HTTP so the module actually loads, and hash the font and stylesheet into `dist/` on build. There is
no framework and no plugin. `vite.config.js` sets two things.

## The face

IBM Plex Mono Regular, from Google Fonts, linked in `index.html`. Only weight 400 is pulled: it is
the weight the atlas bakes at (set on the canvas in `src/styles.css`), and asking for one file
rather than a range keeps the request small. Regular over Light is a visibility call: at 10px cells
on a white ground, Light's strokes thin the whole print by about a quarter.

The face is not decoration here, it is the vocabulary. `glyph-atlas.js` rasterizes it into the glyph
sheet and reduces each character to the shape vector the cell pass searches, so swapping the face
changes which characters the mark prints in. Any monospace will work; point `--font-mono` in
`styles.css` at it and change the link. `document.fonts.ready` gates the bake, so the sheet is never
built against a fallback face. The load is forced with `document.fonts.load()` rather than awaited
with `fonts.ready`: the mark is nearly the only thing on the page, so almost no DOM text uses the
face and the browser could resolve `fonts.ready` before the font exists, leaving the atlas to bake
from the fallback. If the fetch fails outright the mark still prints, in whatever `ui-monospace`
resolves to.

To self-host instead of linking out, `npm i @fontsource/ibm-plex-mono` and
`import "@fontsource/ibm-plex-mono/400.css"` at the top of `src/main.js` replaces the link.

## The page

White ground, Codrops blue mark, the demo frame in the margins, and one control: a segmented switch
rendering both themes, the active one filled. Dark restores the ground the demo originally shipped
on, with the blue lifted a step so thin glyphs hold against it. The switch flips a `data-theme`
attribute on the root for the stylesheet and a `dark` attribute on the element, which re-reads its
ink from the cascade and tells the renderer which way the tone runs; the order matters, page before
element, so the cascade is already on the new theme when the ink is read. The mark prints in
whatever `color` resolves to on the element, which `src/styles.css` sets from one custom property,
`--mark`; the page behind it is `--ground`. It is sized `min(84vmin, 900px)`, off the short side so
the square box fits whichever way the window is turned.

On the light theme the scene pass inverts its tone before the glyph search reads it, switched by the
one uniform the scene material carries, `uPaper`. The cell pass spends dense glyphs where that tone
is high, and on paper density is what darkness looks like: without the inversion the lit side of the
mark would print the heaviest characters and the whole thing would read as its own negative. On the
dark theme the tone passes straight through, and the print is light on the ground the way it
originally was.

The inversion rides on an ink floor, `mix(vec3(0.18), ...)`: fully lit tone would otherwise invert
to zero and print as spaces, and the silhouette would dissolve exactly where the light lands. It is
the mirror of the small ambient floor inside `studio()`, which holds the shaded side together for
the same reason in the other direction.

There is no `maxCells` change behind the larger mark. The cap holds the character count roughly
constant, so a bigger box spends it on bigger characters rather than more of them, which is the half
of "bigger" worth keeping: at this size the individual glyphs are still legible, and being able to
read them is the point.

## Credits

- Type set in [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono)
- GPU work by [three.js](https://threejs.org/)

## Misc

Follow Edoardo: [Instagram](https://www.instagram.com/edo.tsx/), [GitHub](https://github.com/edoardolunardi), [LinkedIn](https://www.linkedin.com/in/edoardolunardi/), [X](https://x.com/edo_lunardi)

Follow Codrops: [X](http://www.x.com/codrops), [Facebook](https://www.facebook.com/codrops), [Instagram](https://www.instagram.com/codropsss/), [LinkedIn](https://www.linkedin.com/company/codrops/), [GitHub](https://github.com/codrops)

## License

[MIT](LICENSE)
