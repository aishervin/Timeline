import React, { useRef } from 'react';
import * as THREE from 'three';
import { Edges } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

interface LaboratoryFrameProps {
  size?: [number, number, number];
  color?: string;
  showTimePlane?: boolean;
  getScrollValue: () => number;
}

export const LaboratoryFrame: React.FC<LaboratoryFrameProps> = ({
  size = [1, 1, 1],
  color = '#88c0d0',
  showTimePlane = true,
  getScrollValue,
}) => {
  const timePlaneRef = useRef<THREE.Mesh>(null);
  const [sx, sy, sz] = size;

  useFrame(() => {
    if (timePlaneRef.current && showTimePlane) {
      const scroll = getScrollValue();
      // Map uScroll [0.0, 1.0] to local Z [-sz/2, sz/2]
      timePlaneRef.current.position.z = (scroll - 0.5) * sz;
    }
  });

  return (
    <group name="laboratory-frame">
      {/* Clean laboratory bounding box wireframe */}
      <mesh>
        <boxGeometry args={size} />
        <meshBasicMaterial visible={false} />
        <Edges
          scale={1.0005}
          threshold={15}
          color={color}
          lineWidth={1.2}
        />
      </mesh>

      {/* Interactive Time Slice Cutting Plane Indicator */}
      {showTimePlane && (
        <mesh ref={timePlaneRef} position={[0, 0, 0]}>
          <planeGeometry args={[sx * 1.01, sy * 1.01]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
          <Edges
            color="#38bdf8"
            threshold={1}
            lineWidth={1.5}
          />
        </mesh>
      )}
    </group>
  );
};
