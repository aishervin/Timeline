import React, { useRef, useState, useCallback } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';

interface MobileFriendlyScrubberProps {
  value: number; // 0.0 to 1.0
  onChange: (val: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentIndex: number;
  totalFrames: number;
  disabled?: boolean;
}

export const MobileFriendlyScrubber: React.FC<MobileFriendlyScrubberProps> = ({
  value,
  onChange,
  isPlaying,
  onTogglePlay,
  currentIndex,
  totalFrames,
  disabled = false,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculateRatioFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      return Math.max(0.0, Math.min(1.0, ratio));
    },
    [value]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const newRatio = calculateRatioFromClientX(e.clientX);
    onChange(newRatio);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const newRatio = calculateRatioFromClientX(e.clientX);
    onChange(newRatio);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // Safe catch
      }
    }
  };

  const percent = Math.max(0, Math.min(100, value * 100));

  // Step one frame backward or forward
  const stepFrame = (direction: -1 | 1) => {
    if (totalFrames <= 1) return;
    const nextIdx = Math.max(0, Math.min(totalFrames - 1, currentIndex + direction));
    onChange(nextIdx / (totalFrames - 1));
  };

  return (
    <div className="w-full flex flex-col items-end pointer-events-none select-none">
      {/* Top Corner Subtle Brand Signature */}
      <div className="flex items-center gap-1.5 px-3 mb-1 select-none pointer-events-none">
        <span className="animated-silver-gradient text-[10px] sm:text-[11px] font-mono tracking-wider font-semibold">
          Exclusive ☬SHΞN™ made
        </span>
      </div>

      {/* Neumorphic Scrubber Bar */}
      <div
        id="spacetime-mobile-scrubber"
        className="w-full neumorph-panel rounded-full px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center gap-1.5 sm:gap-2.5 touch-none select-none pointer-events-auto"
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* 1. Step Backward (-1 Frame, Arrow Pointing Left) */}
        <button
          type="button"
          onClick={() => stepFrame(-1)}
          disabled={disabled || currentIndex <= 0}
          className="neumorph-btn w-7 h-7 rounded-full text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-25 flex-shrink-0 cursor-pointer"
          title="یک فریم قبل (قبلی)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* 2. Play / Pause Button in Center */}
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={disabled}
          className="neumorph-btn-accent w-8 h-8 rounded-full text-white flex items-center justify-center flex-shrink-0 cursor-pointer"
          title={isPlaying ? 'توقف' : 'پخش زمان'}
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          )}
        </button>

        {/* 3. Step Forward (+1 Frame, Arrow Pointing Right) */}
        <button
          type="button"
          onClick={() => stepFrame(1)}
          disabled={disabled || currentIndex >= totalFrames - 1}
          className="neumorph-btn w-7 h-7 rounded-full text-slate-300 hover:text-white flex items-center justify-center disabled:opacity-25 flex-shrink-0 cursor-pointer"
          title="یک فریم بعد (بعدی)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* 4. Touch-Friendly Neumorphic Inset Scrubber Track */}
        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative flex-1 h-8 flex items-center cursor-pointer touch-none select-none px-1 ${
            disabled ? 'opacity-40 pointer-events-none' : ''
          }`}
        >
          {/* Inset Deep Rail */}
          <div className="relative w-full h-2 neumorph-rail rounded-full overflow-hidden">
            {/* Active progress fill */}
            <div
              className="h-full bg-gradient-to-r from-sky-600 via-sky-500 to-sky-400 rounded-full transition-[width] duration-75"
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* Tactile Neumorphic Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none"
            style={{ left: `${percent}%` }}
          >
            <div
              className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full neumorph-btn border border-sky-400/50 flex items-center justify-center transition-transform ${
                isDragging ? 'scale-125 ring-2 ring-sky-400/50' : ''
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_#38bdf8]" />
            </div>

            {/* 44px Touch Target for effortless dragging on mobile */}
            <div className="absolute -inset-3.5" />
          </div>
        </div>

        {/* 5. Compact Numeric Badge */}
        <div className="neumorph-inset flex items-center gap-1 font-mono text-[10px] sm:text-[11px] text-slate-300 rounded-full px-2 py-0.5 flex-shrink-0">
          <span className="text-sky-400 font-semibold">{currentIndex + 1}</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400">{totalFrames}</span>
        </div>
      </div>
    </div>
  );

};
