"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SCENE as C } from "./scene-config";

const TEX = C.TEX;
const COUNT = TEX * TEX;
const BT = C.BODY_TYPES;

export const enum BodyType { Star, BlackHole, Planet, RingPlanet, Asteroid, Satellite, Comet }

const TYPE_RATIOS: [BodyType, number][] = [
  [BodyType.Star, BT.STAR.ratio],
  [BodyType.BlackHole, BT.BLACK_HOLE.ratio],
  [BodyType.Planet, BT.PLANET.ratio],
  [BodyType.RingPlanet, BT.RING_PLANET.ratio],
  [BodyType.Asteroid, BT.ASTEROID.ratio],
  [BodyType.Satellite, BT.SATELLITE.ratio],
  [BodyType.Comet, BT.COMET.ratio],
];

const SCALE_RANGES: Record<number, [number, number]> = {
  [BodyType.Star]: BT.STAR.scale,
  [BodyType.BlackHole]: BT.BLACK_HOLE.scale,
  [BodyType.Planet]: BT.PLANET.scale,
  [BodyType.RingPlanet]: BT.RING_PLANET.scale,
  [BodyType.Asteroid]: BT.ASTEROID.scale,
  [BodyType.Satellite]: BT.SATELLITE.scale,
  [BodyType.Comet]: BT.COMET.scale,
};

function seededRand(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s & 0x7fffffff) / 0x7fffffff; };
}

export interface BodyAlloc {
  type: BodyType;
  indices: number[];
  fboUvs: Float32Array;
  seeds: Float32Array;
  scales: Float32Array;
  subTypes: Float32Array;
}

export function allocateBodies(): BodyAlloc[] {
  const buckets = new Map<BodyType, number[]>();
  for (const [t] of TYPE_RATIOS) buckets.set(t, []);

  const cdf: [BodyType, number][] = [];
  let acc = 0;
  for (const [t, r] of TYPE_RATIOS) { acc += r; cdf.push([t, acc]); }

  const rng = seededRand(42);
  for (let i = 0; i < COUNT; i++) {
    const v = rng();
    for (const [t, c] of cdf) {
      if (v <= c) { buckets.get(t)!.push(i); break; }
    }
  }

  const result: BodyAlloc[] = [];
  for (const [t] of TYPE_RATIOS) {
    const indices = buckets.get(t)!;
    const n = indices.length;
    const fboUvs = new Float32Array(n * 2);
    const seeds = new Float32Array(n);
    const scales = new Float32Array(n);
    const subTypes = new Float32Array(n);
    const [sMin, sMax] = SCALE_RANGES[t];
    const rng2 = seededRand(t * 1000 + 7);
    for (let j = 0; j < n; j++) {
      const idx = indices[j];
      fboUvs[j * 2] = (idx % TEX) / (TEX - 1);
      fboUvs[j * 2 + 1] = Math.floor(idx / TEX) / (TEX - 1);
      seeds[j] = rng2();
      scales[j] = sMin + rng2() * (sMax - sMin);
      subTypes[j] = rng2();
    }
    result.push({ type: t, indices, fboUvs, seeds, scales, subTypes });
  }
  return result;
}

const _dummy = new THREE.Object3D();
const _col = new THREE.Color();

interface CelestialProps {
  allocs: BodyAlloc[];
  posTex: () => THREE.WebGLRenderTarget | null;
  gl: THREE.WebGLRenderer;
  time: { value: number };
  scroll: { value: number };
  mouse: THREE.Vector3;
  camPos: THREE.Vector3;
}

/**
 * Root component: reads FBO once per frame, dispatches position data to all body groups.
 */
export function CelestialBodies({ allocs, posTex, gl, time, scroll, mouse, camPos }: CelestialProps) {
  const posDataRef = useRef<Float32Array>(new Float32Array(TEX * TEX * 4));

  useFrame(() => {
    const rt = posTex();
    if (!rt) return;
    gl.readRenderTargetPixels(rt, 0, 0, TEX, TEX, posDataRef.current);
  });

  return (
    <>
      {allocs.map((a) => (
        <BodyGroup key={a.type} alloc={a} posData={posDataRef} time={time} scroll={scroll} camPos={camPos} />
      ))}
    </>
  );
}

/* ── geometry builders — low-poly for performance ── */
function buildStarGeo() { return new THREE.SphereGeometry(1, 8, 6); }
function buildBlackHoleGeo() { return new THREE.SphereGeometry(1, 8, 6); }
function buildAccretionDiskGeo() { return new THREE.TorusGeometry(1.6, 0.12, 6, 16); }
function buildPlanetGeo() { return new THREE.SphereGeometry(1, 8, 6); }
function buildRingPlanetGeo() { return new THREE.SphereGeometry(1, 8, 6); }
function buildSaturnRingGeo() { return new THREE.RingGeometry(1.4, 2.0, 16); }
function buildCometGeo() { return new THREE.SphereGeometry(1, 6, 4); }

function buildAsteroidGeo() {
  const base = new THREE.IcosahedronGeometry(1, 0);
  const pos = base.attributes.position;
  const rng = seededRand(77777);
  for (let i = 0; i < pos.count; i++) {
    const r = 0.75 + rng() * 0.5;
    pos.setXYZ(i, pos.getX(i) * r, pos.getY(i) * r, pos.getZ(i) * r);
  }
  pos.needsUpdate = true;
  base.computeVertexNormals();
  return base;
}

function buildSatelliteGeo() {
  const body = new THREE.BoxGeometry(1, 0.5, 0.5, 1, 1, 1);
  const panel1 = new THREE.BoxGeometry(1.8, 0.04, 0.6, 1, 1, 1);
  const panel2 = new THREE.BoxGeometry(1.8, 0.04, 0.6, 1, 1, 1);
  panel1.applyMatrix4(new THREE.Matrix4().makeTranslation(1.2, 0, 0));
  panel2.applyMatrix4(new THREE.Matrix4().makeTranslation(-1.2, 0, 0));
  return mergeGeos([body, panel1, panel2]);
}

/* ── per‑type rendering ── */
function BodyGroup({ alloc, posData, time, scroll, camPos }: {
  alloc: BodyAlloc;
  posData: React.RefObject<Float32Array>;
  time: { value: number };
  scroll: { value: number };
  camPos: THREE.Vector3;
}) {
  const n = alloc.indices.length;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);

  const { geo, mat, ringGeo, ringMat } = useMemo(() => {
    const bt = alloc.type;
    let geo: THREE.BufferGeometry;
    let mat: THREE.Material;
    let ringGeo: THREE.BufferGeometry | null = null;
    let ringMat: THREE.Material | null = null;

    switch (bt) {
      case BodyType.Star:
        geo = buildStarGeo();
        mat = new THREE.MeshBasicMaterial({ toneMapped: false });
        break;
      case BodyType.BlackHole:
        geo = buildBlackHoleGeo();
        mat = new THREE.MeshBasicMaterial({ color: 0x080808 });
        ringGeo = buildAccretionDiskGeo();
        ringMat = new THREE.MeshBasicMaterial({ color: 0xff6622, transparent: true, opacity: 0.7, toneMapped: false });
        break;
      case BodyType.Planet:
        geo = buildPlanetGeo();
        mat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.1 });
        break;
      case BodyType.RingPlanet:
        geo = buildRingPlanetGeo();
        mat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.15, color: 0xddbb88 });
        ringGeo = buildSaturnRingGeo();
        ringMat = new THREE.MeshBasicMaterial({ color: 0xccaa77, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        break;
      case BodyType.Asteroid:
        geo = buildAsteroidGeo();
        mat = new THREE.MeshStandardMaterial({ color: 0x8a7d6b, roughness: 0.95, metalness: 0.05 });
        break;
      case BodyType.Satellite:
        geo = buildSatelliteGeo();
        mat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.4, metalness: 0.6 });
        break;
      case BodyType.Comet:
        geo = buildCometGeo();
        mat = new THREE.MeshBasicMaterial({ color: 0xddeeff, toneMapped: false });
        break;
      default:
        geo = new THREE.SphereGeometry(1, 8, 6);
        mat = new THREE.MeshBasicMaterial();
    }
    return { geo, mat, ringGeo, ringMat };
  }, [alloc.type]);

  const colors = useMemo(() => {
    const arr = new Float32Array(n * 3);
    const bt = alloc.type;
    for (let i = 0; i < n; i++) {
      const sub = alloc.subTypes[i];
      switch (bt) {
        case BodyType.Star:
          if (sub < 0.33) _col.setRGB(0.9, 0.92, 1.0);
          else if (sub < 0.66) _col.setRGB(1.0, 0.92, 0.6);
          else _col.setRGB(1.0, 0.45, 0.25);
          break;
        case BodyType.Planet:
          if (sub < 0.25) _col.setRGB(0.2, 0.45, 0.8);
          else if (sub < 0.5) _col.setRGB(0.75, 0.35, 0.2);
          else if (sub < 0.75) _col.setRGB(0.6, 0.78, 0.92);
          else _col.setRGB(0.8, 0.7, 0.4);
          break;
        case BodyType.RingPlanet:
          if (sub < 0.5) _col.setRGB(0.85, 0.75, 0.55);
          else _col.setRGB(0.75, 0.68, 0.50);
          break;
        case BodyType.Asteroid:
          _col.setRGB(0.5 + sub * 0.3, 0.45 + sub * 0.2, 0.35 + sub * 0.15);
          break;
        case BodyType.Satellite:
          _col.setRGB(0.8, 0.8, 0.85);
          break;
        case BodyType.Comet:
          _col.setRGB(0.85 + sub * 0.15, 0.9 + sub * 0.1, 1.0);
          break;
        default:
          _col.setRGB(1, 1, 1);
      }
      arr[i * 3] = _col.r; arr[i * 3 + 1] = _col.g; arr[i * 3 + 2] = _col.b;
    }
    return arr;
  }, [alloc, n]);

  const tiltAxes = useMemo(() => {
    const arr = new Float32Array(n * 3);
    const rng = seededRand(alloc.type * 9999 + 13);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = rng() * 2 - 1;
      arr[i * 3 + 1] = rng() * 2 - 1;
      arr[i * 3 + 2] = rng() * 2 - 1;
    }
    return arr;
  }, [alloc.type, n]);

  useFrame(() => {
    if (!meshRef.current || !posData.current) return;
    const t = time.value;
    const sp = scroll.value;
    const pd = posData.current;

    const bodyT = Math.max(0, Math.min(1,
      (sp - C.BODY_APPEAR_SCROLL) / (C.BODY_FULL_SCROLL - C.BODY_APPEAR_SCROLL)));
    if (bodyT <= 0) {
      meshRef.current.visible = false;
      if (ringRef.current) ringRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;
    if (ringRef.current) ringRef.current.visible = true;

    const zoomGrow = 1 + (C.ZOOM_GROW_MAX - 1) * sp * sp;
    const cullTh = sp * sp * C.ZOOM_DENSITY_CULL;
    const mesh = meshRef.current;
    const hasRing = ringRef.current && (alloc.type === BodyType.RingPlanet || alloc.type === BodyType.BlackHole);

    const cx = camPos.x, cy = camPos.y, cz = camPos.z;

    for (let j = 0; j < n; j++) {
      const gIdx = alloc.indices[j];
      const i4 = gIdx * 4;
      const px = pd[i4], py = pd[i4 + 1], pz = pd[i4 + 2];
      const life = pd[i4 + 3];

      // depth-based culling: particles closer to camera are hidden first
      const dx = px - cx, dy = py - cy, dz = pz - cz;
      const camDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const nearFade = Math.min(1, camDist * 0.8);

      const cullRand = alloc.seeds[j];
      const visible = life > 0.01 && cullRand > cullTh && nearFade > 0.15;
      const s = visible ? alloc.scales[j] * zoomGrow * bodyT * nearFade : 0;

      _dummy.position.set(px, py, pz);
      const selfRot = t * (0.3 + alloc.seeds[j] * 0.7);
      _dummy.rotation.set(tiltAxes[j * 3] * 0.5, selfRot, tiltAxes[j * 3 + 1] * 0.3);
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      mesh.setMatrixAt(j, _dummy.matrix);

      if (alloc.type === BodyType.Star) {
        const pulse = 0.8 + Math.sin(t * 2 + alloc.seeds[j] * 10) * 0.2;
        _col.setRGB(colors[j * 3] * pulse, colors[j * 3 + 1] * pulse, colors[j * 3 + 2] * pulse);
      } else {
        _col.setRGB(colors[j * 3], colors[j * 3 + 1], colors[j * 3 + 2]);
      }
      mesh.setColorAt(j, _col);

      if (hasRing) {
        const rmesh = ringRef.current!;
        if (alloc.type === BodyType.BlackHole) {
          _dummy.rotation.set(tiltAxes[j * 3] * 0.3, t * 1.5 + alloc.seeds[j] * 6, tiltAxes[j * 3 + 1] * 0.3);
        } else {
          _dummy.rotation.set(Math.PI * 0.4 + tiltAxes[j * 3] * 0.2, selfRot * 0.1, tiltAxes[j * 3 + 1] * 0.3);
        }
        _dummy.updateMatrix();
        rmesh.setMatrixAt(j, _dummy.matrix);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    if (hasRing) {
      ringRef.current!.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[geo, mat, n]} frustumCulled={false}>
        <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
      </instancedMesh>
      {ringGeo && ringMat && (
        <instancedMesh ref={ringRef} args={[ringGeo, ringMat, n]} frustumCulled={false} />
      )}
    </>
  );
}

function mergeGeos(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0, totalIdx = 0;
  for (const g of geos) {
    totalVerts += g.attributes.position.count;
    totalIdx += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(totalVerts * 3);
  const norm = new Float32Array(totalVerts * 3);
  const idx = new Uint16Array(totalIdx);
  let vo = 0, io = 0;
  for (const g of geos) {
    const gp = g.attributes.position;
    const gn = g.attributes.normal;
    for (let i = 0; i < gp.count; i++) {
      pos[(vo + i) * 3] = gp.getX(i);
      pos[(vo + i) * 3 + 1] = gp.getY(i);
      pos[(vo + i) * 3 + 2] = gp.getZ(i);
      if (gn) { norm[(vo + i) * 3] = gn.getX(i); norm[(vo + i) * 3 + 1] = gn.getY(i); norm[(vo + i) * 3 + 2] = gn.getZ(i); }
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo;
      io += g.index.count;
    } else {
      for (let i = 0; i < gp.count; i++) idx[io + i] = vo + i;
      io += gp.count;
    }
    vo += gp.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(norm, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeVertexNormals();
  return out;
}
