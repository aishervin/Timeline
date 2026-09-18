import * as THREE from 'three';

export interface VideoSlice2D {
  texture: THREE.CanvasTexture;
  aspectRatio: number;
  index: number;
  time: number;
}

export interface VideoFrameDeckResult {
  slices: VideoSlice2D[];
  aspectRatio: number;
  duration: number;
  fps: number;
  totalFrames: number;
}

export interface DeckProgress {
  phase: 'idle' | 'loading-metadata' | 'extracting' | 'complete' | 'error';
  currentFrame: number;
  totalFrames: number;
  progress: number;
  message: string;
}

/**
 * Lightweight sequential 2D video frame extractor.
 * Converts video frames into crisp 2D photo slides placed along the time axis (Z).
 */
export class VideoFrameDeckExtractor {
  private activeVideo: HTMLVideoElement | null = null;
  private cancelled = false;

  public cancel() {
    this.cancelled = true;
    if (this.activeVideo) {
      this.activeVideo.pause();
      this.activeVideo.removeAttribute('src');
      this.activeVideo.load();
      this.activeVideo = null;
    }
  }

  /**
   * Extract video frames with user-chosen target frame count (default: 48-64 for smooth fluid playback)
   */
  public async extractFrames(
    file: File | Blob,
    targetFrames = 48,
    maxDimension = 512,
    onProgress?: (p: DeckProgress) => void
  ): Promise<VideoFrameDeckResult> {
    this.cancelled = false;
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    this.activeVideo = video;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;

    onProgress?.({
      phase: 'loading-metadata',
      currentFrame: 0,
      totalFrames: targetFrames,
      progress: 0.05,
      message: 'بارگذاری اطلاعات ویدیو...',
    });

    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        if (video.readyState >= 2) {
          resolve();
        } else {
          video.oncanplay = () => resolve();
        }
      };
      if (video.readyState >= 2) {
        resolve();
      } else {
        video.onloadedmetadata = onReady;
        video.onloadeddata = onReady;
        video.onerror = () => reject(new Error('خطا در بارگذاری ویدیو. لطفا فرمت فایل را بررسی کنید.'));
      }
    });

    try {
      await video.play();
      video.pause();
    } catch {
      // Autoplay guard
    }

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 3.0;
    const vWidth = video.videoWidth || 640;
    const vHeight = video.videoHeight || 360;
    const aspectRatio = vWidth / vHeight;

    // Calculate canvas size constrained to maxDimension for ultra-lightweight memory
    let renderWidth = vWidth;
    let renderHeight = vHeight;
    if (renderWidth > maxDimension || renderHeight > maxDimension) {
      if (renderWidth > renderHeight) {
        renderWidth = maxDimension;
        renderHeight = Math.round(maxDimension / aspectRatio);
      } else {
        renderHeight = maxDimension;
        renderWidth = Math.round(maxDimension * aspectRatio);
      }
    }

    // Number of frames to extract based on duration and target
    const count = Math.max(12, Math.min(96, targetFrames));
    const slices: VideoSlice2D[] = [];

    for (let i = 0; i < count; i++) {
      if (this.cancelled) {
        URL.revokeObjectURL(url);
        throw new Error('استخراج فریم‌ها لغو شد.');
      }

      const targetTime = (i / (count - 1)) * Math.max(0.01, duration - 0.04);

      // Seek video to target timestamp
      await new Promise<void>((resSeek) => {
        const handleSeeked = () => {
          video.removeEventListener('seeked', handleSeeked);
          resSeek();
        };
        video.addEventListener('seeked', handleSeeked);
        video.currentTime = targetTime;
      });

      // Draw onto a dedicated offscreen canvas for this frame
      const canvas = document.createElement('canvas');
      canvas.width = renderWidth;
      canvas.height = renderHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, renderWidth, renderHeight);
      }

      // Create a Three.js CanvasTexture for this photo slide
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;

      slices.push({
        texture,
        aspectRatio,
        index: i,
        time: targetTime,
      });

      onProgress?.({
        phase: 'extracting',
        currentFrame: i + 1,
        totalFrames: count,
        progress: (i + 1) / count,
        message: `استخراج اسلایدهای فریم ${i + 1} از ${count} (${targetTime.toFixed(2)} ثانیه)...`,
      });

      // Brief cooperative pause for UI smooth responsiveness
      await new Promise((r) => setTimeout(r, 6));
    }

    URL.revokeObjectURL(url);
    this.activeVideo = null;

    onProgress?.({
      phase: 'complete',
      currentFrame: count,
      totalFrames: count,
      progress: 1.0,
      message: 'اسلایدهای فریم ویدیویی با موفقیت ساخته شدند.',
    });

    return {
      slices,
      aspectRatio,
      duration,
      fps: count / duration,
      totalFrames: count,
    };
  }

  /**
   * Generates a synthetic Shibuya crosswalk slide sequence if no video is uploaded yet
   */
  public generateSyntheticSlides(count = 48): VideoFrameDeckResult {
    const width = 480;
    const height = 480;
    const aspectRatio = 1.0;
    const slices: VideoSlice2D[] = [];

    // Pedestrian simulation for clean clear 2D photo slides
    interface Walker {
      sx: number;
      sy: number;
      ex: number;
      ey: number;
      color: string;
      radius: number;
      speed: number;
      isRedCoat?: boolean;
    }

    const walkers: Walker[] = [
      { sx: 80, sy: 420, ex: 380, ey: 80, color: '#e11d48', radius: 11, speed: 1.0, isRedCoat: true },
      { sx: 360, sy: 410, ex: 100, ey: 90, color: '#d97706', radius: 9, speed: 0.88 },
      { sx: 240, sy: 430, ex: 250, ey: 70, color: '#3b82f6', radius: 9, speed: 1.1 },
      { sx: 70, sy: 340, ex: 410, ey: 120, color: '#10b981', radius: 8.5, speed: 1.15 },
      { sx: 390, sy: 320, ex: 120, ey: 130, color: '#8b5cf6', radius: 8, speed: 0.85 },
      { sx: 180, sy: 440, ex: 310, ey: 75, color: '#f59e0b', radius: 9, speed: 0.95 },
      { sx: 210, sy: 445, ex: 340, ey: 85, color: '#ec4899', radius: 8.5, speed: 0.92 },
      { sx: 60, sy: 260, ex: 420, ey: 210, color: '#06b6d4', radius: 10, speed: 1.4 },
    ];

    for (let f = 0; f < count; f++) {
      const t = f / (count - 1);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // 1. Asphalt Road
        ctx.fillStyle = '#1e2229';
        ctx.fillRect(0, 0, width, height);

        // 2. Crisp White Zebra Crosswalk Stripes
        ctx.fillStyle = '#f1f5f9';
        const stripeWidth = 26;
        const stripeGap = 32;
        for (let x = -80; x < width + 120; x += (stripeWidth + stripeGap)) {
          ctx.beginPath();
          ctx.moveTo(x, 70);
          ctx.lineTo(x + stripeWidth, 70);
          ctx.lineTo(x + stripeWidth - 65, 410);
          ctx.lineTo(x - 65, 410);
          ctx.closePath();
          ctx.fill();
        }

        // Sidewalk curbs
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, 0, width, 55);
        ctx.fillRect(0, 425, width, 55);

        // Yellow tactile pavement
        ctx.fillStyle = '#eab308';
        ctx.fillRect(20, 418, width - 40, 6);

        // 3. Pedestrians
        for (const w of walkers) {
          const prog = (t * w.speed) % 1.0;
          const px = w.sx + (w.ex - w.sx) * prog;
          const py = w.sy + (w.ey - w.sy) * prog;
          const bob = Math.sin(t * 30 * w.speed) * 2.5;

          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.beginPath();
          ctx.ellipse(px + 4, py + 6, w.radius * 1.1, w.radius * 0.5, 0.2, 0, Math.PI * 2);
          ctx.fill();

          // Body
          ctx.fillStyle = w.color;
          ctx.beginPath();
          ctx.arc(px, py + bob, w.radius, 0, Math.PI * 2);
          ctx.fill();

          // Head
          ctx.fillStyle = '#fed7aa';
          ctx.beginPath();
          ctx.arc(px, py - w.radius * 1.2 + bob, w.radius * 0.6, 0, Math.PI * 2);
          ctx.fill();

          // Special highlight for the red coat pedestrian
          if (w.isRedCoat) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(px, py + bob, w.radius + 2, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        // Frame number watermark
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '13px monospace';
        ctx.fillText(`FRAME #${f + 1} / ${count}`, 16, 32);
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;

      slices.push({
        texture,
        aspectRatio,
        index: f,
        time: (f / count) * 3.0,
      });
    }

    return {
      slices,
      aspectRatio,
      duration: 3.0,
      fps: count / 3.0,
      totalFrames: count,
    };
  }
}
