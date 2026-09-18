/**
 * Native Browser Web Worker for Video Frame Extraction & 3D Spacetime Volume Baking
 * 
 * Spec:
 * - Uses OffscreenCanvas scaled to exactly 256x256
 * - Packs extracted RGBA pixel data into a single contiguous Uint8Array (256 * 256 * depth * 4)
 * - Returns buffer via Transferable Objects: postMessage({ buffer: data.buffer }, [data.buffer])
 */

let offscreenCanvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let packedBuffer: Uint8Array | null = null;
let totalFrames = 110;
let framesReceived = 0;
const VOLUME_WIDTH = 256;
const VOLUME_HEIGHT = 256;

// Initialize OffscreenCanvas
function getCanvasContext(): OffscreenCanvasRenderingContext2D {
  if (!offscreenCanvas) {
    offscreenCanvas = new OffscreenCanvas(VOLUME_WIDTH, VOLUME_HEIGHT);
  }
  if (!ctx) {
    ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }
  return ctx;
}

self.onmessage = async (e: MessageEvent) => {
  const { type } = e.data;

  switch (type) {
    case 'INIT': {
      totalFrames = e.data.depth || 110;
      framesReceived = 0;
      const totalBytes = VOLUME_WIDTH * VOLUME_HEIGHT * totalFrames * 4;
      packedBuffer = new Uint8Array(totalBytes);
      self.postMessage({ type: 'INIT_DONE', totalFrames, totalBytes });
      break;
    }

    case 'FRAME_BITMAP': {
      // Received a transferred ImageBitmap from main thread's video seek
      const { bitmap, frameIndex, depth } = e.data;
      if (!packedBuffer) {
        totalFrames = depth || 110;
        packedBuffer = new Uint8Array(VOLUME_WIDTH * VOLUME_HEIGHT * totalFrames * 4);
      }

      const context = getCanvasContext();
      context.clearRect(0, 0, VOLUME_WIDTH, VOLUME_HEIGHT);
      // Scale exactly to 256x256
      context.drawImage(bitmap, 0, 0, VOLUME_WIDTH, VOLUME_HEIGHT);
      
      // Close bitmap immediately to release GPU/RAM
      bitmap.close();

      const imgData = context.getImageData(0, 0, VOLUME_WIDTH, VOLUME_HEIGHT);
      const byteOffset = frameIndex * VOLUME_WIDTH * VOLUME_HEIGHT * 4;
      packedBuffer.set(imgData.data, byteOffset);

      framesReceived++;
      const progress = framesReceived / totalFrames;

      self.postMessage({
        type: 'PROGRESS',
        frameIndex,
        totalFrames,
        progress: Math.min(1.0, progress),
      });

      if (framesReceived >= totalFrames) {
        // Transfer contiguous buffer back to main thread
        const bufferToTransfer = packedBuffer.buffer;
        packedBuffer = null; // Detach reference
        (self as any).postMessage(
          {
            type: 'COMPLETE',
            buffer: bufferToTransfer,
            width: VOLUME_WIDTH,
            height: VOLUME_HEIGHT,
            depth: totalFrames,
          },
          [bufferToTransfer]
        );
      }
      break;
    }

    case 'FRAME_RAW_DATA': {
      // Direct raw pixel array transferred from fallback canvas
      const { data, frameIndex, depth } = e.data;
      if (!packedBuffer) {
        totalFrames = depth || 110;
        packedBuffer = new Uint8Array(VOLUME_WIDTH * VOLUME_HEIGHT * totalFrames * 4);
      }

      const byteOffset = frameIndex * VOLUME_WIDTH * VOLUME_HEIGHT * 4;
      packedBuffer.set(data, byteOffset);

      framesReceived++;
      const progress = framesReceived / totalFrames;

      self.postMessage({
        type: 'PROGRESS',
        frameIndex,
        totalFrames,
        progress: Math.min(1.0, progress),
      });

      if (framesReceived >= totalFrames) {
        const bufferToTransfer = packedBuffer.buffer;
        packedBuffer = null;
        (self as any).postMessage(
          {
            type: 'COMPLETE',
            buffer: bufferToTransfer,
            width: VOLUME_WIDTH,
            height: VOLUME_HEIGHT,
            depth: totalFrames,
          },
          [bufferToTransfer]
        );
      }
      break;
    }

    case 'GENERATE_SHIBUYA_CROSSWALK': {
      // Built-in synthetic Shibuya pedestrian crosswalk generator (matching the prompt's video reference)
      // Generates high-fidelity temporal tomography sequences with pedestrians, zebra stripes, and motion paths
      totalFrames = e.data.depth || 110;
      const context = getCanvasContext();
      const totalBytes = VOLUME_WIDTH * VOLUME_HEIGHT * totalFrames * 4;
      packedBuffer = new Uint8Array(totalBytes);

      // Define synthetic pedestrian agents
      interface Agent {
        startX: number;
        startY: number;
        endX: number;
        endY: number;
        color: [number, number, number];
        size: number;
        speed: number;
        hasCoat?: boolean;
      }

      const agents: Agent[] = [
        // Lady in prominent red coat crossing diagonally (just like in the video!)
        { startX: 60, startY: 220, endX: 190, endY: 40, color: [220, 35, 45], size: 7, speed: 0.95, hasCoat: true },
        // Person in beige trench coat
        { startX: 180, startY: 210, endX: 70, endY: 50, color: [210, 180, 140], size: 6, speed: 0.85 },
        // Business commuter in dark charcoal suit
        { startX: 120, startY: 230, endX: 130, endY: 30, color: [45, 50, 60], size: 6.5, speed: 1.05 },
        // Fast walker in bright yellow jacket
        { startX: 40, startY: 190, endX: 210, endY: 60, color: [235, 195, 30], size: 6, speed: 1.2 },
        // Pedestrian with cyan umbrella/backpack
        { startX: 200, startY: 180, endX: 80, endY: 70, color: [30, 180, 210], size: 5.5, speed: 0.8 },
        // Group of pedestrians moving together
        { startX: 90, startY: 240, endX: 160, endY: 35, color: [80, 90, 100], size: 6, speed: 0.9 },
        { startX: 105, startY: 245, endX: 175, endY: 40, color: [160, 60, 120], size: 5.5, speed: 0.9 },
        // Fast courier / cyclist
        { startX: 30, startY: 140, endX: 230, endY: 110, color: [240, 120, 30], size: 8, speed: 1.6 },
        // Background crowd streams
        { startX: 140, startY: 220, endX: 120, endY: 45, color: [50, 55, 65], size: 5, speed: 0.75 },
        { startX: 160, startY: 230, endX: 100, endY: 55, color: [90, 85, 95], size: 5.5, speed: 0.82 },
        { startX: 75, startY: 200, endX: 180, endY: 65, color: [180, 185, 190], size: 6, speed: 0.88 },
        { startX: 110, startY: 195, endX: 140, endY: 50, color: [40, 42, 50], size: 6, speed: 1.0 },
      ];

      for (let f = 0; f < totalFrames; f++) {
        const t = f / (totalFrames - 1); // 0.0 to 1.0

        // 1. Draw Tokyo asphalt road background
        context.fillStyle = '#2b2d31';
        context.fillRect(0, 0, VOLUME_WIDTH, VOLUME_HEIGHT);

        // Subtle road asphalt texture
        context.fillStyle = 'rgba(255, 255, 255, 0.03)';
        for (let i = 0; i < 40; i++) {
          const rx = (i * 37) % VOLUME_WIDTH;
          const ry = (i * 59) % VOLUME_HEIGHT;
          context.fillRect(rx, ry, 2, 2);
        }

        // 2. Draw crisp diagonal zebra stripes (pedestrian crosswalk)
        context.save();
        context.fillStyle = '#e8ebed';
        context.shadowColor = 'rgba(0, 0, 0, 0.15)';
        context.shadowBlur = 2;
        
        // Parallel crosswalk stripes tilted at 22 degrees
        const stripeWidth = 14;
        const stripeGap = 16;
        for (let x = -50; x < VOLUME_WIDTH + 80; x += (stripeWidth + stripeGap)) {
          context.beginPath();
          context.moveTo(x, 50);
          context.lineTo(x + stripeWidth, 50);
          context.lineTo(x + stripeWidth - 40, 210);
          context.lineTo(x - 40, 210);
          context.closePath();
          context.fill();
        }

        // Stop line / sidewalk boundary
        context.fillStyle = '#f0a500'; // Yellow tactile paving
        context.fillRect(20, 218, VOLUME_WIDTH - 40, 4);
        context.fillStyle = '#3a3d42'; // Curbside building edge
        context.fillRect(0, 0, VOLUME_WIDTH, 35);
        context.fillRect(0, 228, VOLUME_WIDTH, 28);
        context.restore();

        // 3. Draw moving pedestrian agents with shadows and gait
        for (let a = 0; a < agents.length; a++) {
          const agent = agents[a];
          // Parametric progression with speed offset
          const localProgress = (t * agent.speed) % 1.0;
          const posX = agent.startX + (agent.endX - agent.startX) * localProgress;
          const posY = agent.startY + (agent.endY - agent.startY) * localProgress;

          // Subtle walking bobbing motion
          const bob = Math.sin(t * 40 * agent.speed) * 1.5;

          // Shadow
          context.save();
          context.fillStyle = 'rgba(15, 17, 20, 0.55)';
          context.beginPath();
          context.ellipse(posX + 3, posY + 4, agent.size * 0.9, agent.size * 0.45, 0.3, 0, Math.PI * 2);
          context.fill();

          // Person body silhouette / clothes
          context.fillStyle = `rgb(${agent.color[0]}, ${agent.color[1]}, ${agent.color[2]})`;
          context.beginPath();
          context.arc(posX, posY - 2 + bob, agent.size * 0.75, 0, Math.PI * 2);
          context.fill();

          // Person head
          context.fillStyle = '#e8c4a2';
          context.beginPath();
          context.arc(posX, posY - agent.size * 1.1 + bob, agent.size * 0.42, 0, Math.PI * 2);
          context.fill();

          // If wearing distinctive coat/hat
          if (agent.hasCoat) {
            context.fillStyle = '#ff3344';
            context.beginPath();
            context.ellipse(posX, posY + bob, agent.size * 0.85, agent.size * 0.6, -0.2, 0, Math.PI * 2);
            context.fill();
          }

          context.restore();
        }

        // Grab pixels and copy into contiguous buffer
        const imgData = context.getImageData(0, 0, VOLUME_WIDTH, VOLUME_HEIGHT);
        const byteOffset = f * VOLUME_WIDTH * VOLUME_HEIGHT * 4;
        packedBuffer.set(imgData.data, byteOffset);

        if (f % 5 === 0 || f === totalFrames - 1) {
          self.postMessage({
            type: 'PROGRESS',
            frameIndex: f,
            totalFrames,
            progress: (f + 1) / totalFrames,
          });
        }
      }

      // Transfer contiguous buffer back to main thread
      const bufferToTransfer = packedBuffer.buffer;
      packedBuffer = null;
      (self as any).postMessage(
        {
          type: 'COMPLETE',
          buffer: bufferToTransfer,
          width: VOLUME_WIDTH,
          height: VOLUME_HEIGHT,
          depth: totalFrames,
        },
        [bufferToTransfer]
      );
      break;
    }

    default:
      console.warn('Unknown worker message type:', type);
  }
};
