// Three passes: the solid into an offscreen target, one fragment per character cell picking that
// cell's glyph, then the glyph sheet composited over the canvas in the page's own ink.

import {
  Camera,
  Color,
  GLSL3,
  LinearSRGBColorSpace,
  Mesh,
  NearestFilter,
  NoBlending,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Spherical,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";

import { buildLogoGeometry, LOGO_SIZE } from "./mark.js";
// `?raw` is Vite handing the file over as a string.
import CELL_FRAG from "./shaders/cell.frag.glsl?raw";
import POST_FRAG from "./shaders/post.frag.glsl?raw";
import QUAD_VERT from "./shaders/quad.vert.glsl?raw";
import SCENE_FRAG from "./shaders/scene.frag.glsl?raw";
import SCENE_VERT from "./shaders/scene.vert.glsl?raw";

const FOV = 38;
const NEAR = 0.5;
const FAR = 40;
const CAMERA_DISTANCE = 6.4;

/** Longest side of the mark in scene units, against a frame about 4.3 units tall at that distance. */
const OBJECT_SCALE = 3.05;

/** Scene-target pixels per character cell row: enough for the six samples, far below the canvas. */
const SCENE_CELL_PX = 12;

const SAMPLES = 4;

function fullFrameMaterial(fragmentShader, uniforms) {
  return new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: QUAD_VERT,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
  });
}

export class AsciiLogoRenderer {
  #renderer;

  #scene = new Scene();
  #camera = new PerspectiveCamera(FOV, 1, NEAR, FAR);
  #mesh;
  #orbit = new Spherical();

  #frame = new Scene();
  #frameCamera = new Camera();
  #quad;

  #cellMaterial;
  #postMaterial;

  #sceneTarget;
  #cellTarget;

  /** `debug` carries fragment shader overrides and a dome override for diagnostics. The shipped
   * path never passes it. */
  constructor(renderer, atlas, debug = {}) {
    this.#renderer = renderer;

    this.#mesh = new Mesh(
      buildLogoGeometry({ domeSag: debug.domeSag }),
      new ShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: SCENE_VERT,
        fragmentShader: SCENE_FRAG,
        uniforms: { uPaper: { value: 1 } },
      })
    );

    this.#mesh.scale.setScalar(OBJECT_SCALE / LOGO_SIZE);
    // Yaw, then pitch, then roll: the order the idle rock reads most naturally in.
    this.#mesh.rotation.order = "YXZ";
    this.#scene.add(this.#mesh);

    this.#sceneTarget = new WebGLRenderTarget(1, 1, {
      samples: SAMPLES,
      depthBuffer: true,
      stencilBuffer: false,
    });

    // One texel per cell, carrying that cell's glyph index in alpha. Read back exactly as written.
    this.#cellTarget = new WebGLRenderTarget(1, 1, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    });

    this.#cellMaterial = fullFrameMaterial(debug.cellShader ?? CELL_FRAG, {
      tScene: { value: this.#sceneTarget.texture },
      tShapes: { value: atlas.shapes },
      uResolution: { value: new Vector2(1, 1) },
      uCellPx: { value: new Vector2(1, 1) },
      uGlyphCount: { value: atlas.count },
    });

    this.#postMaterial = fullFrameMaterial(debug.postShader ?? POST_FRAG, {
      tCells: { value: this.#cellTarget.texture },
      tAtlas: { value: atlas.sheet },
      uCellsPerUv: { value: new Vector2(1, 1) },
      uGrid: { value: new Vector2(1, 1) },
      uAtlasGrid: { value: atlas.grid },
      uAtlasPad: { value: atlas.pad },
      uAtlasInner: { value: atlas.inner },
      uColor: { value: new Color(1, 1, 1) },
    });

    this.#quad = new Mesh(new PlaneGeometry(2, 2), this.#cellMaterial);
    // Already in clip space, so three.js must not measure it against the camera.
    this.#quad.frustumCulled = false;
    this.#frame.add(this.#quad);
  }

  static create(canvas, atlas, debug = {}) {
    let renderer;

    try {
      renderer = new WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
      });
    } catch {
      return null;
    }

    // The scene pass already encodes sRGB, so the print must not be converted a second time.
    renderer.outputColorSpace = LinearSRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    // Thrown rather than logged, so a rejected shader takes the same path as a missing context.
    renderer.debug.onShaderError = () => {
      throw new Error("ascii-logo: shader failed to compile");
    };

    return new AsciiLogoRenderer(renderer, atlas, debug);
  }

  /** Debug-only readback. The scene target is multisampled, and three.js resolves it when the
   * cell pass samples it, so read it back only after a full `render()`. */
  get sceneTarget() {
    return this.#sceneTarget;
  }

  get cellTarget() {
    return this.#cellTarget;
  }

  get renderer() {
    return this.#renderer;
  }

  setInk(color) {
    this.#postMaterial.uniforms.uColor.value.copy(color);
  }

  /** Ink on paper, or light on a dark ground. Decides whether the scene tone is inverted. */
  setPaper(light) {
    this.#mesh.material.uniforms.uPaper.value = light ? 1 : 0;
  }

  /** Cell sizes are CSS pixels. The scene target is sized off the cell grid rather than the canvas,
   * so its cost holds as the device ratio climbs. */
  resize(width, height, dpr, cellWidth, cellHeight) {
    const cols = Math.max(Math.ceil(width / cellWidth), 1);
    const rows = Math.max(Math.ceil(height / cellHeight), 1);
    const scale = SCENE_CELL_PX / cellHeight;
    const sceneWidth = Math.max(Math.round(width * scale), 1);
    const sceneHeight = Math.max(Math.round(height * scale), 1);

    this.#renderer.setPixelRatio(dpr);
    // `false`: the stylesheet owns the canvas box, three.js only sizes the buffer.
    this.#renderer.setSize(width, height, false);

    this.#sceneTarget.setSize(sceneWidth, sceneHeight);
    this.#cellTarget.setSize(cols, rows);

    this.#camera.aspect = sceneWidth / sceneHeight;
    this.#camera.updateProjectionMatrix();

    this.#cellMaterial.uniforms.uResolution.value.set(sceneWidth, sceneHeight);
    this.#cellMaterial.uniforms.uCellPx.value.set(cellWidth * scale, cellHeight * scale);
    this.#postMaterial.uniforms.uCellsPerUv.value.set(width / cellWidth, height / cellHeight);
    this.#postMaterial.uniforms.uGrid.value.set(cols, rows);
  }

  render(pose) {
    const renderer = this.#renderer;

    this.#orbit.set(CAMERA_DISTANCE, Math.PI / 2 - pose.elevation, pose.azimuth);
    this.#camera.position.setFromSpherical(this.#orbit);
    this.#camera.lookAt(0, 0, 0);

    this.#mesh.rotation.set(pose.rotateX, pose.rotateY, pose.rotateZ);
    this.#mesh.position.y = pose.bob;

    renderer.setRenderTarget(this.#sceneTarget);
    renderer.render(this.#scene, this.#camera);

    this.#quad.material = this.#cellMaterial;
    renderer.setRenderTarget(this.#cellTarget);
    renderer.render(this.#frame, this.#frameCamera);

    this.#quad.material = this.#postMaterial;
    renderer.setRenderTarget(null);
    renderer.render(this.#frame, this.#frameCamera);
  }

  /** Everything this renderer made, and nothing it borrowed: the atlas textures outlive it. */
  destroy() {
    this.#sceneTarget.dispose();
    this.#cellTarget.dispose();
    this.#mesh.geometry.dispose();
    this.#mesh.material.dispose();
    this.#quad.geometry.dispose();
    this.#cellMaterial.dispose();
    this.#postMaterial.dispose();
    this.#renderer.dispose();
    this.#renderer.forceContextLoss();
  }
}
