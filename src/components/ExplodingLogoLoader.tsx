import React, { useEffect, useRef } from 'react';
import { PRELOADED_LOGO } from '../utils/preloadLogo';

interface PixelParticle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  targetX?: number;
  targetY?: number;
}

interface ExplodingLogoLoaderProps {
  isExploding: boolean;
  onExplodeComplete?: () => void;
  progressPercent: number;
}

const LOGO_SRC =
  'https://github.com/aishervin/Xrayng/blob/main/Picsart_26-08-07_19-36-12-944.png?raw=true';

export const ExplodingLogoLoader: React.FC<ExplodingLogoLoaderProps> = ({
  isExploding,
  onExplodeComplete,
  progressPercent,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<PixelParticle[]>([]);
  const imgRef = useRef<HTMLImageElement>(PRELOADED_LOGO);
  const animFrameRef = useRef<number | null>(null);
  const rotationAngleRef = useRef<number>(0);
  const hasSampledRef = useRef<boolean>(false);
  const explodeStartedRef = useRef<boolean>(false);

  // Setup sampling as soon as preloaded image is ready or already loaded
  useEffect(() => {
    const processImageSampling = (img: HTMLImageElement) => {
      if (hasSampledRef.current) return;
      try {
        const offCanvas = document.createElement('canvas');
        const size = 120;
        offCanvas.width = size;
        offCanvas.height = size;
        const ctx = offCanvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, size, size);
        const imgData = ctx.getImageData(0, 0, size, size);
        const data = imgData.data;

        const particles: PixelParticle[] = [];
        const step = 3;

        for (let y = 0; y < size; y += step) {
          for (let x = 0; x < size; x += step) {
            const idx = (y * size + x) * 4;
            const a = data[idx + 3];
            if (a > 30) {
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              particles.push({
                x: (x - size / 2) * 1.8,
                y: (y - size / 2) * 1.8,
                originX: (x - size / 2) * 1.8,
                originY: (y - size / 2) * 1.8,
                vx: (Math.random() - 0.5) * 14 + (x - size / 2) * 0.12,
                vy: (Math.random() - 0.5) * 14 + (y - size / 2) * 0.12,
                size: Math.random() * 2.5 + 1.5,
                color: `rgb(${r}, ${g}, ${b})`,
                alpha: 1.0,
                decay: Math.random() * 0.015 + 0.01,
              });
            }
          }
        }
        particlesRef.current = particles;
        hasSampledRef.current = true;
      } catch (err) {
        console.warn('Canvas pixel sampling deferred or cors:', err);
      }
    };

    if (PRELOADED_LOGO.complete && PRELOADED_LOGO.naturalWidth > 0) {
      processImageSampling(PRELOADED_LOGO);
    } else {
      PRELOADED_LOGO.onload = () => processImageSampling(PRELOADED_LOGO);
    }
  }, []);

  // Main animation render loop: spins 3D around Y axis until exploding
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let startTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - startTime) / 1000;
      startTime = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      if (!isExploding) {
        // Continuous 3D rotation around vertical Y-axis
        rotationAngleRef.current += dt * 3.8; // Smooth 3D spin speed
        const cos = Math.cos(rotationAngleRef.current);
        const scaleX = cos; // Simulates 3D Y-axis perspective flip

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(scaleX, 1);

        // Holographic cyber glow shadow
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 18;

        if (imgRef.current && imgRef.current.complete) {
          const drawW = 140;
          const drawH = 140;
          ctx.drawImage(imgRef.current, -drawW / 2, -drawH / 2, drawW, drawH);
        }

        ctx.restore();
      } else {
        // Explosion phase: particles burst outward into 3D spacetime volume cube
        if (!explodeStartedRef.current) {
          explodeStartedRef.current = true;
        }

        const particles = particlesRef.current;
        let allDead = true;

        ctx.save();
        ctx.translate(centerX, centerY);

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (p.alpha <= 0.02) continue;
          allDead = false;

          // Expand outwards
          p.x += p.vx;
          p.y += p.vy;
          // Apply slight resistance and cube attraction
          p.vx *= 0.94;
          p.vy *= 0.94;
          p.alpha -= p.decay;

          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }

        ctx.restore();

        if (allDead && onExplodeComplete) {
          onExplodeComplete();
          return;
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isExploding, onExplodeComplete]);

  return (
    <div className="relative flex flex-col items-center justify-center pointer-events-none select-none">
      <canvas
        ref={canvasRef}
        width={360}
        height={360}
        className="w-[220px] h-[220px] sm:w-[260px] sm:h-[260px]"
      />
    </div>
  );
};
