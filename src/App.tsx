import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Upload, Film, Eye, EyeOff, Sliders } from 'lucide-react';
import { SpacetimeVolume } from './components/SpacetimeVolume';
import { VideoUploader } from './components/VideoUploader';
import { MobileFriendlyScrubber } from './components/MobileFriendlyScrubber';
import { SettingsDrawer, AppSettings } from './components/SettingsDrawer';
import { IntroPrismOverlay } from './components/IntroPrismOverlay';
import { ExplodingLogoLoader } from './components/ExplodingLogoLoader';
import { VideoFrameDeckExtractor, VideoSlice2D, DeckProgress } from './services/deckExtractor';
import { BakeProgress } from './services/videoBaker';

export default function App() {
  const [showIntro, setShowIntro] = useState<boolean>(true);
  const [isExploding, setIsExploding] = useState<boolean>(false);
  const [slices, setSlices] = useState<VideoSlice2D[]>([]);
  const [targetFrameCount, setTargetFrameCount] = useState<number>(48);
  const [hudVisible, setHudVisible] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // User Customizable Settings
  const [settings, setSettings] = useState<AppSettings>({
    depthScale: 1.2,
    fadePast: true,
    pastOpacity: 0.45,
    showLaboratoryFrame: true, // Keep the 3D bounding spacetime cube visible
    showGrid: true,
    autoRotate: false,
    playSpeed: 0.25,
  });

  const [volumeMeta, setVolumeMeta] = useState<{
    width: number;
    height: number;
    depth: number;
    aspectRatio: number;
    name: string | null;
  }>({
    width: 0,
    height: 0,
    depth: 0,
    aspectRatio: 1.0,
    name: null,
  });

  const [currentScroll, setCurrentScroll] = useState<number>(1.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBaking, setIsBaking] = useState<boolean>(false);
  const [progress, setProgress] = useState<BakeProgress>({
    phase: 'idle',
    progress: 0,
    currentFrame: 0,
    totalFrames: 48,
    message: '',
  });

  const deckExtractorRef = useRef<VideoFrameDeckExtractor | null>(null);
  const controlsRef = useRef<any>(null);
  const headerFileInputRef = useRef<HTMLInputElement>(null);

  // Initialize extractor
  useEffect(() => {
    deckExtractorRef.current = new VideoFrameDeckExtractor();

    return () => {
      deckExtractorRef.current?.cancel();
      slices.forEach((s) => s.texture.dispose());
    };
  }, []);

  // Handle uploaded video file -> Extract lightweight 2D photo slices along Z axis
  const handleVideoUpload = useCallback(async (file: File, frameCount: number) => {
    if (!deckExtractorRef.current) return;
    setIsBaking(true);
    setIsExploding(false);
    try {
      const result = await deckExtractorRef.current.extractFrames(
        file,
        frameCount,
        512,
        (p: DeckProgress) => {
          setProgress({
            phase: p.phase === 'extracting' ? 'extracting-frames' : (p.phase as any),
            progress: p.progress,
            currentFrame: p.currentFrame,
            totalFrames: p.totalFrames,
            message: p.message,
          });
        }
      );

      // Clean up previous textures
      setSlices((prev) => {
        prev.forEach((s) => s.texture.dispose());
        return result.slices;
      });

      // Exactly set dimensions matching the video aspect ratio
      setVolumeMeta({
        width: 512,
        height: Math.round(512 / result.aspectRatio),
        depth: result.totalFrames,
        aspectRatio: result.aspectRatio,
        name: file.name,
      });

      // Trigger the spectacular pixel explosion into the spacetime cube
      setIsExploding(true);

      // Start scrubber at 1.0 (end of sequence)
      setCurrentScroll(1.0);

      // Allow explosion particles to disperse gracefully before fading out baking overlay
      setTimeout(() => {
        setIsBaking(false);
        setIsExploding(false);
      }, 1200);
    } catch (err) {
      console.error('Failed to extract video frames:', err);
      setIsBaking(false);
      setIsExploding(false);
    }
  }, []);

  // Smooth animation playback loop for the interactive scroll slider
  useEffect(() => {
    if (!isPlaying || slices.length === 0) return;
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      setCurrentScroll((prev) => {
        const next = prev + delta * settings.playSpeed;
        return next > 1.0 ? 0.0 : next;
      });

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, settings.playSpeed, slices.length]);

  // Reset Camera View & Anchor directly to Center [0, 0, 0]
  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.object.position.set(1.4, 0.75, 1.7);
      controlsRef.current.update();
    }
  };

  const hasVideo = slices.length > 0;
  const activeFrameIndex = hasVideo
    ? Math.min(volumeMeta.depth - 1, Math.max(0, Math.round(currentScroll * (volumeMeta.depth - 1))))
    : 0;

  return (
    <div className="relative w-full h-screen bg-[#06080d] text-slate-100 overflow-hidden select-none font-sans">
      {/* Hidden File Input for Quick Header Video Replacement */}
      <input
        ref={headerFileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleVideoUpload(e.target.files[0], targetFrameCount);
          }
        }}
      />

      {/* Floating HUD Toggle (shown when HUD is hidden) */}
      {!hudVisible && hasVideo && (
        <button
          onClick={() => setHudVisible(true)}
          className="absolute top-3 right-3 z-40 w-9 h-9 rounded-full neumorph-btn text-sky-400 flex items-center justify-center cursor-pointer"
          title="نمایش منوهای کنترل"
        >
          <Eye className="w-4 h-4" />
        </button>
      )}

      {/* 100% Mobile Responsive Neumorphic Header */}
      {hudVisible && hasVideo && (
        <header className="absolute top-2.5 left-2.5 right-2.5 z-30 pointer-events-none flex items-center justify-between gap-2">
          {/* Left: Compact Video Info Pill with Neumorphic Styling */}
          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 neumorph-panel rounded-full px-2.5 py-1.5 sm:px-3">
            <Film className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-slate-200 truncate max-w-[110px] xs:max-w-[160px] sm:max-w-xs">
              {volumeMeta.name}
            </span>
            <span className="neumorph-inset text-[10px] font-mono px-1.5 py-0.5 rounded-full text-sky-300 flex-shrink-0">
              {volumeMeta.depth} فریم
            </span>
          </div>

          {/* Right: Quick Action Buttons (Settings Dropdown Drawer, Upload Video, Hide HUD) */}
          <div className="pointer-events-auto flex items-center gap-1.5 neumorph-panel rounded-full p-1">
            {/* Slide-down Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                isSettingsOpen
                  ? 'neumorph-btn-pressed text-sky-400'
                  : 'neumorph-btn text-slate-300 hover:text-white'
              }`}
              title="تنظیمات و سفارشی‌سازی"
            >
              <Sliders className="w-4 h-4 text-sky-400" />
            </button>

            {/* Change Video Button */}
            <button
              onClick={() => headerFileInputRef.current?.click()}
              className="w-8 h-8 rounded-full neumorph-btn flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
              title="بارگذاری ویدیوی جدید"
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" />
            </button>

            {/* Hide HUD / Fullscreen View */}
            <button
              onClick={() => setHudVisible(false)}
              className="w-8 h-8 rounded-full neumorph-btn flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              title="مخفی کردن منوها"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>
      )}

      {/* Main 3D WebGL2 Canvas: Touch Gestures & Mouse Controls */}
      <div className="w-full h-full touch-none">
        <Canvas
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            alpha: false,
          }}
          camera={{
            position: [1.4, 0.75, 1.7],
            fov: 42,
            near: 0.1,
            far: 100,
          }}
          className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
        >
          <color attach="background" args={['#06080d']} />

          {/* Natural Touch & Mouse Navigation:
              - 1 Finger touch / Mouse left drag: Rotate camera
              - 2 Fingers touch drag: Pan camera
              - 2 Fingers pinch / Mouse wheel: Zoom in and Zoom out
          */}
          <OrbitControls
            ref={controlsRef}
            target={[0, 0, 0]}
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            autoRotate={settings.autoRotate}
            autoRotateSpeed={0.8}
            zoomSpeed={1.2}
            rotateSpeed={0.85}
            panSpeed={0.85}
            enableDamping={true}
            dampingFactor={0.08}
            minDistance={0.2}
            maxDistance={12}
            touches={{
              ONE: THREE.TOUCH.ROTATE,
              TWO: THREE.TOUCH.DOLLY_PAN,
            }}
            mouseButtons={{
              LEFT: THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.PAN,
            }}
          />

          {settings.showGrid && (
            <gridHelper
              args={[8, 16, '#1e293b', '#0f172a']}
              position={[0, -0.65, 0]}
            />
          )}

          {/* Render 2D slices stack (Borderless, customizable depth and past frame opacity) */}
          {hasVideo && (
            <SpacetimeVolume
              slices={slices}
              aspectRatio={volumeMeta.aspectRatio}
              currentScroll={currentScroll}
              depthScale={settings.depthScale}
              fadePast={settings.fadePast}
              pastOpacity={settings.pastOpacity}
              showLaboratoryFrame={settings.showLaboratoryFrame}
              onScrollChange={(val) => setCurrentScroll(val)}
            />
          )}
        </Canvas>
      </div>

      {/* Slide-down Customizable Settings Drawer */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
        onResetCamera={handleResetCamera}
        onTriggerUpload={() => headerFileInputRef.current?.click()}
        targetFrameCount={targetFrameCount}
        onTargetFrameCountChange={setTargetFrameCount}
        hasVideo={hasVideo}
      />

      {/* Center Screen: Upload Box (when idle) OR 3D Spinning/Exploding Logo + Progress bar (when baking) */}
      {!hasVideo && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 pointer-events-none">
          {isBaking ? (
            /* During Video Loading: Only the 3D spinning logo in center with its slim progress bar beneath */
            <div className="flex flex-col items-center justify-center pointer-events-auto">
              <div className="pointer-events-none">
                <ExplodingLogoLoader
                  isExploding={isExploding}
                  progressPercent={progress.progress}
                />
              </div>

              <div
                id="baking-progress-card"
                className="w-full max-w-xs neumorph-panel rounded-2xl p-3.5 shadow-2xl mt-1 select-none"
                dir="rtl"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <img
                      src="https://github.com/aishervin/Xrayng/blob/main/Picsart_26-08-07_19-36-12-944.png?raw=true"
                      alt="Shen Logo"
                      className="w-4 h-4 object-contain animate-spin-y"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-[11px] font-semibold text-slate-200">
                      در حال ساخت فضا‌زمان ویدیو...
                    </span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-sky-400">
                    {(progress.progress * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="w-full h-1.5 neumorph-rail rounded-full overflow-hidden mb-1.5">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-150 ease-out"
                    style={{ width: `${Math.max(4, progress.progress * 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>{progress.message}</span>
                  <span>
                    {progress.currentFrame} / {progress.totalFrames} فریم
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Idle: Normal Upload Box */
            <VideoUploader
              onVideoSelected={handleVideoUpload}
              isBaking={isBaking}
              progress={progress}
              frameCount={targetFrameCount}
              onFrameCountChange={setTargetFrameCount}
              hasVideo={hasVideo}
            />
          )}
        </div>
      )}

      {/* When video is reloaded from header while already having a video */}
      {hasVideo && isBaking && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-center justify-center">
            <ExplodingLogoLoader
              isExploding={isExploding}
              progressPercent={progress.progress}
            />
            <div
              id="re-baking-progress-card"
              className="w-full max-w-xs neumorph-panel rounded-2xl p-3.5 shadow-2xl mt-1 select-none"
              dir="rtl"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <img
                    src="https://github.com/aishervin/Xrayng/blob/main/Picsart_26-08-07_19-36-12-944.png?raw=true"
                    alt="Shen Logo"
                    className="w-4 h-4 object-contain animate-spin-y"
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-[11px] font-semibold text-slate-200">
                    در حال استخراج فریم‌های جدید...
                  </span>
                </div>
                <span className="text-xs font-mono font-semibold text-sky-400">
                  {(progress.progress * 100).toFixed(0)}%
                </span>
              </div>

              <div className="w-full h-1.5 neumorph-rail rounded-full overflow-hidden mb-1.5">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-150 ease-out"
                  style={{ width: `${Math.max(4, progress.progress * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>{progress.message}</span>
                <span>
                  {progress.currentFrame} / {progress.totalFrames} فریم
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10-second Intro Prism Overlay with Glitch Title and accelerated rotation */}
      {showIntro && (
        <IntroPrismOverlay
          durationSeconds={10}
          onFinish={() => setShowIntro(false)}
        />
      )}

      {/* Neumorphic Time Scrubber Capsule */}
      {hudVisible && hasVideo && !isBaking && (
        <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-md sm:max-w-lg pointer-events-auto">
          <MobileFriendlyScrubber
            value={currentScroll}
            onChange={(val) => {
              setIsPlaying(false);
              setCurrentScroll(val);
            }}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            currentIndex={activeFrameIndex}
            totalFrames={volumeMeta.depth}
          />
        </div>
      )}
    </div>
  );
}
