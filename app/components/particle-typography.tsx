import { useEffect, useRef } from "react";

interface ParticleTypographyProps {
  text: string;
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
  readonly color: string;
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
    context.beginPath();
    context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    context.fill();
  }
}

export function ParticleTypography({
  text,
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
      const measuredWidth = context.measureText(text).width;
      const effectiveFontSize = Math.min(
        fontSize,
        measuredWidth > 0 ? (fontSize * width * 0.9) / measuredWidth : fontSize,
      );
      context.font = `800 ${effectiveFontSize}px ${fontFamily}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = color;
      context.fillText(text, width / 2, height / 2);

      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const step = Math.max(1, Math.floor(particleDensity * dpr));
      particles = [];
      for (let y = 0; y < pixels.height; y += step) {
        for (let x = 0; x < pixels.width; x += step) {
          const alpha = pixels.data[(y * pixels.width + x) * 4 + 3] ?? 0;
          if (alpha > 128) {
            particles.push(
              new Particle(
                x / dpr,
                y / dpr,
                particleSize,
                color,
                dispersionStrength,
                returnSpeed,
              ),
            );
          }
        }
      }
    };

    const animate = () => {
      context.clearRect(0, 0, width, height);
      for (const particle of particles) {
        particle.update(mouseX, mouseY);
        particle.draw(context);
      }
      if (!disposed) animationFrame = requestAnimationFrame(animate);
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
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", clearPointer);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true });
    canvas.addEventListener("touchend", clearPointer);
    initialize();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const particle of particles) {
        particle.x = particle.originX;
        particle.y = particle.originY;
      }
      for (const particle of particles) particle.draw(context);
    } else {
      animationFrame = requestAnimationFrame(animate);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", clearPointer);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", clearPointer);
    };
  }, [
    text,
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
