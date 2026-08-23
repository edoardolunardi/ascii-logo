// `<ascii-logo>`: measuring, dragging, the frame loop, and revealing the print.
//
// There is no stand-in. The canvas is served hidden and faded in once it has a frame on it; if it
// never gets one the element stays empty and keeps its box.

import { Color, LinearSRGBColorSpace } from "three";

import { loadGlyphAtlas } from "./glyph-atlas.js";
import { AsciiLogoRenderer } from "./renderer.js";

/** Frame-rate independent exponential lerp. */
const damp = (current, target, tau, dt) => current + (target - current) * (1 - Math.exp(-dt / tau));

/** Slack, so the frame threshold never lands on the display's beat (60 would judder to 30). */
const FRAME_SLACK_MS = 8;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const CONFIG = {
  cellW: 6,
  lineRatio: 1.6,
  maxDpr: 2,
  maxCells: 4600,
  frameHz: 60,
  floatSpeed: 2,
  floatIntensity: 1.4,
  rotationIntensity: 1,
  /** Radians of orbit per CSS pixel dragged, and the clock the camera follows the drag on. */
  dragScale: 0.007,
  orbitTau: 70,
  /** Short of the pole, where the camera's up vector would flip. */
  maxElevation: 0.85,
};

/** A little under the mark's centre, so the disc reads as solid rather than flat on. */
const REST_ELEVATION = -0.22;

const RESIZE_SETTLE_MS = 250;

const CELL_ASPECT = 1 / CONFIG.lineRatio;

/** Read back through a 1x1 canvas rather than parsed: the cascade can hand down `color-mix()` or
 * any other computed form, and only the browser reliably knows what it resolved to. */
function inkOf(element) {
  const probe = document.createElement("canvas");

  probe.width = 1;
  probe.height = 1;

  const ctx = probe.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    return new Color(1, 1, 1);
  }

  ctx.fillStyle = getComputedStyle(element).color;
  ctx.fillRect(0, 0, 1, 1);

  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

  // Tagged as the working space, so colour management passes the bytes through untouched.
  return new Color().setRGB(r / 255, g / 255, b / 255, LinearSRGBColorSpace);
}

export class AsciiLogoElement extends HTMLElement {
  /** Present: light on a dark ground. Absent: ink on paper. Drives ink and tone inversion. */
  static observedAttributes = ["dark"];

  #canvas = null;
  #renderer = null;
  #resizeObserver = null;
  #visibilityObserver = null;

  #width = 0;
  #height = 0;
  #dpr = 1;
  #cellW = 0;
  #cellH = 0;

  #raf = 0;
  #last = 0;
  #settle = 0;
  #elapsed = 0;
  #visible = false;
  #reduced = false;

  #azimuth = 0;
  #elevation = REST_ELEVATION;
  #aimAzimuth = 0;
  #aimElevation = REST_ELEVATION;
  #pointer = -1;
  #pointerX = 0;
  #pointerY = 0;

  connectedCallback() {
    this.#canvas = this.querySelector("[data-logo-canvas]");

    if (!this.#canvas) {
      return;
    }

    this.#reduced = prefersReducedMotion();
    this.#elapsed = Math.PI;

    this.#measure();

    this.#resizeObserver = new ResizeObserver(this.#onResize);
    this.#resizeObserver.observe(this);

    this.#visibilityObserver = new IntersectionObserver(this.#onVisibility);
    this.#visibilityObserver.observe(this);

    this.#canvas.addEventListener("webglcontextlost", this.#onContextLost);

    void this.#build();
  }

  disconnectedCallback() {
    this.#stop();
    clearTimeout(this.#settle);
    this.#resizeObserver?.disconnect();
    this.#visibilityObserver?.disconnect();
    this.#resizeObserver = null;
    this.#visibilityObserver = null;

    this.#canvas?.removeEventListener("webglcontextlost", this.#onContextLost);
    this.removeEventListener("pointerdown", this.#onPointerDown);
    this.#releasePointer();
    this.#renderer?.destroy();
    this.#renderer = null;
  }

  async #build() {
    const canvas = this.#canvas;

    if (!canvas) {
      return;
    }

    // Face and weight come off the canvas, so the stylesheet stays the one place they are chosen.
    const style = getComputedStyle(canvas);
    const atlas = await loadGlyphAtlas(style.fontFamily, style.fontWeight, CELL_ASPECT);

    if (!this.isConnected) {
      return;
    }

    const renderer = AsciiLogoRenderer.create(canvas, atlas);

    if (!renderer) {
      return;
    }

    // A rejected shader surfaces on the first frame, so the whole run-up is guarded and nothing is
    // revealed until it comes back clean.
    try {
      renderer.setInk(inkOf(canvas));
      renderer.setPaper(!this.hasAttribute("dark"));
      renderer.resize(this.#width, this.#height, this.#dpr, this.#cellW, this.#cellH);
      renderer.render(this.#pose());
    } catch (error) {
      console.warn(error);
      renderer.destroy();
      return;
    }

    this.#renderer = renderer;

    canvas.classList.remove("is-hidden");

    // Wired only once there is something to turn, so a page without WebGL never grabs a gesture.
    this.addEventListener("pointerdown", this.#onPointerDown);

    this.#applyMotion();
  }

  attributeChangedCallback() {
    // Fires before `connectedCallback` when the attribute is present at parse, hence the guard.
    if (!this.#renderer) {
      return;
    }

    this.#renderer.setInk(inkOf(this.#canvas));
    this.#renderer.setPaper(!this.hasAttribute("dark"));
    // Drawn here rather than left to the loop: under reduced motion there is no loop.
    this.#draw();
  }

  #onContextLost = (event) => {
    event.preventDefault();
    this.#stop();
    this.#canvas?.classList.add("is-hidden");
  };

  #onVisibility = (entries) => {
    this.#visible = entries.some((entry) => entry.isIntersecting);
    this.#applyMotion();
  };

  #onResize = () => {
    clearTimeout(this.#settle);
    this.#settle = window.setTimeout(this.#remeasure, RESIZE_SETTLE_MS);
  };

  #remeasure = () => {
    const rect = this.getBoundingClientRect();

    if (Math.abs(rect.width - this.#width) < 1 && Math.abs(rect.height - this.#height) < 1) {
      return;
    }

    this.#measure();
    this.#draw();
  };

  #onPointerDown = (event) => {
    if (this.#pointer !== -1 || !event.isPrimary) {
      return;
    }

    this.#pointer = event.pointerId;
    this.#pointerX = event.clientX;
    this.#pointerY = event.clientY;
    this.setPointerCapture(event.pointerId);
    this.classList.add("is-grabbing");
    this.addEventListener("pointermove", this.#onPointerMove);
    this.addEventListener("pointerup", this.#onPointerUp);
    this.addEventListener("pointercancel", this.#onPointerUp);
    this.#applyMotion();
  };

  #onPointerMove = (event) => {
    if (event.pointerId !== this.#pointer) {
      return;
    }

    // The camera moves against the drag, so the mark turns with it.
    this.#aimAzimuth -= (event.clientX - this.#pointerX) * CONFIG.dragScale;
    this.#aimElevation = Math.max(
      -CONFIG.maxElevation,
      Math.min(CONFIG.maxElevation, this.#aimElevation + (event.clientY - this.#pointerY) * CONFIG.dragScale)
    );
    this.#pointerX = event.clientX;
    this.#pointerY = event.clientY;
  };

  #onPointerUp = (event) => {
    if (event.pointerId === this.#pointer) {
      this.#releasePointer();
    }
  };

  #releasePointer() {
    if (this.#pointer !== -1 && this.hasPointerCapture(this.#pointer)) {
      this.releasePointerCapture(this.#pointer);
    }

    this.#pointer = -1;
    this.classList.remove("is-grabbing");
    this.removeEventListener("pointermove", this.#onPointerMove);
    this.removeEventListener("pointerup", this.#onPointerUp);
    this.removeEventListener("pointercancel", this.#onPointerUp);
  }

  #applyMotion = () => {
    if (!this.#renderer || !this.#visible) {
      this.#stop();
      return;
    }

    // Reduced motion holds the frame, but a drag is the visitor's own doing, so it still runs.
    if (this.#reduced && this.#pointer === -1) {
      this.#stop();
      return;
    }

    this.#play();
  };

  #play() {
    if (this.#raf !== 0) {
      return;
    }

    this.#last = 0;
    this.#raf = requestAnimationFrame(this.#onFrame);
  }

  #stop() {
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }

  #onFrame = (now) => {
    this.#raf = requestAnimationFrame(this.#onFrame);

    if (this.#last === 0) {
      this.#last = now;
    }

    const dt = now - this.#last;

    if (dt < 1000 / CONFIG.frameHz - FRAME_SLACK_MS) {
      return;
    }

    this.#last = now;

    // Capped so a backgrounded tab does not jump the float forward on return.
    const step = Math.min(48, dt);

    if (!this.#reduced) {
      this.#elapsed += (step / 1000) * CONFIG.floatSpeed;
    }

    this.#azimuth = damp(this.#azimuth, this.#aimAzimuth, CONFIG.orbitTau, step);
    this.#elevation = damp(this.#elevation, this.#aimElevation, CONFIG.orbitTau, step);

    this.#draw();

    // Nothing left to ease and no float to run: hold the frame rather than repaint forever.
    if (this.#reduced && this.#pointer === -1 && Math.abs(this.#azimuth - this.#aimAzimuth) < 0.001) {
      this.#stop();
    }
  };

  #measure() {
    const rect = this.getBoundingClientRect();

    this.#width = Math.max(rect.width, 1);
    this.#height = Math.max(rect.height, 1);
    this.#dpr = Math.min(CONFIG.maxDpr, window.devicePixelRatio || 1);

    // Always off the base cell, never off the last result, or resizes would compound.
    const raw = (this.#width / CONFIG.cellW) * (this.#height / (CONFIG.cellW * CONFIG.lineRatio));
    const growth = raw > CONFIG.maxCells ? Math.sqrt(raw / CONFIG.maxCells) : 1;

    this.#cellW = Math.round(CONFIG.cellW * growth);
    this.#cellH = Math.round(this.#cellW * CONFIG.lineRatio);

    this.#renderer?.resize(this.#width, this.#height, this.#dpr, this.#cellW, this.#cellH);
  }

  #pose() {
    const wave = this.#elapsed / 4;

    return {
      azimuth: this.#azimuth,
      elevation: this.#elevation,
      rotateX: (Math.cos(wave) / 8) * CONFIG.rotationIntensity,
      rotateY: (Math.sin(wave) / 8) * CONFIG.rotationIntensity,
      rotateZ: (Math.sin(wave) / 20) * CONFIG.rotationIntensity,
      bob: (Math.sin(this.#elapsed / 1.5) / 10) * CONFIG.floatIntensity,
    };
  }

  #draw() {
    this.#renderer?.render(this.#pose());
  }
}
