import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Layers, Clock, Eye, Activity } from 'lucide-react';

interface TomographyInspectorProps {
  texture3D: THREE.Data3DTexture | null;
  depth: number;
  width: number;
  height: number;
  currentScroll: number;
  onSeekTime?: (val: number) => void;
}

export const TomographyInspector: React.FC<TomographyInspectorProps> = ({
  texture3D,
  depth,
  width,
  height,
  currentScroll,
  onSeekTime,
}) => {
  const canvasXYRef = useRef<HTMLCanvasElement>(null);
  const canvasXTRef = useRef<HTMLCanvasElement>(null);

  // Render 2D orthogonal slices from DataTexture3D into 2D canvases
  useEffect(() => {
    if (!texture3D || !texture3D.image?.data) return;
    const data = texture3D.image.data as Uint8Array;
    const zIndex = Math.min(depth - 1, Math.max(0, Math.floor(currentScroll * (depth - 1))));

    // 1. Spatial XY slice at current Z
    const canvasXY = canvasXYRef.current;
    if (canvasXY) {
      const ctx = canvasXY.getContext('2d');
      if (ctx) {
        const imgData = ctx.createImageData(width, height);
        const zOffset = zIndex * width * height * 4;
        imgData.data.set(data.subarray(zOffset, zOffset + width * height * 4));
        ctx.putImageData(imgData, 0, 0);
      }
    }

    // 2. Slit-scan X-Time slice (cutting through center Y across all Z time slices)
    const canvasXT = canvasXTRef.current;
    if (canvasXT) {
      const ctx = canvasXT.getContext('2d');
      if (ctx) {
        const centerY = Math.floor(height / 2);
        const imgData = ctx.createImageData(width, depth);
        for (let z = 0; z < depth; z++) {
          for (let x = 0; x < width; x++) {
            const srcIdx = (z * width * height + centerY * width + x) * 4;
            const dstIdx = (z * width + x) * 4;
            imgData.data[dstIdx] = data[srcIdx];
            imgData.data[dstIdx + 1] = data[srcIdx + 1];
            imgData.data[dstIdx + 2] = data[srcIdx + 2];
            imgData.data[dstIdx + 3] = data[srcIdx + 3];
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }
    }
  }, [texture3D, currentScroll, depth, width, height]);

  if (!texture3D) return null;

  return (
    <div id="tomography-inspector" className="flex items-center gap-3">
      {/* XY Slice (Spatial frame at current time) */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl p-2.5 shadow-2xl flex flex-col items-center">
        <div className="flex items-center justify-between w-full mb-1.5 text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1 text-sky-400 font-semibold">
            <Eye className="w-3 h-3" /> XY Slice (Time)
          </span>
          <span>z = {(currentScroll * 100).toFixed(0)}%</span>
        </div>
        <div className="relative w-28 h-28 bg-black/60 rounded-lg overflow-hidden border border-slate-800">
          <canvas
            ref={canvasXYRef}
            width={width}
            height={height}
            className="w-full h-full object-cover"
          />
          {/* Spatial center crosshair */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-full h-[1px] bg-sky-400/20" />
          </div>
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="h-full w-[1px] bg-sky-400/20" />
          </div>
        </div>
      </div>

      {/* X-Time Slit-Scan (Space vs Time Tomography) */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl p-2.5 shadow-2xl flex flex-col items-center">
        <div className="flex items-center justify-between w-full mb-1.5 text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
            <Activity className="w-3 h-3" /> X-T Slit Scan
          </span>
          <span>Time Axis ↓</span>
        </div>
        <div
          className="relative w-28 h-28 bg-black/60 rounded-lg overflow-hidden border border-slate-800 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickY = (e.clientY - rect.top) / rect.height;
            onSeekTime?.(Math.min(1.0, Math.max(0.0, clickY)));
          }}
          title="Click to scrub time axis"
        >
          <canvas
            ref={canvasXTRef}
            width={width}
            height={depth}
            className="w-full h-full object-cover"
          />
          {/* Current time horizontal cursor */}
          <div
            className="absolute left-0 right-0 h-[2px] bg-sky-400 shadow-[0_0_8px_#38bdf8] pointer-events-none"
            style={{ top: `${currentScroll * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};
