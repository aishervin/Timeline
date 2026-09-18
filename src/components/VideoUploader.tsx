import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { BakeProgress } from '../services/videoBaker';

const LOGO_SRC =
  'https://github.com/aishervin/Xrayng/blob/main/Picsart_26-08-07_19-36-12-944.png?raw=true';

interface VideoUploaderProps {
  onVideoSelected: (file: File, frameCount: number) => void;
  isBaking: boolean;
  progress: BakeProgress;
  frameCount: number;
  onFrameCountChange: (count: number) => void;
  hasVideo: boolean;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  onVideoSelected,
  isBaking,
  progress,
  frameCount,
  onFrameCountChange,
  hasVideo,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        onVideoSelected(file, frameCount);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onVideoSelected(e.target.files[0], frameCount);
    }
  };

  // If baking, show a compact floating progress card with neumorphic look & spinning logo icon
  if (isBaking) {
    return (
      <div
        id="baking-progress-card"
        className="w-full max-w-sm neumorph-panel rounded-2xl p-4 shadow-2xl animate-fade-in pointer-events-auto select-none"
        dir="rtl"
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2.5">
            {/* Spinning mini logo in 3D vertical Y-axis */}
            <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
              <img
                src={LOGO_SRC}
                alt="Shen Logo"
                className="w-5 h-5 object-contain animate-spin-y drop-shadow-[0_0_6px_rgba(56,189,248,0.7)]"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="text-xs font-semibold text-slate-200">
              در حال استخراج فریم‌های ویدیو...
            </span>
          </div>
          <span className="text-xs font-mono font-semibold text-sky-400">
            {(progress.progress * 100).toFixed(0)}%
          </span>
        </div>

        <div className="w-full h-2 neumorph-rail rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-150 ease-out"
            style={{ width: `${Math.max(4, progress.progress * 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>{progress.message}</span>
          <span>
            {progress.currentFrame} / {progress.totalFrames} فریم
          </span>
        </div>
      </div>
    );
  }

  // If video is already loaded and not baking, nothing to show in the center
  if (hasVideo) {
    return null;
  }

  // Initial clean upload dropzone card with neumorphic styling (redundant description removed)
  return (
    <div
      id="video-initial-uploader"
      className="w-full max-w-md neumorph-panel-lg rounded-3xl p-6 shadow-2xl flex flex-col gap-4 pointer-events-auto select-none"
      dir="rtl"
    >
      <div className="text-center space-y-1">
        <h2 className="text-base font-bold text-white tracking-wide">
          بارگذاری ویدیوی فضا‌زمان
        </h2>
      </div>

      {/* Drag and drop zone with neumorphic inset */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`neumorph-inset rounded-2xl p-6 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border border-sky-400 bg-sky-500/10 text-sky-200 scale-[1.02]'
            : 'hover:border-sky-500/40 text-slate-300'
        }`}
      >
        <div className="flex flex-col items-center gap-2.5">
          <div className="w-12 h-12 rounded-2xl neumorph-btn flex items-center justify-center text-sky-400">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              ویدیوی خود را انتخاب کنید یا بکشید اینجا
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              پشتیبانی از انواع ویدیوهای MP4, WebM, MOV
            </p>
          </div>
        </div>
      </div>

      {/* Frame count selector & submit button */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
        <div className="flex items-center gap-1.5 text-xs text-slate-300">
          <span className="text-slate-400">تعداد فریم:</span>
          <select
            value={frameCount}
            onChange={(e) => onFrameCountChange(Number(e.target.value))}
            className="neumorph-inset rounded-lg px-2 py-1 text-sky-400 font-mono text-xs focus:outline-none cursor-pointer"
          >
            <option value={24}>۲۴ فریم (فوق‌سبک)</option>
            <option value={36}>۳۶ فریم (متعادل)</option>
            <option value={48}>۴۸ فریم (پیش‌فرض نرم)</option>
            <option value={64}>۶۴ فریم (پیوسته)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="neumorph-btn-accent px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
        >
          انتخاب فایل ویدیو
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};
