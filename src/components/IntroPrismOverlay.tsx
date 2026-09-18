import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface IntroPrismOverlayProps {
  onFinish: () => void;
  durationSeconds?: number;
}

export const IntroPrismOverlay: React.FC<IntroPrismOverlayProps> = ({
  onFinish,
  durationSeconds = 10,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(durationSeconds);

  useEffect(() => {
    // 1-second countdown interval
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);

    // Trigger smooth fade out 1.2s before total finish
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, Math.max(1000, (durationSeconds - 1.2) * 1000));

    // Finish callback after exactly durationSeconds
    const finishTimer = setTimeout(() => {
      onFinish();
    }, durationSeconds * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [durationSeconds, onFinish]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    // Helpers
    function makeGlowTexture() {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      if (!g) return new THREE.CanvasTexture(c);
      const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.22, 'rgba(255,255,255,0.85)');
      r.addColorStop(0.55, 'rgba(255,255,255,0.18)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c);
      t.minFilter = THREE.LinearFilter;
      return t;
    }

    const REFLECTION_TEXT = '☬SHΞN™';

    function makeWordTexture(word: string) {
      const W = 2048,
        H = 400;
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      if (!g) return { texture: new THREE.CanvasTexture(c), aspect: H / W };
      g.fillStyle = '#ffffff';
      g.textBaseline = 'middle';
      const font = (px: number) =>
        `700 ${px}px 'Inter','SF Pro Display',-apple-system,'Segoe UI',Roboto,sans-serif`;
      const measure = (px: number, sp: number) => {
        g.font = font(px);
        let total = -sp;
        for (const ch of word) total += g.measureText(ch).width + sp;
        return total;
      };
      let px = 250,
        sp = 70;
      const total0 = measure(px, sp);
      const fit = Math.min(1, (W - 120) / total0);
      px *= fit;
      sp *= fit;
      let x = (W - measure(px, sp)) / 2;
      for (const ch of word) {
        g.fillText(ch, x, H / 2 + 10 * fit);
        x += g.measureText(ch).width + sp;
      }
      const t = new THREE.CanvasTexture(c);
      t.minFilter = THREE.LinearFilter;
      return { texture: t, aspect: H / W };
    }

    const glowTex = makeGlowTexture();
    const word = makeWordTexture(REFLECTION_TEXT);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x050609, 0);
    renderer.setPixelRatio(DPR);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    let camZ = 9.6;

    // Prism geometry
    const R = 1.85;
    const DEPTH = 2.1;
    const LOCAL_V = Array.from({ length: 3 }, (_, i) => {
      const a = Math.PI / 2 + i * ((Math.PI * 2) / 3);
      return { x: R * Math.cos(a), y: R * Math.sin(a) };
    });

    const shape = new THREE.Shape();
    shape.moveTo(LOCAL_V[0].x, LOCAL_V[0].y);
    shape.lineTo(LOCAL_V[1].x, LOCAL_V[1].y);
    shape.lineTo(LOCAL_V[2].x, LOCAL_V[2].y);
    shape.closePath();

    const prismGeo = new THREE.ExtrudeGeometry(shape, {
      depth: DEPTH,
      bevelEnabled: false,
    });
    prismGeo.translate(0, 0, -DEPTH / 2);

    const prism = new THREE.Group();
    scene.add(prism);

    const backMat = new THREE.MeshBasicMaterial({
      color: 0x0a0c18,
      transparent: true,
      opacity: 0.5,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const backMesh = new THREE.Mesh(prismGeo, backMat);
    backMesh.renderOrder = 4;
    prism.add(backMesh);

    const glassMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uTex: { value: word.texture },
        uTime: { value: 0 },
        uPlane: { value: new THREE.Vector4(0, 0.15, 8.6, 8.6 * word.aspect) },
        uPlaneZ: { value: -5 },
      },
      vertexShader: `
        varying vec3 vN;
        varying vec3 vW;
        void main() {
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: `
        uniform vec3 uCam;
        uniform sampler2D uTex;
        uniform float uTime;
        uniform vec4 uPlane;
        uniform float uPlaneZ;
        varying vec3 vN;
        varying vec3 vW;

        vec3 room(vec3 d) {
          float h = clamp(d.y * 0.6 + 0.5, 0.0, 1.0);
          return mix(vec3(0.010, 0.012, 0.020), vec3(0.075, 0.095, 0.150), h);
        }

        void main() {
          vec3 N = normalize(vN);
          vec3 V = normalize(vW - uCam);
          float ndv = abs(dot(N, -V));
          float fres = pow(1.0 - ndv, 2.6);
          vec3 col = vec3(0.016, 0.020, 0.034);

          vec3 Rr = refract(V, N, 1.0 / 1.45);
          col += room(Rr) * 0.55;
          if (Rr.z < -0.001) {
            float tt = (uPlaneZ - vW.z) / Rr.z;
            vec2 hit = vW.xy + Rr.xy * tt;
            vec2 uv = vec2(
              (hit.x - uPlane.x) / (2.0 * uPlane.z) + 0.5,
              (hit.y - uPlane.y) / (2.0 * uPlane.w) + 0.5
            );
            if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
              vec2 ca = Rr.xy * 0.05;
              float tr = texture2D(uTex, uv + ca).r;
              float tg = texture2D(uTex, uv).g;
              float tb = texture2D(uTex, uv - ca).b;
              col += vec3(tr, tg, tb) * 0.5;
            }
          }

          col += room(reflect(V, N)) * fres * 1.7;
          col += vec3(0.60, 0.66, 0.80) * pow(1.0 - ndv, 6.0) * 0.38;

          float sheen = 0.5 + 0.5 * sin(vW.x * 1.7 + vW.y * 2.3 + uTime * 0.6);
          col += vec3(0.020, 0.025, 0.035) * sheen;
          col += vec3(0.50, 0.56, 0.68) * fres * 0.35;

          gl_FragColor = vec4(col, 0.74 + fres * 0.20);
        }
      `,
    });
    const glassMesh = new THREE.Mesh(prismGeo, glassMat);
    glassMesh.renderOrder = 5;
    prism.add(glassMesh);

    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(prismGeo), edgeMat);
    edges.renderOrder = 8;
    prism.add(edges);

    // Background Grid
    const gridMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vP;
        void main(){
          vP = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vP;
        void main(){
          vec2 g = abs(fract(vP / 2.2) - 0.5);
          float lx = smoothstep(0.487, 0.5, g.x);
          float ly = smoothstep(0.487, 0.5, g.y);
          float line = max(lx, ly);
          float r = length(vP * vec2(1.0, 1.6));
          float vig = 1.0 - smoothstep(5.0, 20.0, r);
          float glow = exp(-r * r * 0.020) * 0.16;
          vec3 col = vec3(0.30, 0.36, 0.52) * line * 0.09 * vig
                   + vec3(0.10, 0.12, 0.20) * glow;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(60, 32), gridMat);
    grid.position.set(0, 0.2, -8);
    grid.renderOrder = 0;
    scene.add(grid);

    const backlight = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0x7f8fbf,
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      })
    );
    backlight.scale.setScalar(11);
    backlight.position.set(0.4, 0.3, -4);
    backlight.renderOrder = 2;
    scene.add(backlight);

    // Dust points
    const DUST_N = 160;
    const dustGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(DUST_N * 3);
    const seed = new Float32Array(DUST_N);
    for (let i = 0; i < DUST_N; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * 11;
      pos[i * 3 + 1] = (Math.random() * 2 - 1) * 6;
      pos[i * 3 + 2] = -6 + Math.random() * 8;
      seed[i] = Math.random();
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    const dustMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uDpr: { value: DPR },
      },
      vertexShader: `
        attribute float aSeed;
        uniform float uTime;
        uniform float uDpr;
        varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * 0.12 + aSeed * 7.0) * 0.6;
          p.y += cos(uTime * 0.10 + aSeed * 13.0) * 0.4;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (1.5 + aSeed * 2.5) * (14.0 / -mv.z) * uDpr;
          vA = 0.5 + 0.5 * sin(uTime * (0.4 + aSeed * 0.7) + aSeed * 20.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.1, d) * vA * 0.35;
          gl_FragColor = vec4(0.75, 0.80, 0.95, a);
        }
      `,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    dust.renderOrder = 2;
    scene.add(dust);

    // Beams & Optics
    const BEAM_VERT = `
      attribute vec3 aTangent;
      attribute float aSide;
      attribute float aT;
      uniform float uWidth;
      varying float vT;
      varying float vSide;
      void main(){
        vT = aT;
        vSide = aSide;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 tv = (modelViewMatrix * vec4(position + aTangent, 1.0)).xyz - mv.xyz;
        vec3 toCam = normalize(-mv.xyz);
        vec3 sideDir = cross(normalize(tv), toCam);
        float L = length(sideDir);
        sideDir = (L > 0.0001) ? sideDir / L : vec3(0.0, 1.0, 0.0);
        mv.xyz += sideDir * aSide * uWidth;
        gl_Position = projectionMatrix * mv;
      }
    `;
    const BEAM_FRAG = `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      uniform float uReveal;
      uniform float uTailFade;
      uniform float uSeed;
      varying float vT;
      varying float vSide;
      void main(){
        float s = vSide;
        float core = exp(-s * s * 20.0);
        float halo = exp(-s * s * 4.5) * 0.5;
        float prof = core + halo;
        float tail = mix(1.0, 0.16 + 0.84 * pow(1.0 - vT, 1.5), uTailFade);
        float rev = clamp((uReveal - vT) / 0.12, 0.0, 1.0);
        float shimmer = 0.9 + 0.1 * sin(vT * 30.0 - uTime * 4.5 + uSeed * 17.0);
        float a = prof * tail * rev * shimmer * uOpacity;
        gl_FragColor = vec4(uColor * (0.72 + 0.85 * core), a);
      }
    `;

    function makeBeam(
      n: number,
      hex: number,
      { width = 0.05, opacity = 1, tailFade = 0, order = 6 } = {}
    ) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(n * 2 * 3);
      const tan = new Float32Array(n * 2 * 3);
      const side = new Float32Array(n * 2);
      const tArr = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        side[2 * i] = 1;
        side[2 * i + 1] = -1;
        tArr[2 * i] = tArr[2 * i + 1] = i / (n - 1);
      }
      const idx = new Uint16Array((n - 1) * 6);
      for (let i = 0; i < n - 1; i++) {
        const o = i * 6,
          v = i * 2;
        idx[o] = v;
        idx[o + 1] = v + 1;
        idx[o + 2] = v + 2;
        idx[o + 3] = v + 1;
        idx[o + 4] = v + 3;
        idx[o + 5] = v + 2;
      }
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
      const tanAttr = new THREE.BufferAttribute(tan, 3).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('position', posAttr);
      geo.setAttribute('aTangent', tanAttr);
      geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
      geo.setAttribute('aT', new THREE.BufferAttribute(tArr, 1));

      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uColor: { value: new THREE.Color(hex) },
          uWidth: { value: width },
          uOpacity: { value: opacity },
          uTime: { value: 0 },
          uReveal: { value: 0 },
          uTailFade: { value: tailFade },
          uSeed: { value: Math.random() * 10 },
        },
        vertexShader: BEAM_VERT,
        fragmentShader: BEAM_FRAG,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      scene.add(mesh);

      const update = (pts: THREE.Vector3[]) => {
        for (let k = 0; k < n; k++) {
          const p = pts[k];
          const a = pts[k > 0 ? k - 1 : 0];
          const b = pts[k < n - 1 ? k + 1 : n - 1];
          let tx = b.x - a.x,
            ty = b.y - a.y,
            tz = b.z - a.z;
          const L = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
          tx /= L;
          ty /= L;
          tz /= L;
          const o = k * 6;
          pos[o] = p.x;
          pos[o + 1] = p.y;
          pos[o + 2] = p.z;
          pos[o + 3] = p.x;
          pos[o + 4] = p.y;
          pos[o + 5] = p.z;
          tan[o] = tx;
          tan[o + 1] = ty;
          tan[o + 2] = tz;
          tan[o + 3] = tx;
          tan[o + 4] = ty;
          tan[o + 5] = tz;
        }
        posAttr.needsUpdate = true;
        tanAttr.needsUpdate = true;
      };
      return { mat, update };
    }

    const vecArray = (n: number) => Array.from({ length: n }, () => new THREE.Vector3());

    const INC_N = 56,
      REF_N = 16,
      RES_N = 24;
    const INC_PTS = vecArray(INC_N);
    const REF_PTS = vecArray(REF_N);
    const RES_PTS = vecArray(RES_N);

    const incoming = makeBeam(INC_N, 0xffffff, { width: 0.06, opacity: 0.95 });
    const reflectBeam = makeBeam(REF_N, 0xffffff, { width: 0.04, opacity: 0.09, tailFade: 1 });
    const residualBeam = makeBeam(RES_N, 0xffffff, { width: 0.045, opacity: 0.1, tailFade: 1 });
    const allBeams = [incoming, reflectBeam, residualBeam];

    // Spectrum sheets
    const SHEET_VERT = `
      attribute float aW;
      attribute float aT;
      attribute float aAlpha;
      attribute float aRev;
      attribute vec3  aColor;
      varying float vW;
      varying float vT;
      varying float vA;
      varying float vRev;
      varying vec3 vCol;
      void main(){
        vW = aW; vT = aT; vA = aAlpha; vRev = aRev; vCol = aColor;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const SHEET_FRAG = `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uHeadWhite;
      uniform float uHeadK;
      uniform float uAlongBase;
      uniform float uAlongK;
      varying float vW;
      varying float vT;
      varying float vA;
      varying float vRev;
      varying vec3 vCol;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        float edge  = smoothstep(0.0, 0.05, vW) * smoothstep(1.0, 0.95, vW);
        float along = uAlongBase + (1.0 - uAlongBase) * exp(-vT * uAlongK);
        along *= 1.0 - smoothstep(0.90, 1.0, vT);
        float rev = clamp((vRev - vT) / 0.10, 0.0, 1.0);
        float grain = 0.88 + 0.24 * hash(vec2(vT * 211.0 + vW * 97.0, floor(uTime * 24.0)));
        vec3 col = mix(vCol, vec3(1.0), uHeadWhite * exp(-vT * uHeadK));
        gl_FragColor = vec4(col, edge * along * rev * vA * grain * uOpacity);
      }
    `;

    function makeSheet(
      cols: number,
      rows: number,
      { opacity, headWhite, headK, alongBase, alongK, order = 6 }: any
    ) {
      const count = cols * rows;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const aW = new Float32Array(count);
      const aT = new Float32Array(count);
      const aA = new Float32Array(count);
      const aRev = new Float32Array(count);
      const aCol = new Float32Array(count * 3);

      function specColor(w: number) {
        const l = 410 + (650 - 410) * w;
        let r, g, b;
        if (l < 440) {
          r = -(l - 440) / 60;
          g = 0;
          b = 1;
        } else if (l < 490) {
          r = 0;
          g = (l - 440) / 50;
          b = 1;
        } else if (l < 510) {
          r = 0;
          g = 1;
          b = -(l - 510) / 20;
        } else if (l < 580) {
          r = (l - 510) / 70;
          g = 1;
          b = 0;
        } else if (l < 645) {
          r = 1;
          g = -(l - 645) / 65;
          b = 0;
        } else {
          r = 1;
          g = 0;
          b = 0;
        }
        const f = l < 420 ? 0.45 + (0.55 * (l - 395)) / 25 : l > 645 ? 0.5 + (0.5 * (700 - l)) / 55 : 1;
        return [r * f, g * f, b * f];
      }

      for (let k = 0; k < rows; k++) {
        for (let c = 0; c < cols; c++) {
          const i = k * cols + c,
            w = c / (cols - 1);
          aW[i] = w;
          aT[i] = k / (rows - 1);
          const rgb = specColor(w);
          aCol[i * 3] = rgb[0];
          aCol[i * 3 + 1] = rgb[1];
          aCol[i * 3 + 2] = rgb[2];
        }
      }
      const idx = new Uint16Array((cols - 1) * (rows - 1) * 6);
      let o = 0;
      for (let k = 0; k < rows - 1; k++) {
        for (let c = 0; c < cols - 1; c++) {
          const v = k * cols + c;
          idx[o++] = v;
          idx[o++] = v + 1;
          idx[o++] = v + cols;
          idx[o++] = v + 1;
          idx[o++] = v + cols + 1;
          idx[o++] = v + cols;
        }
      }
      geo.setIndex(new THREE.BufferAttribute(idx, 1));

      const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
      const aAttr = new THREE.BufferAttribute(aA, 1).setUsage(THREE.DynamicDrawUsage);
      const revAttr = new THREE.BufferAttribute(aRev, 1).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('position', posAttr);
      geo.setAttribute('aAlpha', aAttr);
      geo.setAttribute('aRev', revAttr);
      geo.setAttribute('aW', new THREE.BufferAttribute(aW, 1));
      geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
      geo.setAttribute('aColor', new THREE.BufferAttribute(aCol, 3));

      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: opacity },
          uHeadWhite: { value: headWhite },
          uHeadK: { value: headK },
          uAlongBase: { value: alongBase },
          uAlongK: { value: alongK },
        },
        vertexShader: SHEET_VERT,
        fragmentShader: SHEET_FRAG,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      scene.add(mesh);

      const setPoint = (k: number, c: number, x: number, y: number, z: number) => {
        const i = (k * cols + c) * 3;
        pos[i] = x;
        pos[i + 1] = y;
        pos[i + 2] = z;
      };
      const setColumnScalar = (arr: Float32Array, c: number, v: number) => {
        for (let k = 0; k < rows; k++) arr[k * cols + c] = v;
      };
      return {
        mat,
        cols,
        rows,
        pos,
        setPoint,
        setAlpha: (c: number, v: number) => setColumnScalar(aA, c, v),
        setRev: (c: number, v: number) => setColumnScalar(aRev, c, v),
        commit() {
          posAttr.needsUpdate = aAttr.needsUpdate = revAttr.needsUpdate = true;
        },
      };
    }

    function sampleSheet(sheet: any, c: number, u: number, out: THREE.Vector3) {
      const f = Math.max(0, Math.min(1, u)) * (sheet.rows - 1);
      const k = Math.min(sheet.rows - 2, Math.floor(f));
      const m = f - k;
      const i0 = (k * sheet.cols + c) * 3;
      const i1 = ((k + 1) * sheet.cols + c) * 3;
      const p = sheet.pos;
      out.set(
        p[i0] + (p[i1] - p[i0]) * m,
        p[i0 + 1] + (p[i1 + 1] - p[i0 + 1]) * m,
        p[i0 + 2] + (p[i1 + 2] - p[i0 + 2]) * m
      );
    }

    const NC = 24,
      NK = 40,
      NKI = 8;
    const exitSheet = makeSheet(NC, NK, {
      opacity: 0.92,
      headWhite: 0.55,
      headK: 5.5,
      alongBase: 0.34,
      alongK: 1.5,
    });
    const innerSheet = makeSheet(NC, NKI, {
      opacity: 0.3,
      headWhite: 0.65,
      headK: 4,
      alongBase: 0.55,
      alongK: 0.9,
    });

    // Ray tracing
    const TRI = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
    const TRI_C = { x: 0, y: 0 };

    function updateTri(rotZ: number, bob: number) {
      const c = Math.cos(rotZ),
        s = Math.sin(rotZ);
      for (let i = 0; i < 3; i++) {
        const v = LOCAL_V[i];
        TRI[i].x = v.x * c - v.y * s;
        TRI[i].y = v.x * s + v.y * c + bob;
      }
      TRI_C.x = (TRI[0].x + TRI[1].x + TRI[2].x) / 3;
      TRI_C.y = (TRI[0].y + TRI[1].y + TRI[2].y) / 3;
    }

    const cross2 = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;

    function castRay(px: number, py: number, dx: number, dy: number, skip: number, out: any) {
      let best = Infinity,
        be = -1,
        bx = 0,
        by = 0,
        bnx = 0,
        bny = 0;
      for (let i = 0; i < 3; i++) {
        if (i === skip) continue;
        const a = TRI[i],
          b = TRI[(i + 1) % 3];
        const ex = b.x - a.x,
          ey = b.y - a.y;
        const den = cross2(dx, dy, ex, ey);
        if (Math.abs(den) < 1e-9) continue;
        const wx = a.x - px,
          wy = a.y - py;
        const t = cross2(wx, wy, ex, ey) / den;
        const s = cross2(wx, wy, dx, dy) / den;
        if (t > 1e-4 && s >= -1e-4 && s <= 1.0001 && t < best) {
          best = t;
          be = i;
          bx = px + dx * t;
          by = py + dy * t;
          let nx = ey,
            ny = -ex;
          const L = Math.sqrt(nx * nx + ny * ny) || 1;
          nx /= L;
          ny /= L;
          const mx = (a.x + b.x) / 2,
            my = (a.y + b.y) / 2;
          if (nx * (mx - TRI_C.x) + ny * (my - TRI_C.y) < 0) {
            nx = -nx;
            ny = -ny;
          }
          bnx = nx;
          bny = ny;
        }
      }
      if (be < 0) return false;
      out.t = best;
      out.x = bx;
      out.y = by;
      out.nx = bnx;
      out.ny = bny;
      out.edge = be;
      return true;
    }

    function refract2(ix: number, iy: number, nx: number, ny: number, eta: number, out: any) {
      let d = ix * nx + iy * ny;
      if (d > 0) {
        nx = -nx;
        ny = -ny;
        d = -d;
      }
      const cosi = -d;
      const k = 1 - eta * eta * (1 - cosi * cosi);
      if (k < 0) return false;
      const f = eta * cosi - Math.sqrt(k);
      out.x = eta * ix + f * nx;
      out.y = eta * iy + f * ny;
      return true;
    }

    function reflect2(ix: number, iy: number, nx: number, ny: number, out: any) {
      const d = ix * nx + iy * ny;
      out.x = ix - 2 * d * nx;
      out.y = iy - 2 * d * ny;
    }

    const MAX_TRACE_PTS = 5;
    const makeTraceRec = () => ({
      pts: Array.from({ length: MAX_TRACE_PTS }, () => ({ x: 0, y: 0 })),
      count: 0,
      ex: 0,
      ey: 0,
      dx: 0,
      dy: 0,
      len: 0,
      valid: false,
    });
    const TRACES = Array.from({ length: NC }, makeTraceRec);
    const CTRACE = makeTraceRec();
    const ENTRY = { valid: false, x: 0, y: 0, nx: 0, ny: 0, edge: -1 };
    const HIT_E = { t: 0, x: 0, y: 0, nx: 0, ny: 0, edge: -1 };
    const HIT_I = { t: 0, x: 0, y: 0, nx: 0, ny: 0, edge: -1 };
    const TDIR = { x: 0, y: 0 };
    const SEGL = new Float64Array(MAX_TRACE_PTS);

    function trace(n: number, rec: any) {
      rec.count = 0;
      rec.valid = false;
      if (!ENTRY.valid) return;
      if (!refract2(RAY.dx, RAY.dy, ENTRY.nx, ENTRY.ny, 1 / n, TDIR)) return;
      rec.pts[0].x = ENTRY.x;
      rec.pts[0].y = ENTRY.y;
      rec.count = 1;
      let cx = ENTRY.x,
        cy = ENTRY.y,
        dx = TDIR.x,
        dy = TDIR.y,
        skip = ENTRY.edge;
      let len = 0;
      for (let b = 0; b < 3; b++) {
        if (!castRay(cx, cy, dx, dy, skip, HIT_I)) return;
        len += HIT_I.t;
        rec.pts[rec.count].x = HIT_I.x;
        rec.pts[rec.count].y = HIT_I.y;
        rec.count++;
        if (refract2(dx, dy, HIT_I.nx, HIT_I.ny, n, TDIR)) {
          rec.ex = HIT_I.x;
          rec.ey = HIT_I.y;
          rec.dx = TDIR.x;
          rec.dy = TDIR.y;
          rec.len = len;
          rec.valid = true;
          return;
        }
        reflect2(dx, dy, HIT_I.nx, HIT_I.ny, TDIR);
        dx = TDIR.x;
        dy = TDIR.y;
        cx = HIT_I.x;
        cy = HIT_I.y;
        skip = HIT_I.edge;
      }
    }

    function writeInnerColumn(rec: any, c: number, zOff: number) {
      const rows = innerSheet.rows,
        cnt = rec.count;
      if (cnt < 2) return;
      let total = 0;
      for (let i = 1; i < cnt; i++) {
        const dx = rec.pts[i].x - rec.pts[i - 1].x;
        const dy = rec.pts[i].y - rec.pts[i - 1].y;
        SEGL[i] = Math.sqrt(dx * dx + dy * dy);
        total += SEGL[i];
      }
      if (total < 1e-6) return;
      let seg = 1,
        acc = 0;
      for (let k = 0; k < rows; k++) {
        const target = (total * k) / (rows - 1);
        while (seg < cnt - 1 && acc + SEGL[seg] < target) {
          acc += SEGL[seg];
          seg++;
        }
        const u = SEGL[seg] > 1e-9 ? (target - acc) / SEGL[seg] : 0;
        const a = rec.pts[seg - 1],
          b = rec.pts[seg];
        innerSheet.setPoint(k, c, a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, zOff);
      }
    }

    function writeExitColumn(c: number, w: number, ex: number, ey: number, ang0: number, tA: number, zOff: number) {
      const rows = exitSheet.rows,
        step = 13.5 / (rows - 1);
      const angT = ang0 * (1 - 0.55 * Math.max(0, Math.min(1, Math.cos(ang0))));
      let x = ex,
        y = ey;
      for (let k = 0; k < rows; k++) {
        const u = k / (rows - 1);
        const e = u * u * (3 - 2 * u) * 0.9;
        const ang = ang0 + (angT - ang0) * e;
        if (k > 0) {
          x += Math.cos(ang) * step;
          y += Math.sin(ang) * step;
        }
        const sway = Math.sin(tA * 0.8 + w * 5.4 + u * 2.4) * 0.14 * u;
        exitSheet.setPoint(k, c, x - Math.sin(ang) * sway, y + Math.cos(ang) * sway, zOff);
      }
    }

    function buildIncoming(tA: number, hasEntry: boolean) {
      const x0 = -9 - 0.5;
      const y0 = RAY.py + (x0 - RAY.px) * SLOPE;
      let x1: number, y1: number;
      if (hasEntry) {
        x1 = ENTRY.x;
        y1 = ENTRY.y;
      } else {
        x1 = 9 + 1;
        y1 = RAY.py + (x1 - RAY.px) * SLOPE;
      }
      for (let k = 0; k < INC_N; k++) {
        const u = k / (INC_N - 1);
        const x = x0 + (x1 - x0) * u;
        let y = y0 + (y1 - y0) * u;
        const envL = ((uVal) => {
          const t2 = uVal;
          return t2 * t2 * (3 - 2 * t2);
        })(Math.max(0, Math.min(1, (u - 0.02) / 0.16)));
        const envR = hasEntry
          ? 1.0
          : ((uVal) => {
              const t2 = 1 - uVal;
              return (
                Math.max(0, Math.min(1, (t2 - 0.02) / 0.16)) *
                Math.max(0, Math.min(1, (t2 - 0.02) / 0.16)) *
                (3 - 2 * Math.max(0, Math.min(1, (t2 - 0.02) / 0.16)))
              );
            })(u);
        y += Math.sin((x - 4 * tA) * 0.65) * 0.05 * envL * envR;
        INC_PTS[k].set(x, y, 0);
      }
      if (hasEntry) INC_PTS[INC_N - 1].set(ENTRY.x, ENTRY.y, 0);
    }

    function buildReflect() {
      reflect2(RAY.dx, RAY.dy, ENTRY.nx, ENTRY.ny, TDIR);
      const L = 6;
      for (let k = 0; k < REF_N; k++) {
        const u = k / (REF_N - 1);
        REF_PTS[k].set(ENTRY.x + TDIR.x * L * u, ENTRY.y + TDIR.y * L * u, 0);
      }
    }

    function buildResidual() {
      const L = 12;
      for (let k = 0; k < RES_N; k++) {
        const u = k / (RES_N - 1);
        RES_PTS[k].set(ENTRY.x + RAY.dx * L * u, ENTRY.y + RAY.dy * L * u, 0.01);
      }
    }

    function makeSprite(hex: number, scale: number, opacity: number, order: number) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: hex,
          transparent: true,
          opacity,
          blending: THREE.AdditiveBlending,
          depthTest: false,
          depthWrite: false,
        })
      );
      s.scale.setScalar(scale);
      s.renderOrder = order;
      scene.add(s);
      return s;
    }

    function samplePts(pts: THREE.Vector3[], u: number, out: THREE.Vector3) {
      const f = Math.max(0, Math.min(1, u)) * (pts.length - 1);
      const i = Math.min(pts.length - 2, Math.floor(f));
      out.copy(pts[i]).lerp(pts[i + 1], f - i);
    }

    const RAY = { px: 0, py: 0.12, dx: Math.cos(0.12), dy: Math.sin(0.12) };
    const SLOPE = RAY.dy / RAY.dx;
    // Increased speed so the prism spins gracefully within 10 seconds
    const PRISM_SPEED = 2.4;
    const CV = 4 / PRISM_SPEED;
    const T0 = 0.25;
    const EXIT_LEN = 13.5;
    const viewX = { left: -9, right: 9 };

    const apexDot = makeSprite(0xffffff, 0.12, 0.9, 9);
    const sourceDot = makeSprite(0xffffff, 0.17, 0.95, 9);
    const entryGlow = makeSprite(0xddddff, 0.3, 0, 9);
    const exitGlow = makeSprite(0xffffff, 0.5, 0, 9);
    const cornerDots = [1, 2].map(() => makeSprite(0xffffff, 0.085, 0, 9));

    const NP = 5,
      T_EMIT = 2.2,
      CYCLE = NP * T_EMIT;
    const whitePulses = Array.from({ length: NP }, () => makeSprite(0xffffff, 0.085, 0, 9));

    function pulseHex(w: number) {
      const l = 410 + (650 - 410) * w;
      let r, g, b;
      if (l < 440) {
        r = -(l - 440) / 60;
        g = 0;
        b = 1;
      } else if (l < 490) {
        r = 0;
        g = (l - 440) / 50;
        b = 1;
      } else if (l < 510) {
        r = 0;
        g = 1;
        b = -(l - 510) / 20;
      } else if (l < 580) {
        r = (l - 510) / 70;
        g = 1;
        b = 0;
      } else if (l < 645) {
        r = 1;
        g = -(l - 645) / 65;
        b = 0;
      } else {
        r = 1;
        g = 0;
        b = 0;
      }
      const f = l < 420 ? 0.45 + (0.55 * (l - 395)) / 25 : l > 645 ? 0.5 + (0.5 * (700 - l)) / 55 : 1;
      const col = new THREE.Color(r * f, g * f, b * f);
      return col.getHex();
    }

    const PULSE_W = [0, 0.2, 0.4, 0.6, 0.8, 1];
    const colorPulses = PULSE_W.map((w) => {
      const hex = pulseHex(w);
      return Array.from({ length: NP }, () => makeSprite(hex, 0.075, 0, 9));
    });
    const PULSE_COL = PULSE_W.map((w) => Math.round(w * (NC - 1)));
    const washes = PULSE_W.map((w) => makeSprite(pulseHex(w), 5.5, 0, 2));
    const SAMP = new THREE.Vector3();

    let entryAlpha = 0,
      trapGlow = 0,
      lastAC = -0.06;
    const colAlpha = new Float32Array(NC);
    const T_OUT = new Float32Array(NC);

    function castEntry() {
      const sx = viewX.left - 2;
      const sy = RAY.py + (sx - RAY.px) * SLOPE;
      const hit =
        castRay(sx, sy, RAY.dx, RAY.dy, -1, HIT_E) && HIT_E.nx * RAY.dx + HIT_E.ny * RAY.dy < -0.001;
      ENTRY.valid = hit;
      if (hit) {
        ENTRY.x = HIT_E.x;
        ENTRY.y = HIT_E.y;
        ENTRY.nx = HIT_E.nx;
        ENTRY.ny = HIT_E.ny;
        ENTRY.edge = HIT_E.edge;
      }
      return hit;
    }

    function centerAngle() {
      let aC;
      if (CTRACE.valid) {
        aC = Math.atan2(CTRACE.dy, CTRACE.dx);
      } else {
        let sum = 0,
          cnt = 0;
        for (const rec of TRACES) {
          if (rec.valid) {
            sum += Math.atan2(rec.dy, rec.dx);
            cnt++;
          }
        }
        aC = cnt > 0 ? sum / cnt : lastAC;
      }
      lastAC = aC;
      return aC;
    }

    function updatePulses(tP: number, dIn: number, airT: number, lamp: number, hasEntry: boolean) {
      for (let s = 0; s < NP; s++) {
        const emit = s * T_EMIT;
        const live = tP >= emit;
        const age = live ? (tP - emit) % CYCLE : 0;
        const dAir = age * CV;
        const wSpr = whitePulses[s];
        if (live && dAir < dIn) {
          samplePts(INC_PTS, dAir / dIn, SAMP);
          wSpr.position.copy(SAMP);
          wSpr.material.opacity = 0.85 * lamp;
        } else wSpr.material.opacity = 0;
        for (let i = 0; i < 6; i++) {
          const spr = colorPulses[i][s];
          const c = PULSE_COL[i];
          if (!live || !hasEntry || colAlpha[c] < 0.05 || TRACES[c].len < 1e-6 || age <= airT) {
            spr.material.opacity = 0;
            continue;
          }
          const tOut = T_OUT[c];
          if (age < tOut) {
            const u = ((age - airT) * (CV / 1)) / TRACES[c].len;
            sampleSheet(innerSheet, c, u, SAMP);
            spr.position.copy(SAMP);
            spr.material.opacity = 0.9 * colAlpha[c];
          } else if (age < tOut + EXIT_LEN / CV) {
            sampleSheet(exitSheet, c, ((age - tOut) * CV) / EXIT_LEN, SAMP);
            spr.position.copy(SAMP);
            spr.material.opacity = 0.85 * colAlpha[c];
          } else spr.material.opacity = 0;
        }
      }
    }

    function updateOptics(tA: number, dt: number, rotZ: number, bob: number) {
      updateTri(rotZ, bob);
      const hasEntry = castEntry();
      const ease = 1 - Math.exp(-6 * dt);
      entryAlpha += ((hasEntry ? 1 : 0) - entryAlpha) * ease;

      const tP = Math.max(0, tA - T0);
      const lamp = Math.max(0, Math.min(1, tP / 0.3));
      buildIncoming(tA, hasEntry);
      incoming.update(INC_PTS);

      const x0 = viewX.left - 0.5;
      const dIn = hasEntry
        ? Math.hypot(ENTRY.x - x0, ENTRY.y - (RAY.py + (x0 - RAY.px) * SLOPE))
        : (viewX.right + 1 - x0) / RAY.dx;
      const airT = dIn / CV;
      const sinceEntry = Math.max(0, tP - airT);
      incoming.mat.uniforms.uReveal.value = Math.max(0, Math.min(1, (CV * tP) / dIn));

      if (hasEntry) {
        buildReflect();
        reflectBeam.update(REF_PTS);
        buildResidual();
        residualBeam.update(RES_PTS);
      }
      const pastEntry = sinceEntry * CV;
      reflectBeam.mat.uniforms.uOpacity.value = 0.09 * entryAlpha;
      residualBeam.mat.uniforms.uOpacity.value = 0.1 * entryAlpha;
      reflectBeam.mat.uniforms.uReveal.value = Math.max(0, Math.min(1, pastEntry / 6));
      residualBeam.mat.uniforms.uReveal.value = Math.max(0, Math.min(1, pastEntry / 12));

      trace(1.17, CTRACE);
      for (let c = 0; c < NC; c++) trace(1.17 + (c / (NC - 1)) * 0.113, TRACES[c]);

      const aC = centerAngle();
      let gx = 0,
        gy = 0,
        ga = 0,
        alive = 0,
        tFirstOut = Infinity;
      for (let c = 0; c < NC; c++) {
        const rec = TRACES[c];
        const w = c / (NC - 1);
        colAlpha[c] += ((hasEntry && rec.valid ? 1 : 0) - colAlpha[c]) * ease;
        const zOff = (w - 0.5) * 0.3;
        if (rec.valid) {
          alive++;
          const ai = Math.atan2(rec.dy, rec.dx);
          writeExitColumn(c, w, rec.ex, rec.ey, aC + (((ai - aC) % (2 * Math.PI)) * 3), tA, zOff);
          writeInnerColumn(rec, c, zOff);
          T_OUT[c] = airT + (rec.len * (1.17 + (c / (NC - 1)) * 0.113)) / CV;
        }
        const glassRev =
          rec.len > 1e-6
            ? Math.max(0, Math.min(1, (sinceEntry * (CV / (1.17 + (c / (NC - 1)) * 0.113))) / rec.len))
            : 0;
        innerSheet.setAlpha(c, colAlpha[c]);
        innerSheet.setRev(c, glassRev);
        exitSheet.setAlpha(c, colAlpha[c]);
        exitSheet.setRev(c, Math.max(0, Math.min(1, (Math.max(0, tP - T_OUT[c]) * CV) / EXIT_LEN)));
        if (rec.valid || colAlpha[c] > 0.05) {
          gx += rec.ex * colAlpha[c];
          gy += rec.ey * colAlpha[c];
          ga += colAlpha[c];
          if (rec.valid && T_OUT[c] < tFirstOut) tFirstOut = T_OUT[c];
        }
      }
      exitSheet.commit();
      innerSheet.commit();

      const trapT = hasEntry ? (1 - alive / NC) * 0.85 : 0;
      trapGlow += (trapT - trapGlow) * (1 - Math.exp(-3 * dt));
      innerSheet.mat.uniforms.uOpacity.value = 0.3 * (1 + trapGlow * 1.6);

      for (let i = 0; i < 6; i++) {
        const c = PULSE_COL[i];
        sampleSheet(exitSheet, c, 0.38, SAMP);
        washes[i].position.set(SAMP.x, SAMP.y, -2);
        washes[i].material.opacity =
          0.05 * colAlpha[c] * Math.max(0, Math.min(1, (Math.max(0, tP - T_OUT[c]) * CV) / 5));
      }

      updatePulses(tP, dIn, airT, lamp, hasEntry);

      const exitFront = Math.max(0, Math.min(1, (Math.max(0, tP - tFirstOut) * CV) / 1.5));
      if (ga > 0.05) exitGlow.position.set(gx / ga, gy / ga, 0.05);
      exitGlow.scale.setScalar(0.5 * (1 + 0.12 * Math.sin(tA * 3)));
      exitGlow.material.opacity = 0.9 * Math.max(0, Math.min(1, ga / (NC * 0.5))) * exitFront;
      if (hasEntry) entryGlow.position.set(ENTRY.x, ENTRY.y, 0.05);
      entryGlow.material.opacity = 0.7 * entryAlpha * Math.max(0, Math.min(1, pastEntry / 0.7));

      samplePts(INC_PTS, 0.03, SAMP);
      sourceDot.position.copy(SAMP);
      sourceDot.scale.setScalar(0.17 + 0.02 * Math.sin(tA * 2.1));
      sourceDot.material.opacity = 0.95 * lamp;
      incoming.mat.uniforms.uOpacity.value =
        0.95 * lamp * (0.97 + 0.02 * Math.sin(tA * 9.1) + 0.015 * Math.sin(tA * 3.7));

      for (const b of allBeams) b.mat.uniforms.uTime.value = tA;
      exitSheet.mat.uniforms.uTime.value = tA;
      innerSheet.mat.uniforms.uTime.value = tA;
      return lamp;
    }

    function onResize() {
      const w = window.innerWidth,
        h = window.innerHeight;
      renderer.setSize(w, h);
      const aspect = w / h;
      camera.aspect = aspect;
      camZ = Math.min(9.6 / Math.min(1, aspect / 1.15), 15.5);
      camera.updateProjectionMatrix();
      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camZ;
      viewX.right = halfH * aspect + 1.2;
      viewX.left = -viewX.right;
    }
    window.addEventListener('resize', onResize);
    onResize();

    const clock = new THREE.Clock();
    let tGlobal = 0;

    function animate() {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      tGlobal += dt;
      const tA = tGlobal * PRISM_SPEED;

      // Higher rotation speed so the prism displays active rotation in 10 seconds
      const rotZ = Math.sin(tA * 0.45) * 0.28 + tA * 0.35;
      const rotY = Math.sin(tA * 0.38) * 0.55 + tA * 0.25;
      const rotX = Math.sin(tA * 0.25) * 0.2 + 0.02;
      const bob = Math.sin(tA * 0.8) * 0.08;

      prism.rotation.set(rotX, rotY, rotZ);
      prism.position.y = bob;
      prism.updateMatrixWorld();

      const lamp = updateOptics(tA, dt, rotZ, bob);

      const APEX_LOCAL = new THREE.Vector3(0, R, DEPTH / 2 + 0.02);
      const CORNER_LOCAL = LOCAL_V.slice(1).map((v) => new THREE.Vector3(v.x, v.y, DEPTH / 2 + 0.02));
      const APEX_W = new THREE.Vector3();
      APEX_W.copy(APEX_LOCAL).applyMatrix4(prism.matrixWorld);
      apexDot.position.copy(APEX_W);
      apexDot.material.opacity = 0.9 * lamp;
      for (let i = 0; i < 2; i++) {
        APEX_W.copy(CORNER_LOCAL[i]).applyMatrix4(prism.matrixWorld);
        cornerDots[i].position.copy(APEX_W);
        cornerDots[i].material.opacity = lamp * (0.35 + 0.25 * Math.sin(tA * 2 + i * 2.1));
      }

      glassMat.uniforms.uTime.value = tA;
      glassMat.uniforms.uCam.value.copy(camera.position);
      edgeMat.opacity = 0.45 + 0.08 * Math.sin(tA * 1.3) + trapGlow * 0.3;

      camera.position.set(Math.sin(tA * 0.2) * 0.25, 0.35 + Math.cos(tA * 0.15) * 0.12, camZ);
      camera.lookAt(0, 0.05, 0);

      dustMat.uniforms.uTime.value = tA;
      renderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      glowTex.dispose();
      word.texture.dispose();
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 overflow-hidden bg-[#0b0e1a] transition-opacity duration-1000 select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
    >
      {/* 3D WebGL Prism Canvas */}
      <canvas ref={canvasRef} id="sceneA" className="fixed inset-0 w-full h-full block" />

      {/* Optical Vignette & Grain */}
      <div className="intro-vignette" />
      <div className="intro-grain" />

      {/* GLITCH TITLE – Single Centered Layer with Glitch Effects */}
      <div className="glitch-title-wrap text-center flex flex-col items-center justify-center">
        <span className="glitch-text text-3xl sm:text-5xl">
          <span className="glitch-layer glitch-cyan">☬SHΞN™</span>
          <span className="glitch-layer glitch-magenta">☬SHΞN™</span>
          <span className="glitch-layer glitch-green">☬SHΞN™</span>
          <span className="glitch-layer glitch-white">☬SHΞN™</span>
        </span>

        {/* Initial Loading Time & System Status under the prism */}
        <div className="mt-3.5 flex items-center justify-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse shadow-[0_0_8px_#38bdf8]" />
          <span className="text-[11px] font-mono tracking-wider text-slate-400 opacity-80 uppercase">
            LOADING INITIALIZING • {secondsRemaining}s
          </span>
        </div>
      </div>
    </div>
  );
};
