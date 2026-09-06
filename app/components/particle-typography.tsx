import { useEffect, useRef } from "react";

interface ParticleTypographyProps {
  text: string;
  mobileText?: string;
  className?: string;
  fontSize?: number;
  particleSize?: number;
  particleDensity?: number;
  dispersionStrength?: number;
  returnSpeed?: number;
}

class Particle {
  x: number;
  y: number;
  readonly originX: number;
  readonly originY: number;
  vx: number;
  vy: number;
  readonly size: number;
  color: string;
  readonly dispersion: number;
  readonly returnSpeed: number;

  constructor(
    x: number,
    y: number,
    size: number,
    color: string,
    dispersion: number,
    returnSpeed: number,
  ) {
    this.x = x + (Math.random() - 0.5) * 10;
    this.y = y + (Math.random() - 0.5) * 10;
    this.originX = x;
    this.originY = y;
    this.vx = (Math.random() - 0.5) * 5;
    this.vy = (Math.random() - 0.5) * 5;
    this.size = size;
    this.color = color;
    this.dispersion = dispersion;
    this.returnSpeed = returnSpeed;
  }

  update(mouseX: number, mouseY: number) {
    const dx = mouseX - this.x;
    const dy = mouseY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0 && distance < 120 && mouseX !== -1000) {
      const force = (120 - distance) / 120;
      this.vx -= (dx / distance) * force * this.dispersion;
      this.vy -= (dy / distance) * force * this.dispersion;
    }

    this.vx += (this.originX - this.x) * this.returnSpeed;
    this.vy += (this.originY - this.y) * this.returnSpeed;
    this.vx *= 0.85;
    this.vy *= 0.85;
    this.x += this.vx;
    this.y += this.vy;
  }

  draw(context: CanvasRenderingContext2D) {
    context.fillStyle = this.color;
    context.fillRect(this.x, this.y, this.size, this.size);
  }
}

export function ParticleTypography({
  text,
  mobileText,
  className,
  fontSize = 120,
  particleSize = 1.5,
  particleDensity = 6,
  dispersionStrength = 15,
  returnSpeed = 0.08,
}: ParticleTypographyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !container || !context) return;

    let animationFrame = 0;
    let particles: Particle[] = [];
    let mouseX = -1000;
    let mouseY = -1000;
    let width = 0;
    let height = 0;
    let disposed = false;
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const mobileLayout = window.matchMedia("(max-width: 680px)");

    const draw = () => {
      context.clearRect(0, 0, width, height);
      for (const particle of particles) particle.draw(context);
    };

    const settle = () => {
      for (const particle of particles) {
        particle.x = particle.originX;
        particle.y = particle.originY;
        particle.vx = 0;
        particle.vy = 0;
      }
      draw();
    };

    const initialize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      if (!width || !height) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const color = getComputedStyle(container).color;
      const fontFamily = getComputedStyle(container).fontFamily;
      context.font = `800 ${fontSize}px ${fontFamily}`;
      const lines = (
        mobileText && mobileLayout.matches ? mobileText : text
      ).split("\n");
      const measuredWidth = Math.max(
        ...lines.map((line) => context.measureText(line).width),
      );
      const lineSpacing = mobileLayout.matches ? 1.16 : 1.25;
      const effectiveFontSize = Math.min(
        fontSize,
        measuredWidth > 0
          ? (fontSize * width * 0.94) / measuredWidth
          : fontSize,
        (height * 0.8) / (lines.length * lineSpacing),
      );
      context.font = `800 ${effectiveFontSize}px ${fontFamily}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = color;
      const lineHeight = effectiveFontSize * lineSpacing;
      const firstLineY = (height - (lines.length - 1) * lineHeight) / 2;
      for (const [index, line] of lines.entries()) {
        context.fillText(line, width / 2, firstLineY + index * lineHeight);
      }

      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const detailScale = Math.min(1, effectiveFontSize / 80);
      const density = Math.max(1, particleDensity * detailScale);
      const step = Math.max(1, Math.floor(density * dpr));
      // Fill each sampled cell so the background cannot dilute the accent.
      const cellSize = Math.max(
        step / dpr,
        particleSize * Math.max(0.5, detailScale) * 2,
      );
      particles = [];
      for (let y = 0; y < pixels.height; y += step) {
        for (let x = 0; x < pixels.width; x += step) {
          const alpha = pixels.data[(y * pixels.width + x) * 4 + 3] ?? 0;
          if (alpha > 128) {
            particles.push(
              new Particle(
                x / dpr,
                y / dpr,
                cellSize,
                color,
                dispersionStrength,
                returnSpeed,
              ),
            );
          }
        }
      }
      if (motionPreference.matches) settle();
      else draw();
    };

    const animate = () => {
      for (const particle of particles) {
        particle.update(mouseX, mouseY);
      }
      draw();
      if (!disposed) animationFrame = requestAnimationFrame(animate);
    };

    const syncMotion = () => {
      cancelAnimationFrame(animationFrame);
      if (motionPreference.matches) settle();
      else animationFrame = requestAnimationFrame(animate);
    };

    const syncColor = () => {
      const color = getComputedStyle(container).color;
      for (const particle of particles) particle.color = color;
      draw();
    };

    const updatePointer = (event: MouseEvent | Touch) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = event.clientX - rect.left;
      mouseY = event.clientY - rect.top;
    };
    const clearPointer = () => {
      mouseX = -1000;
      mouseY = -1000;
    };
    const handleResize = () => initialize();
    const handleMouseMove = (event: MouseEvent) => updatePointer(event);
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches[0]) updatePointer(event.touches[0]);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    const themeObserver = new MutationObserver(syncColor);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-accent"],
    });
    motionPreference.addEventListener("change", syncMotion);
    mobileLayout.addEventListener("change", initialize);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", clearPointer);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true });
    canvas.addEventListener("touchend", clearPointer);
    initialize();
    syncMotion();
    void document.fonts.ready.then(() => {
      if (!disposed) initialize();
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      motionPreference.removeEventListener("change", syncMotion);
      mobileLayout.removeEventListener("change", initialize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", clearPointer);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", clearPointer);
    };
  }, [
    text,
    mobileText,
    fontSize,
    particleSize,
    particleDensity,
    dispersionStrength,
    returnSpeed,
  ]);

  return (
    <div
      aria-label={text}
      className={`hero-copy particle-typography${className ? ` ${className}` : ""}`}
      ref={containerRef}
      role="img"
    >
      <canvas className="particle-canvas" ref={canvasRef} />
      <span className="sr-only">{text}</span>
    </div>
  );
}
