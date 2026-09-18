import React from 'react';
import {
  X,
  RotateCcw,
  Upload,
  Layers,
  Sparkles,
  Grid,
  Compass,
  Gauge,
  Eye,
  Sliders,
} from 'lucide-react';

export interface AppSettings {
  depthScale: number; // 0.5 to 2.5
  fadePast: boolean;
  pastOpacity: number; // 0.1 to 0.9
  showLaboratoryFrame: boolean;
  showGrid: boolean;
  autoRotate: boolean;
  playSpeed: number;
}

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  onResetCamera: () => void;
  onTriggerUpload: () => void;
  targetFrameCount: number;
  onTargetFrameCountChange: (count: number) => void;
  hasVideo: boolean;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  onResetCamera,
  onTriggerUpload,
  targetFrameCount,
  onTargetFrameCountChange,
  hasVideo,
}) => {
  if (!isOpen) return null;

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-14 sm:pt-16 bg-black/40 backdrop-blur-sm animate-fade-in pointer-events-auto">
      {/* Click outside to close backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Neumorphic Slide-down Settings Panel */}
      <div
        className="relative w-full max-w-sm neumorph-panel-lg rounded-3xl p-4 sm:p-5 text-slate-200 z-10 max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-700/50 select-none animate-slide-down"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full neumorph-btn flex items-center justify-center text-sky-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                تنظیمات و سفارشی‌سازی
              </h3>
              <p className="text-[10px] text-slate-400">
                شخصی‌سازی زاویه، عمق و نحوه نمایش
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full neumorph-btn flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
            title="بستن"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* 1. Depth Spacing Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                فاصله و عمق بین فریم‌ها (محور Z)
              </span>
              <span className="font-mono text-[11px] text-sky-400">
                {settings.depthScale.toFixed(1)}x
              </span>
            </div>
            <div className="neumorph-rail p-1 rounded-full">
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.1"
                value={settings.depthScale}
                onChange={(e) => update('depthScale', parseFloat(e.target.value))}
                className="w-full h-2 accent-sky-400 bg-transparent cursor-pointer"
              />
            </div>
          </div>

          {/* 2. Past Frames Opacity */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-sky-400" />
                شفافیت فریم‌های گذشته
              </span>
              <span className="font-mono text-[11px] text-sky-400">
                {Math.round(settings.pastOpacity * 100)}%
              </span>
            </div>
            <div className="neumorph-rail p-1 rounded-full">
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={settings.pastOpacity}
                onChange={(e) => update('pastOpacity', parseFloat(e.target.value))}
                className="w-full h-2 accent-sky-400 bg-transparent cursor-pointer"
              />
            </div>
          </div>

          {/* 3. Toggles Grid */}
          <div className="neumorph-inset rounded-2xl p-2.5 space-y-2.5">
            {/* Fade Past Slices */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-300 text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                محو شدن تدریجی لایه‌های پیشین
              </span>
              <input
                type="checkbox"
                checked={settings.fadePast}
                onChange={(e) => update('fadePast', e.target.checked)}
                className="accent-sky-500 w-4 h-4 cursor-pointer"
              />
            </label>

            <div className="w-full h-[1px] bg-slate-800/60" />

            {/* Bounding Guide Box (Cube wireframe) */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-300 text-xs flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-sky-400" />
                قاب مکعب فضا‌زمان (Cube Wireframe)
              </span>
              <input
                type="checkbox"
                checked={settings.showLaboratoryFrame}
                onChange={(e) => update('showLaboratoryFrame', e.target.checked)}
                className="accent-sky-500 w-4 h-4 cursor-pointer"
              />
            </label>

            <div className="w-full h-[1px] bg-slate-800/60" />

            {/* Ground Grid */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-300 text-xs flex items-center gap-1.5">
                <Grid className="w-3.5 h-3.5 text-slate-400" />
                شبکه کف محیط سه‌بعدی
              </span>
              <input
                type="checkbox"
                checked={settings.showGrid}
                onChange={(e) => update('showGrid', e.target.checked)}
                className="accent-sky-500 w-4 h-4 cursor-pointer"
              />
            </label>

            <div className="w-full h-[1px] bg-slate-800/60" />

            {/* Auto-Rotate (Turntable) */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-300 text-xs flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                چرخش خودکار و پیوسته زاویه دید
              </span>
              <input
                type="checkbox"
                checked={settings.autoRotate}
                onChange={(e) => update('autoRotate', e.target.checked)}
                className="accent-sky-500 w-4 h-4 cursor-pointer"
              />
            </label>
          </div>

          {/* 4. Playback Speed Selector */}
          <div className="space-y-1.5">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-sky-400" />
              سرعت پیشروی زمان:
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {[0.15, 0.3, 0.6, 1.0].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => update('playSpeed', spd)}
                  className={`py-1 rounded-xl text-[11px] font-mono transition-all cursor-pointer ${
                    Math.abs(settings.playSpeed - spd) < 0.05
                      ? 'neumorph-btn-accent text-white font-bold'
                      : 'neumorph-btn text-slate-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* 5. Frame count for video baker */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-300 text-xs">تراکم فریم‌های ویدیو:</span>
            <div className="flex items-center gap-1">
              {[24, 36, 48, 64].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => onTargetFrameCountChange(cnt)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono cursor-pointer transition-colors ${
                    targetFrameCount === cnt
                      ? 'neumorph-btn-accent text-white font-bold'
                      : 'neumorph-btn text-slate-400 hover:text-white'
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Quick Action Buttons */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onResetCamera();
                onClose();
              }}
              className="flex-1 neumorph-btn py-2 px-3 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
              مرکزیت دوربین
            </button>

            {hasVideo && (
              <button
                type="button"
                onClick={() => {
                  onTriggerUpload();
                  onClose();
                }}
                className="flex-1 neumorph-btn py-2 px-3 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-all cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                ویدیوی جدید
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
