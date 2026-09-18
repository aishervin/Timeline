import React, { useRef } from 'react';
import * as THREE from 'three';
import { SlicesDeck } from './SlicesDeck';
import { LaboratoryFrame } from './LaboratoryFrame';
import { VideoSlice2D } from '../services/deckExtractor';

interface SpacetimeVolumeProps {
  slices?: VideoSlice2D[];
  aspectRatio?: number;
  currentScroll: number;
  depthScale?: number;
  fadePast?: boolean;
  pastOpacity?: number;
  showLaboratoryFrame?: boolean;
  onScrollChange?: (val: number) => void;
  renderMode?: 'slices' | 'volume';
}

export const SpacetimeVolume: React.FC<SpacetimeVolumeProps> = ({
  slices = [],
  aspectRatio = 1.0,
  currentScroll = 1.0,
  depthScale = 1.2,
  fadePast = true,
  pastOpacity = 0.45,
  showLaboratoryFrame = false,
}) => {
  const meshRef = useRef<THREE.Group>(null);

  // Exact physical dimensions matching the video aspect ratio
  const maxDim = 1.35;
  const sx = aspectRatio >= 1.0 ? maxDim : maxDim * aspectRatio;
  const sy = aspectRatio >= 1.0 ? maxDim / aspectRatio : maxDim;
  const sz = depthScale;
  const boxSize: [number, number, number] = [sx, sy, sz];

  return (
    <group ref={meshRef} name="spacetime-volume-group">
      {/* 2D Photo Slides Deck (Border-free video slices) */}
      {slices.length > 0 && (
        <SlicesDeck
          slices={slices}
          aspectRatio={aspectRatio}
          scroll={currentScroll}
          fadePast={fadePast}
          pastOpacity={pastOpacity}
          spacing={sz}
          width={sx}
          height={sy}
        />
      )}

      {/* Optional Laboratory boundary frame (off by default for borderless look) */}
      {showLaboratoryFrame && (
        <LaboratoryFrame
          size={boxSize}
          color="#38bdf8"
          showTimePlane={false}
          getScrollValue={() => currentScroll}
        />
      )}
    </group>
  );
};
