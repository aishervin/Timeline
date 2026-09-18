import * as THREE from 'three';
import VideoBakeWorker from '../workers/VideoBakeWorker?worker';

export interface BakeProgress {
  phase: 'idle' | 'loading-metadata' | 'extracting-frames' | 'generating-synthetic' | 'complete' | 'error';
  progress: number; // 0.0 to 1.0
  currentFrame: number;
  totalFrames: number;
  message: string;
}

export interface VolumeBakeResult {
  texture3D: THREE.Data3DTexture;
  width: number;
  height: number;
  depth: number;
  videoDuration?: number;
  aspectRatio: number;
}

export class SpacetimeVideoBaker {
  private worker: Worker | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker(): Worker {
    if (this.worker) {
      this.worker.terminate();
    }
    this.worker = new VideoBakeWorker();
    return this.worker;
  }

  /**
   * Bake synthetic crosswalk dataset directly inside the Web Worker
   */
  public async bakeSyntheticCrosswalk(
    depth = 110,
    onProgress?: (p: BakeProgress) => void
  ): Promise<VolumeBakeResult> {
    const worker = this.initWorker();

    onProgress?.({
      phase: 'generating-synthetic',
      progress: 0.05,
      currentFrame: 0,
      totalFrames: depth,
      message: 'Synthesizing Shibuya Pedestrian Crosswalk in Web Worker...',
    });

    return new Promise((resolve, reject) => {
      worker.onmessage = (e: MessageEvent) => {
        const { type } = e.data;
        if (type === 'PROGRESS') {
          onProgress?.({
            phase: 'generating-synthetic',
            progress: e.data.progress,
            currentFrame: e.data.frameIndex + 1,
            totalFrames: depth,
            message: `Baking spacetime volume frames (${e.data.frameIndex + 1}/${depth})...`,
          });
        } else if (type === 'COMPLETE') {
          const { buffer, width, height, depth: bakedDepth } = e.data;
          const uint8Array = new Uint8Array(buffer);
          const texture3D = new THREE.Data3DTexture(uint8Array, width, height, bakedDepth);
          texture3D.format = THREE.RGBAFormat;
          texture3D.type = THREE.UnsignedByteType;
          texture3D.minFilter = THREE.LinearFilter;
          texture3D.magFilter = THREE.LinearFilter;
          texture3D.wrapS = THREE.ClampToEdgeWrapping;
          texture3D.wrapT = THREE.ClampToEdgeWrapping;
          texture3D.wrapR = THREE.ClampToEdgeWrapping;
          texture3D.generateMipmaps = false;
          texture3D.needsUpdate = true;

          onProgress?.({
            phase: 'complete',
            progress: 1.0,
            currentFrame: depth,
            totalFrames: depth,
            message: 'Spacetime Volume built successfully.',
          });

          resolve({
            texture3D,
            width,
            height,
            depth: bakedDepth,
            aspectRatio: 1.0,
          });
        }
      };

      worker.onerror = (err) => {
        onProgress?.({
          phase: 'error',
          progress: 0,
          currentFrame: 0,
          totalFrames: depth,
          message: `Worker error: ${err.message}`,
        });
        reject(err);
      };

      worker.postMessage({
        type: 'GENERATE_SHIBUYA_CROSSWALK',
        depth,
      });
    });
  }

  /**
   * Bake user-uploaded video file into a 3D DataTexture3D
   * Uses HTMLVideoElement + 'seeked' event on main thread,
   * transfers ImageBitmaps to Worker for zero-copy 256x256 extraction and contiguous packing.
   */
  public async bakeUploadedVideo(
    videoFile: File | Blob,
    targetFrames = 110,
    onProgress?: (p: BakeProgress) => void
  ): Promise<VolumeBakeResult> {
    const worker = this.initWorker();
    const videoUrl = URL.createObjectURL(videoFile);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = videoUrl;

    onProgress?.({
      phase: 'loading-metadata',
      progress: 0.02,
      currentFrame: 0,
      totalFrames: targetFrames,
      message: 'Loading video metadata...',
    });

    // Wait for video metadata and data to be ready
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        if (video.readyState >= 2) {
          resolve();
        } else {
          video.oncanplay = () => resolve();
        }
      };
      if (video.readyState >= 2) {
        resolve();
      } else {
        video.onloadeddata = onLoaded;
        video.onloadedmetadata = onLoaded;
        video.onerror = () => reject(new Error('Failed to load video file. Please check video format.'));
      }
    });

    // Ensure video is primed
    try {
      await video.play();
      video.pause();
    } catch {
      // autoplay restriction might trigger, muted playsinline allows it usually
    }

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 3.0;
    const width = video.videoWidth || 256;
    const height = video.videoHeight || 256;
    const aspectRatio = width / height;

    // Fallback 2D canvas in case createImageBitmap fails or throws
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 256;
    fallbackCanvas.height = 256;
    const fallbackCtx = fallbackCanvas.getContext('2d', { willReadFrequently: true });

    // Initialize worker buffer
    worker.postMessage({
      type: 'INIT',
      depth: targetFrames,
    });

    return new Promise((resolve, reject) => {
      let isCompleted = false;

      worker.onmessage = (e: MessageEvent) => {
        const { type } = e.data;
        if (type === 'COMPLETE') {
          isCompleted = true;
          const { buffer, width, height, depth } = e.data;
          URL.revokeObjectURL(videoUrl);
          video.remove();

          const uint8Array = new Uint8Array(buffer);
          const texture3D = new THREE.Data3DTexture(uint8Array, width, height, depth);
          texture3D.format = THREE.RGBAFormat;
          texture3D.type = THREE.UnsignedByteType;
          texture3D.minFilter = THREE.LinearFilter;
          texture3D.magFilter = THREE.LinearFilter;
          texture3D.wrapS = THREE.ClampToEdgeWrapping;
          texture3D.wrapT = THREE.ClampToEdgeWrapping;
          texture3D.wrapR = THREE.ClampToEdgeWrapping;
          texture3D.generateMipmaps = false;
          texture3D.needsUpdate = true;

          onProgress?.({
            phase: 'complete',
            progress: 1.0,
            currentFrame: depth,
            totalFrames: depth,
            message: 'Spacetime Volume built successfully.',
          });

          resolve({
            texture3D,
            width,
            height,
            depth,
            videoDuration: duration,
            aspectRatio,
          });
        }
      };

      worker.onerror = (err) => {
        URL.revokeObjectURL(videoUrl);
        video.remove();
        onProgress?.({
          phase: 'error',
          progress: 0,
          currentFrame: 0,
          totalFrames: targetFrames,
          message: `Worker error: ${err.message}`,
        });
        reject(err);
      };

      // Sequential frame extraction
      (async () => {
        try {
          for (let i = 0; i < targetFrames; i++) {
            if (isCompleted) break;
            const targetTime = (i / (targetFrames - 1)) * Math.max(0.01, duration - 0.05);

            await new Promise<void>((resSeek) => {
              const handleSeeked = () => {
                video.removeEventListener('seeked', handleSeeked);
                resSeek();
              };
              video.addEventListener('seeked', handleSeeked);
              video.currentTime = targetTime;
            });

            onProgress?.({
              phase: 'extracting-frames',
              progress: (i + 1) / targetFrames,
              currentFrame: i + 1,
              totalFrames: targetFrames,
              message: `Decoding & packing frame ${i + 1} of ${targetFrames} (${(targetTime).toFixed(2)}s)...`,
            });

            // Extract frame with createImageBitmap or fallback to canvas drawImage
            let bitmapDispatched = false;
            try {
              if (typeof createImageBitmap === 'function') {
                const bitmap = await createImageBitmap(video);
                worker.postMessage(
                  {
                    type: 'FRAME_BITMAP',
                    bitmap,
                    frameIndex: i,
                    depth: targetFrames,
                  },
                  [bitmap]
                );
                bitmapDispatched = true;
              }
            } catch {
              bitmapDispatched = false;
            }

            if (!bitmapDispatched) {
              // Fallback for browsers/environments where createImageBitmap(HTMLVideoElement) rejects
              if (fallbackCtx) {
                fallbackCtx.clearRect(0, 0, 256, 256);
                fallbackCtx.drawImage(video, 0, 0, 256, 256);
                const imgData = fallbackCtx.getImageData(0, 0, 256, 256);
                const rawBuffer = imgData.data.buffer;
                worker.postMessage(
                  {
                    type: 'FRAME_RAW_DATA',
                    data: imgData.data,
                    frameIndex: i,
                    depth: targetFrames,
                  },
                  [rawBuffer]
                );
              }
            }

            // Yield briefly to ensure UI responsiveness
            await new Promise((r) => setTimeout(r, 4));
          }
        } catch (err: any) {
          reject(err);
        }
      })();
    });
  }

  public dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
