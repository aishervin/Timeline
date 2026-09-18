import React, { useRef } from 'react';
import * as THREE from 'three';

interface SlicesDeckProps {
  slices: {
    texture: THREE.CanvasTexture | THREE.Texture;
    aspectRatio: number;
    index: number;
    time: number;
  }[];
  aspectRatio: number;
  scroll: number; // 0.0 to 1.0
  fadePast?: boolean;
  pastOpacity?: number;
  spacing?: number;
  width?: number;
  height?: number;
}

// Slice item material with smooth appearance/fade
const sliceVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const sliceFragmentShader = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform float uAlpha;
uniform float uHighlight;
varying vec2 vUv;

void main() {
  vec4 tex = texture2D(uMap, vUv);
  vec3 col = tex.rgb;
  if (uHighlight > 0.0) {
    col = mix(col, vec3(1.0, 1.0, 1.0), uHighlight * 0.12);
  }
  gl_FragColor = vec4(col, tex.a * uAlpha);
}
`;

export const SlicesDeck: React.FC<SlicesDeckProps> = ({
  slices,
  aspectRatio,
  scroll,
  fadePast = true,
  pastOpacity = 0.45,
  spacing = 1.2,
  width: customWidth,
  height: customHeight,
}) => {
  const groupRef = useRef<THREE.Group>(null);

  // Exact card dimensions proportional to video
  const maxDim = 1.35;
  const width = customWidth ?? (aspectRatio >= 1.0 ? maxDim : maxDim * aspectRatio);
  const height = customHeight ?? (aspectRatio >= 1.0 ? maxDim / aspectRatio : maxDim);
  const total = slices.length;

  return (
    <group ref={groupRef} name="slices-deck">
      {slices.map((slice, i) => {
        // Position along Z axis: from -spacing/2 to +spacing/2
        const normZ = total > 1 ? i / (total - 1) : 0;
        const zPos = (normZ - 0.5) * spacing;

        // Current scroll mapped to index
        const currentIndex = scroll * (total - 1);
        const diff = i - currentIndex; // < 0 is past, = 0 is active, > 0 is future

        let alpha = 0.0;
        let highlight = 0.0;

        if (diff > 0.04) {
          // Future frame: not yet reached by timeline
          alpha = 0.0;
        } else if (Math.abs(diff) <= 0.65) {
          // Active frame (currently at cutting plane): 100% visible
          alpha = Math.min(1.0, 1.0 - Math.abs(diff) * 0.3);
          highlight = Math.max(0.0, 1.0 - Math.abs(diff) * 1.5);
        } else {
          // Past frame (scroll already passed)
          if (fadePast) {
            // Fades smoothly as scroll moves further away
            alpha = Math.max(0.04, Math.exp(-Math.abs(diff) * 0.3) * pastOpacity);
          } else {
            alpha = pastOpacity;
          }
        }

        if (alpha <= 0.005) {
          return null;
        }

        return (
          <group key={slice.index} position={[0, 0, zPos]}>
            {/* Borderless 2D Photo Slide Plane - NO wireframes/lines */}
            <mesh>
              <planeGeometry args={[width, height]} />
              <shaderMaterial
                vertexShader={sliceVertexShader}
                fragmentShader={sliceFragmentShader}
                uniforms={{
                  uMap: { value: slice.texture },
                  uAlpha: { value: alpha },
                  uHighlight: { value: highlight },
                }}
                transparent={true}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};
