import {
  BREATH,
  CAST_DIR,
  CAST_STEP,
  CYCLE_WORDS,
  GRAIN,
  HOLD_SCALE,
  LETTER_SPREAD,
  lerpPaletteUniforms,
  MORPH_LAG,
  MORPH_LEAD,
  PALETTES,
  type PaletteUniforms,
  paletteUniforms,
  WARP_AMP,
  WARP_DRAG,
  WARP_RADIUS,
  WARP_STRETCH,
  WARP_SWIRL,
  WORDS,
} from "./params";
import { BLUR_FRAG, COMPOSITE_FRAG, VERT } from "./shaders";
import { makeWordMask } from "./text-mask";

const FOCUS_AMOUNT = 1.5;
const MORPH_SECONDS = 0.8;
const HOLD_MILLISECONDS = 700;

const LEVELS = [
  { scale: 0.5, radius: 2 },
  { scale: 0.25, radius: 3 },
  { scale: 0.125, radius: 3 },
  { scale: 0.0625, radius: 3 },
] as const;

const BLUR_UNIFORMS = [
  "uTex",
  "uTexB",
  "uDir",
  "uMorph",
  "uUseMorph",
  "uFocus",
  "uFocusAmt",
  "uPartOut",
  "uPartIn",
  "uLetterSpread",
] as const;

const COMPOSITE_UNIFORMS = [
  "uMask",
  "uMaskB",
  "uL0",
  "uL1",
  "uL2",
  "uL3",
  "uRes",
  "uMorph",
  "uCursor",
  "uCursorOn",
  "uWarpRadius",
  "uWarpAmp",
  "uWarpSwirl",
  "uWarpVel",
  "uWarpDrag",
  "uWarpStretch",
  "uPhase",
  "uBloom",
  "uCast0",
  "uCast1",
  "uCast2",
  "uCast3",
  "uPartOut",
  "uPartIn",
  "uLetterSpread",
  "uFront",
  "uPos",
  "uCol",
  "uInk",
  "uPaper",
  "uGrain",
] as const;

type BlurUniformName = (typeof BLUR_UNIFORMS)[number];
type CompositeUniformName = (typeof COMPOSITE_UNIFORMS)[number];
type UniformMap<Name extends string> = Record<
  Name,
  WebGLUniformLocation | null
>;

interface RenderTarget {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

interface BloomLevel {
  output: RenderTarget;
  temporary: RenderTarget;
}

function paletteAt(index: number) {
  const normalizedIndex =
    ((index % PALETTES.length) + PALETTES.length) % PALETTES.length;
  const palette = PALETTES[normalizedIndex];
  if (!palette) throw new Error("Blur glow palettes are not configured");
  return palette;
}

function wordAt(index: number) {
  return WORDS[index % WORDS.length] ?? WORDS[0] ?? "Vibe";
}

export class BlurGlow {
  private readonly host: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGLRenderingContext | null;

  private blurProgram: WebGLProgram | null = null;
  private compositeProgram: WebGLProgram | null = null;
  private quad: WebGLBuffer | null = null;
  private maskA: WebGLTexture | null = null;
  private maskB: WebGLTexture | null = null;
  private focusA: [number, number] = [0.35, 0.65];
  private focusB: [number, number] = [0.35, 0.65];
  private levels: BloomLevel[] = [];
  private blurUniforms = {} as UniformMap<BlurUniformName>;
  private compositeUniforms = {} as UniformMap<CompositeUniformName>;

  private fontFamily = "sans-serif";
  private animationFrame = 0;
  private running = false;
  private destroyed = false;
  private startedAt = 0;
  private lastFrameAt = 0;
  private revealed = false;

  private wordIndex = 0;
  private paletteIndex = 0;
  private morph = 0;
  private morphing = false;
  private holdUntil = 0;
  private paletteFrom: PaletteUniforms = paletteUniforms(paletteAt(0));
  private paletteTo: PaletteUniforms = paletteUniforms(paletteAt(0));

  private cursorX = 0.5;
  private cursorY = 0.5;
  private targetX = 0.5;
  private targetY = 0.5;
  private cursorStrength = 0;
  private targetStrength = 0;
  private velocityX = 0;
  private velocityY = 0;
  private previousX = 0.5;
  private previousY = 0.5;

  constructor(host: HTMLElement) {
    this.host = host;
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    Object.assign(this.canvas.style, {
      display: "block",
      height: "100%",
      opacity: "0",
      transition: "opacity 0.4s ease",
      width: "100%",
    });
    host.appendChild(this.canvas);

    this.gl = this.canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
      premultipliedAlpha: false,
    });
    if (!this.gl) return;

    this.buildPrograms();
    if (!this.blurProgram || !this.compositeProgram) return;

    this.resolveFont();
    this.resize();
    host.addEventListener("pointermove", this.handlePointerMove);
    host.addEventListener("pointerleave", this.handlePointerLeave);
    host.addEventListener("pointercancel", this.handlePointerLeave);
  }

  isReady() {
    return Boolean(
      this.gl && this.blurProgram && this.compositeProgram && this.quad,
    );
  }

  private context() {
    if (!this.gl) throw new Error("WebGL is not available");
    return this.gl;
  }

  private compile(type: number, source: string): WebGLShader | null {
    const gl = this.context();
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("[blur-glow] shader:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private link(vertexSource: string, fragmentSource: string) {
    const gl = this.context();
    const vertex = this.compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = this.compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      return null;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      return null;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("[blur-glow] link:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }

    return program;
  }

  private buildPrograms() {
    const gl = this.context();
    this.quad = gl.createBuffer();
    if (!this.quad) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );

    this.blurProgram = this.link(VERT, BLUR_FRAG);
    this.compositeProgram = this.link(VERT, COMPOSITE_FRAG);
    if (!this.blurProgram || !this.compositeProgram) return;

    for (const name of BLUR_UNIFORMS) {
      this.blurUniforms[name] = gl.getUniformLocation(this.blurProgram, name);
    }
    for (const name of COMPOSITE_UNIFORMS) {
      const shaderName =
        name === "uPos" || name === "uCol" ? `${name}[0]` : name;
      this.compositeUniforms[name] = gl.getUniformLocation(
        this.compositeProgram,
        shaderName,
      );
    }
  }

  private bindQuad(program: WebGLProgram) {
    const gl = this.context();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const location = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  }

  private uploadPalette(uniforms: PaletteUniforms) {
    const gl = this.gl;
    if (!gl || !this.compositeProgram) return;

    // biome-ignore lint/correctness/useHookAtTopLevel: This is the WebGL API, not a React hook.
    gl.useProgram(this.compositeProgram);
    gl.uniform1fv(
      this.compositeUniforms.uPos,
      new Float32Array(uniforms.positions),
    );
    gl.uniform3fv(
      this.compositeUniforms.uCol,
      new Float32Array(uniforms.colors),
    );
    gl.uniform3fv(this.compositeUniforms.uInk, new Float32Array(uniforms.ink));
    gl.uniform3fv(
      this.compositeUniforms.uPaper,
      new Float32Array(uniforms.paper),
    );
  }

  private applyPalette(index: number) {
    this.paletteFrom = paletteUniforms(paletteAt(index));
    this.paletteTo = this.paletteFrom;
    this.uploadPalette(this.paletteFrom);
  }

  private resolveFont() {
    const styles = getComputedStyle(this.host);
    this.fontFamily =
      styles.getPropertyValue("--font-pangram").trim() ||
      styles.fontFamily ||
      "sans-serif";
  }

  private makeTarget(width: number, height: number): RenderTarget {
    const gl = this.context();
    const texture = gl.createTexture();
    if (!texture) throw new Error("Unable to allocate a WebGL texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
      gl.deleteTexture(texture);
      throw new Error("Unable to allocate a WebGL framebuffer");
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { framebuffer, height, texture, width };
  }

  private freeLevels() {
    const gl = this.gl;
    if (!gl) return;

    for (const level of this.levels) {
      gl.deleteFramebuffer(level.output.framebuffer);
      gl.deleteTexture(level.output.texture);
      gl.deleteFramebuffer(level.temporary.framebuffer);
      gl.deleteTexture(level.temporary.texture);
    }
    this.levels = [];
  }

  private allocateLevels() {
    this.freeLevels();
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.levels = LEVELS.map((level) => {
      const targetWidth = Math.max(2, Math.round(width * level.scale));
      const targetHeight = Math.max(2, Math.round(height * level.scale));
      return {
        output: this.makeTarget(targetWidth, targetHeight),
        temporary: this.makeTarget(targetWidth, targetHeight),
      };
    });
  }

  private uploadMask(source: HTMLCanvasElement, existing: WebGLTexture | null) {
    const gl = this.context();
    const texture = existing ?? gl.createTexture();
    if (!texture) throw new Error("Unable to allocate a WebGL mask texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  private buildMask() {
    if (!this.gl) return;
    const mask = makeWordMask(
      wordAt(this.wordIndex),
      this.canvas.width,
      this.canvas.height,
      this.fontFamily,
    );
    this.maskA = this.uploadMask(mask.canvas, this.maskA);
    this.focusA = [mask.x0, mask.x1];
  }

  private buildNextMask() {
    if (!this.gl) return;
    const mask = makeWordMask(
      wordAt(this.wordIndex + 1),
      this.canvas.width,
      this.canvas.height,
      this.fontFamily,
    );
    this.maskB = this.uploadMask(mask.canvas, this.maskB);
    this.focusB = [mask.x0, mask.x1];
  }

  private resize() {
    if (!this.gl) return;

    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const bounds = this.host.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width * devicePixelRatio));
    const height = Math.max(1, Math.round(bounds.height * devicePixelRatio));
    if (
      this.canvas.width === width &&
      this.canvas.height === height &&
      this.levels.length > 0
    ) {
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;
    this.allocateLevels();
    this.buildMask();
    this.buildNextMask();
    if (!this.morphing) this.applyPalette(this.paletteIndex);
  }

  private beginMorph() {
    this.morph = 0;
    this.morphing = true;
    this.paletteFrom = paletteUniforms(paletteAt(this.paletteIndex));
    this.paletteTo = paletteUniforms(paletteAt(this.paletteIndex + 1));
  }

  private finishMorph() {
    this.wordIndex = (this.wordIndex + 1) % WORDS.length;
    const mask = this.maskA;
    this.maskA = this.maskB;
    this.maskB = mask;
    this.focusA = this.focusB;
    this.morph = 0;
    this.morphing = false;
    this.buildNextMask();
    this.paletteIndex = (this.paletteIndex + 1) % PALETTES.length;
    this.paletteFrom = this.paletteTo;
    this.uploadPalette(this.paletteTo);
  }

  private render(bloom: number, phase: number) {
    const gl = this.gl;
    if (
      !gl ||
      !this.blurProgram ||
      !this.compositeProgram ||
      !this.maskA ||
      this.levels.length === 0
    ) {
      return;
    }

    // biome-ignore lint/correctness/useHookAtTopLevel: This is the WebGL API, not a React hook.
    gl.useProgram(this.blurProgram);
    this.bindQuad(this.blurProgram);
    gl.disable(gl.BLEND);

    const easedMorph =
      this.morph *
      this.morph *
      this.morph *
      (this.morph * (this.morph * 6 - 15) + 10);
    const glowMorph = easedMorph ** MORPH_LEAD;
    const bodyMorph = easedMorph ** MORPH_LAG;
    const clocks = (base: number): [number, number] => [
      Math.min(1, base * (1 + BREATH)),
      Math.max(0, Math.min(1, base * (1 + BREATH) - BREATH)),
    ];
    const [glowOut, glowIn] = clocks(glowMorph);
    const [bodyOut, bodyIn] = clocks(bodyMorph);
    const front = this.morphing ? Math.sin(Math.PI * easedMorph) : 0;
    const focusStart =
      this.focusA[0] + (this.focusB[0] - this.focusA[0]) * easedMorph;
    const focusEnd =
      this.focusA[1] + (this.focusB[1] - this.focusA[1]) * easedMorph;

    gl.uniform2f(this.blurUniforms.uFocus, focusStart, focusEnd);
    gl.uniform1f(this.blurUniforms.uFocusAmt, FOCUS_AMOUNT);
    gl.uniform1f(this.blurUniforms.uMorph, glowMorph);
    gl.uniform1f(this.blurUniforms.uPartOut, glowOut);
    gl.uniform1f(this.blurUniforms.uPartIn, glowIn);
    gl.uniform1f(this.blurUniforms.uLetterSpread, LETTER_SPREAD);

    for (let index = 0; index < this.levels.length; index++) {
      const level = this.levels[index];
      const levelConfig = LEVELS[index];
      if (!level || !levelConfig) continue;

      const sourceTexture =
        index === 0
          ? this.maskA
          : (this.levels[index - 1]?.output.texture ?? this.maskA);
      const useMorph = index === 0 && this.morphing ? 1 : 0;

      gl.bindFramebuffer(gl.FRAMEBUFFER, level.temporary.framebuffer);
      gl.viewport(0, 0, level.temporary.width, level.temporary.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
      gl.uniform1i(this.blurUniforms.uTex, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.maskB ?? this.maskA);
      gl.uniform1i(this.blurUniforms.uTexB, 1);
      gl.uniform1f(this.blurUniforms.uUseMorph, useMorph);
      gl.uniform2f(
        this.blurUniforms.uDir,
        levelConfig.radius / level.temporary.width,
        0,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, level.output.framebuffer);
      gl.viewport(0, 0, level.output.width, level.output.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, level.temporary.texture);
      gl.uniform1i(this.blurUniforms.uTex, 0);
      gl.uniform1f(this.blurUniforms.uUseMorph, 0);
      gl.uniform2f(
        this.blurUniforms.uDir,
        0,
        levelConfig.radius / level.output.height,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    // biome-ignore lint/correctness/useHookAtTopLevel: This is the WebGL API, not a React hook.
    gl.useProgram(this.compositeProgram);
    this.bindQuad(this.compositeProgram);
    if (this.morphing) {
      this.uploadPalette(
        lerpPaletteUniforms(this.paletteFrom, this.paletteTo, easedMorph),
      );
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.maskA);
    gl.uniform1i(this.compositeUniforms.uMask, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.maskB ?? this.maskA);
    gl.uniform1i(this.compositeUniforms.uMaskB, 1);

    const levelTextureUniforms = ["uL0", "uL1", "uL2", "uL3"] as const;
    for (let index = 0; index < this.levels.length; index++) {
      const level = this.levels[index];
      const uniformName = levelTextureUniforms[index];
      if (!level || !uniformName) continue;
      gl.activeTexture(gl.TEXTURE2 + index);
      gl.bindTexture(gl.TEXTURE_2D, level.output.texture);
      gl.uniform1i(this.compositeUniforms[uniformName], 2 + index);
    }

    gl.uniform2f(
      this.compositeUniforms.uRes,
      this.canvas.width,
      this.canvas.height,
    );
    gl.uniform1f(this.compositeUniforms.uMorph, bodyMorph);
    gl.uniform1f(this.compositeUniforms.uPartOut, bodyOut);
    gl.uniform1f(this.compositeUniforms.uPartIn, bodyIn);
    gl.uniform1f(this.compositeUniforms.uLetterSpread, LETTER_SPREAD);
    gl.uniform1f(this.compositeUniforms.uFront, front);
    gl.uniform2f(this.compositeUniforms.uCursor, this.cursorX, this.cursorY);
    gl.uniform1f(this.compositeUniforms.uCursorOn, this.cursorStrength);
    gl.uniform1f(this.compositeUniforms.uWarpRadius, WARP_RADIUS);
    gl.uniform1f(this.compositeUniforms.uWarpAmp, WARP_AMP);
    gl.uniform1f(this.compositeUniforms.uWarpSwirl, WARP_SWIRL);
    gl.uniform2f(
      this.compositeUniforms.uWarpVel,
      this.velocityX,
      this.velocityY,
    );
    gl.uniform1f(this.compositeUniforms.uWarpDrag, WARP_DRAG);
    gl.uniform1f(this.compositeUniforms.uWarpStretch, WARP_STRETCH);
    gl.uniform1f(this.compositeUniforms.uPhase, phase);
    gl.uniform1f(this.compositeUniforms.uBloom, bloom);

    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const castUniforms = ["uCast0", "uCast1", "uCast2", "uCast3"] as const;
    for (let index = 0; index < castUniforms.length; index++) {
      const uniformName = castUniforms[index];
      const step = CAST_STEP[index];
      if (!uniformName || step === undefined) continue;
      gl.uniform2f(
        this.compositeUniforms[uniformName],
        (CAST_DIR[0] * step) / aspect,
        CAST_DIR[1] * step,
      );
    }
    gl.uniform1f(this.compositeUniforms.uGrain, GRAIN);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.reveal();
  }

  private holdFor(index: number) {
    return HOLD_MILLISECONDS * (HOLD_SCALE[index % WORDS.length] ?? 1);
  }

  private frame = (now: number) => {
    if (!this.running || this.destroyed) return;
    if (!this.startedAt) {
      this.startedAt = now;
      this.lastFrameAt = now;
      this.holdUntil = now + this.holdFor(this.wordIndex);
    }

    const elapsed = (now - this.startedAt) / 1000;
    const delta = Math.min(
      0.05,
      Math.max(0.001, (now - this.lastFrameAt) / 1000),
    );
    this.lastFrameAt = now;
    this.cursorX = this.targetX;
    this.cursorY = this.targetY;
    this.cursorStrength +=
      (this.targetStrength - this.cursorStrength) *
      (1 - (1 - 0.42) ** (delta * 60));

    const velocityX = (this.cursorX - this.previousX) / delta;
    const velocityY = (this.cursorY - this.previousY) / delta;
    this.previousX = this.cursorX;
    this.previousY = this.cursorY;
    const velocityEase = 1 - (1 - 0.5) ** (delta * 60);
    this.velocityX += (velocityX - this.velocityX) * velocityEase;
    this.velocityY += (velocityY - this.velocityY) * velocityEase;
    const magnitude = Math.hypot(this.velocityX, this.velocityY);
    const maximumVelocity = 2.2;
    if (magnitude > maximumVelocity) {
      this.velocityX = (this.velocityX / magnitude) * maximumVelocity;
      this.velocityY = (this.velocityY / magnitude) * maximumVelocity;
    }

    if (CYCLE_WORDS) {
      if (!this.morphing && now >= this.holdUntil) this.beginMorph();
      if (this.morphing) {
        this.morph = Math.min(1, this.morph + delta / MORPH_SECONDS);
        if (this.morph >= 1) {
          this.finishMorph();
          this.holdUntil = now + this.holdFor(this.wordIndex);
        }
      }
    }

    const bloom = 1 + 0.16 * Math.sin(elapsed * 0.6);
    this.render(bloom, elapsed * 0.5);
    this.animationFrame = requestAnimationFrame(this.frame);
  };

  private reveal() {
    if (this.revealed) return;
    this.revealed = true;
    this.canvas.style.opacity = "1";
  }

  private handlePointerMove = (event: PointerEvent) => {
    const bounds = this.host.getBoundingClientRect();
    this.targetX = (event.clientX - bounds.left) / bounds.width;
    this.targetY = 1 - (event.clientY - bounds.top) / bounds.height;
    this.targetStrength = 1;
  };

  private handlePointerLeave = () => {
    this.targetStrength = 0;
  };

  start() {
    if (this.running || !this.isReady()) return;
    this.running = true;
    this.startedAt = 0;
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
  }

  renderStill(instant = false) {
    if (!this.isReady()) return;
    if (instant && !this.revealed) {
      this.canvas.style.transition = "none";
      this.revealed = true;
      this.canvas.style.opacity = "1";
    }
    this.render(1, 0);
  }

  refreshFont() {
    this.resolveFont();
    this.buildMask();
    this.buildNextMask();
    if (!this.running) this.renderStill();
  }

  onResize() {
    this.resize();
    if (!this.running) this.renderStill();
  }

  destroy() {
    this.destroyed = true;
    this.stop();
    this.host.removeEventListener("pointermove", this.handlePointerMove);
    this.host.removeEventListener("pointerleave", this.handlePointerLeave);
    this.host.removeEventListener("pointercancel", this.handlePointerLeave);

    const gl = this.gl;
    if (gl) {
      this.freeLevels();
      if (this.maskA) gl.deleteTexture(this.maskA);
      if (this.maskB) gl.deleteTexture(this.maskB);
      if (this.quad) gl.deleteBuffer(this.quad);
      if (this.blurProgram) gl.deleteProgram(this.blurProgram);
      if (this.compositeProgram) gl.deleteProgram(this.compositeProgram);
    }
    this.canvas.remove();
  }
}
