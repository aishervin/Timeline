import * as THREE from 'three';
import { extend } from '@react-three/fiber';

/**
 * GLSL 3.00 es Volumetric Raymarching Shader
 * 
 * Spec:
 * - Uniforms: uTexture3D, uScroll, uPersistence, uThreshold, uDensity, uSteps, uSliceThickness
 * - The current Z-slice (time) is fully opaque.
 * - Past slices fade exponentially based on uPersistence.
 * - Pixels with intensity > uThreshold retain opacity to visualize the physical motion trail.
 * - Additive or custom blending, transparent, depthWrite false.
 */

const vertexShader = /* glsl */ `
out vec3 vLocalPos;
out vec3 vRayOrigin;
out vec3 vRayDir;

void main() {
  vLocalPos = position;
  mat4 invModel = inverse(modelMatrix);
  vRayOrigin = (invModel * vec4(cameraPosition, 1.0)).xyz;
  vRayDir = position - vRayOrigin;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;
precision highp sampler3D;

in vec3 vLocalPos;
in vec3 vRayOrigin;
in vec3 vRayDir;

uniform highp sampler3D uTexture3D;
uniform float uScroll;          // Time slice position (0.0 to 1.0)
uniform float uPersistence;     // Motion trail decay rate (0.0 to 1.0)
uniform float uThreshold;       // Saliency / noise threshold (0.0 to 1.0)
uniform float uDensity;         // Volumetric absorption / gain factor
uniform int uSteps;             // Number of raymarch steps
uniform float uSliceThickness;  // Thickness of active slice highlight
uniform int uRenderMode;        // 0: Full volume, 1: Slice scan, 2: Temporal projection
uniform float uAspectZ;         // Depth aspect scaling

out vec4 fragColor;

// Box intersection for unit cube [-0.5, 0.5]^3
vec2 hitBox(vec3 orig, vec3 dir) {
  vec3 boxMin = vec3(-0.5);
  vec3 boxMax = vec3(0.5);
  vec3 invDir = 1.0 / dir;
  vec3 t0 = (boxMin - orig) * invDir;
  vec3 t1 = (boxMax - orig) * invDir;
  vec3 tmin = min(t0, t1);
  vec3 tmax = max(t0, t1);
  float enter = max(max(tmin.x, tmin.y), tmin.z);
  float exit = min(min(tmax.x, tmax.y), tmax.z);
  return vec2(enter, exit);
}

// Sub-pixel jitter dither to suppress slicing banding artifacts
float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 rayDir = normalize(vRayDir);
  vec3 rayOrigin = vRayOrigin;

  vec2 hit = hitBox(rayOrigin, rayDir);
  if (hit.x > hit.y || hit.y < 0.0) {
    discard;
  }

  float tNear = max(hit.x, 0.0);
  float tFar = hit.y;
  float rayLength = tFar - tNear;

  int numSteps = clamp(uSteps, 32, 256);
  float stepSize = rayLength / float(numSteps);

  // Sub-pixel ray jittering
  float jitter = rand(gl_FragCoord.xy) * 0.7;
  float t = tNear + jitter * stepSize;

  vec4 accumColor = vec4(0.0);
  float sliceWidth = max(uSliceThickness, 0.012);

  for (int i = 0; i < 256; i++) {
    if (i >= numSteps || t > tFar) break;

    vec3 samplePos = rayOrigin + rayDir * t;
    // Normalized coordinates [0, 1] in volume space
    // X, Y = Spatial; Z = Temporal
    vec3 uvw = samplePos + 0.5;
    uvw.y = 1.0 - uvw.y; // Correct standard video Y orientation

    if (uvw.x >= 0.0 && uvw.x <= 1.0 && 
        uvw.y >= 0.0 && uvw.y <= 1.0 && 
        uvw.z >= 0.0 && uvw.z <= 1.0) {

      vec4 texColor = texture(uTexture3D, uvw);
      float luminance = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));

      // Temporal delta relative to current slice cursor uScroll
      float deltaZ = uScroll - uvw.z;
      float distToCurrent = abs(deltaZ);
      bool isCurrentSlice = distToCurrent < sliceWidth;

      float sliceOpacity = 0.0;

      if (isCurrentSlice) {
        // Current Z-slice (time) is fully opaque
        float core = 1.0 - smoothstep(0.0, sliceWidth, distToCurrent);
        sliceOpacity = max(sliceOpacity, core * 1.6);
      }

      if (deltaZ > 0.0) {
        // Past slices fade exponentially based on uPersistence
        // When uPersistence == 1.0 -> no decay (full spacetime trail)
        // When uPersistence == 0.0 -> aggressive decay (vanishes quickly)
        float decayFactor = (1.0 - uPersistence) * 18.0 + 0.05;
        float expDecay = exp(-deltaZ * decayFactor);

        // Pixels with intensity > uThreshold retain opacity to visualize the motion trail
        float saliency = smoothstep(uThreshold - 0.08, uThreshold + 0.08, luminance);
        
        // Retain motion trail opacity
        float trailRetain = mix(expDecay * 0.25, 1.0, saliency * uPersistence);
        sliceOpacity = max(sliceOpacity, trailRetain);
      } else if (deltaZ < -sliceWidth) {
        // Future slices: slightly dimmed preview based on uPersistence
        float futureDim = exp(-abs(deltaZ) * 12.0) * (uPersistence * 0.18);
        sliceOpacity = max(sliceOpacity, futureDim);
      }

      // Background noise gating
      if (luminance < uThreshold * 0.45 && !isCurrentSlice) {
        sliceOpacity *= 0.08;
      }

      float sampleAlpha = clamp(sliceOpacity * uDensity * stepSize * 2.8, 0.0, 1.0);

      // Color grading & edge sheen for the active time slice
      vec3 col = texColor.rgb;
      if (isCurrentSlice) {
        col = mix(col, vec3(1.0, 0.98, 0.95), 0.12);
      }

      // Front-to-back volumetric integration
      accumColor.rgb += col * sampleAlpha * (1.0 - accumColor.a);
      accumColor.a += sampleAlpha * (1.0 - accumColor.a);

      if (accumColor.a >= 0.985) {
        break; // Early ray exit
      }
    }

    t += stepSize;
  }

  if (accumColor.a <= 0.002) {
    discard;
  }

  fragColor = accumColor;
}
`;

// Create a dummy 3D texture to avoid shader compilation failure before video loads
export function createDefault3DTexture(width = 16, height = 16, depth = 16): THREE.Data3DTexture {
  const size = width * height * depth * 4;
  const data = new Uint8Array(size);
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (z * width * height + y * width + x) * 4;
        const u = x / width;
        const v = y / height;
        const w = z / depth;
        // Subtle test pattern
        const val = Math.floor((Math.sin(u * 10) * Math.cos(v * 10) * 0.5 + 0.5) * 255);
        data[idx] = val;
        data[idx + 1] = Math.floor(w * 255);
        data[idx + 2] = Math.floor((1 - w) * 255);
        data[idx + 3] = 255;
      }
    }
  }
  const tex = new THREE.Data3DTexture(data, width, height, depth);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.wrapR = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export class SpacetimeShaderMaterialImpl extends THREE.ShaderMaterial {
  constructor(parameters: any = {}) {
    const defaultUniforms = {
      uTexture3D: { value: createDefault3DTexture() },
      uScroll: { value: 1.0 },
      uPersistence: { value: 0.85 },
      uThreshold: { value: 0.22 },
      uDensity: { value: 2.2 },
      uSteps: { value: 128 },
      uSliceThickness: { value: 0.015 },
      uRenderMode: { value: 0 },
      uAspectZ: { value: 1.0 },
    };

    super({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      uniforms: THREE.UniformsUtils.clone(defaultUniforms),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      ...parameters,
    });
  }

  get uTexture3D() { return this.uniforms.uTexture3D.value; }
  set uTexture3D(v) { this.uniforms.uTexture3D.value = v; }

  get uScroll() { return this.uniforms.uScroll.value; }
  set uScroll(v) { this.uniforms.uScroll.value = v; }

  get uPersistence() { return this.uniforms.uPersistence.value; }
  set uPersistence(v) { this.uniforms.uPersistence.value = v; }

  get uThreshold() { return this.uniforms.uThreshold.value; }
  set uThreshold(v) { this.uniforms.uThreshold.value = v; }

  get uDensity() { return this.uniforms.uDensity.value; }
  set uDensity(v) { this.uniforms.uDensity.value = v; }

  get uSteps() { return this.uniforms.uSteps.value; }
  set uSteps(v) { this.uniforms.uSteps.value = v; }

  get uSliceThickness() { return this.uniforms.uSliceThickness.value; }
  set uSliceThickness(v) { this.uniforms.uSliceThickness.value = v; }

  get uRenderMode() { return this.uniforms.uRenderMode.value; }
  set uRenderMode(v) { this.uniforms.uRenderMode.value = v; }

  get uAspectZ() { return this.uniforms.uAspectZ.value; }
  set uAspectZ(v) { this.uniforms.uAspectZ.value = v; }
}

extend({ SpacetimeShaderMaterial: SpacetimeShaderMaterialImpl });

declare global {
  namespace JSX {
    interface IntrinsicElements {
      spacetimeShaderMaterial: any;
    }
  }
}
