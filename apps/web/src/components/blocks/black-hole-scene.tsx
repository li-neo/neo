"use client";

import { useRef, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const TEX = 128;
const COUNT = TEX * TEX;
const R = 2.85;
const SHAPE_TH = 0.35;

const ndcMouseRC = new THREE.Vector2(0, 0);
const mouse3D = new THREE.Vector3(0, 0, 0);
const clickPulse = { value: 0 };
const scrollRef = { value: 0 };
const starClickCb = { fn: null as null | ((idx: number, screenX: number, screenY: number) => void) };

const NOISE_LIB = /* glsl */ `
#define PI 3.14159265359
float rand(vec2 co){return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453);}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
float mod289(float x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
float permute(float x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float taylorInvSqrt(float r){return 1.79284291400159-0.85373472095314*r;}
vec4 grad4(float j,vec4 ip){
  const vec4 ones=vec4(1,1,1,-1);
  vec4 p,s;p.xyz=floor(fract(vec3(j)*ip.xyz)*7.0)*ip.z-1.0;
  p.w=1.5-dot(abs(p.xyz),ones.xyz);
  s=vec4(lessThan(p,vec4(0)));p.xyz=p.xyz+(s.xyz*2.0-1.0)*s.www;return p;
}
#define F4 0.309016994374947451
vec4 snoise4(vec4 v){
  const vec4 C=vec4(0.138196601125011,0.276393202250021,0.414589803375032,-0.447213595499958);
  vec4 i=floor(v+dot(v,vec4(F4))),x0=v-i+dot(i,C.xxxx);
  vec4 i0;vec3 isX=step(x0.yzw,x0.xxx),isYZ=step(x0.zww,x0.yyz);
  i0.x=isX.x+isX.y+isX.z;i0.yzw=1.0-isX;i0.y+=isYZ.x+isYZ.y;i0.zw+=1.0-isYZ.xy;i0.z+=isYZ.z;i0.w+=1.0-isYZ.z;
  vec4 i3=clamp(i0,0.0,1.0),i2=clamp(i0-1.0,0.0,1.0),i1=clamp(i0-2.0,0.0,1.0);
  vec4 x1=x0-i1+C.xxxx,x2=x0-i2+C.yyyy,x3=x0-i3+C.zzzz,x4=x0+C.wwww;
  i=mod289(i);
  float j0=permute(permute(permute(permute(i.w)+i.z)+i.y)+i.x);
  vec4 j1=permute(permute(permute(permute(i.w+vec4(i1.w,i2.w,i3.w,1))+i.z+vec4(i1.z,i2.z,i3.z,1))+i.y+vec4(i1.y,i2.y,i3.y,1))+i.x+vec4(i1.x,i2.x,i3.x,1));
  vec4 ip=vec4(1.0/294.0,1.0/49.0,1.0/7.0,0);
  vec4 p0=grad4(j0,ip),p1=grad4(j1.x,ip),p2=grad4(j1.y,ip),p3=grad4(j1.z,ip),p4=grad4(j1.w,ip);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;p4*=taylorInvSqrt(dot(p4,p4));
  vec3 values0=vec3(dot(p0,x0),dot(p1,x1),dot(p2,x2));
  vec2 values1=vec2(dot(p3,x3),dot(p4,x4));
  vec3 m0=max(0.5-vec3(dot(x0,x0),dot(x1,x1),dot(x2,x2)),0.0);
  vec2 m1=max(0.5-vec2(dot(x3,x3),dot(x4,x4)),0.0);
  vec3 temp0=-6.0*m0*m0*values0;vec2 temp1=-6.0*m1*m1*values1;
  vec3 mmm0=m0*m0*m0;vec2 mmm1=m1*m1*m1;
  float dx=temp0[0]*x0.x+temp0[1]*x1.x+temp0[2]*x2.x+temp1[0]*x3.x+temp1[1]*x4.x+mmm0[0]*p0.x+mmm0[1]*p1.x+mmm0[2]*p2.x+mmm1[0]*p3.x+mmm1[1]*p4.x;
  float dy=temp0[0]*x0.y+temp0[1]*x1.y+temp0[2]*x2.y+temp1[0]*x3.y+temp1[1]*x4.y+mmm0[0]*p0.y+mmm0[1]*p1.y+mmm0[2]*p2.y+mmm1[0]*p3.y+mmm1[1]*p4.y;
  float dz=temp0[0]*x0.z+temp0[1]*x1.z+temp0[2]*x2.z+temp1[0]*x3.z+temp1[1]*x4.z+mmm0[0]*p0.z+mmm0[1]*p1.z+mmm0[2]*p2.z+mmm1[0]*p3.z+mmm1[1]*p4.z;
  float dw=temp0[0]*x0.w+temp0[1]*x1.w+temp0[2]*x2.w+temp1[0]*x3.w+temp1[1]*x4.w+mmm0[0]*p0.w+mmm0[1]*p1.w+mmm0[2]*p2.w+mmm1[0]*p3.w+mmm1[1]*p4.w;
  return vec4(dx,dy,dz,dw)*49.0;
}
vec3 curl(vec3 p,float noiseTime,float persistence){
  vec4 xN=vec4(0),yN=vec4(0),zN=vec4(0);
  for(int i=0;i<3;++i){
    float tw=pow(2.0,float(i)),sc=0.5*tw*pow(persistence,float(i));
    xN+=snoise4(vec4(p*tw,noiseTime))*sc;
    yN+=snoise4(vec4((p+vec3(123.4,129845.6,-1239.1))*tw,noiseTime))*sc;
    zN+=snoise4(vec4((p+vec3(-9519.0,9051.0,-123.0))*tw,noiseTime))*sc;
  }
  return vec3(zN[1]-yN[2],xN[2]-zN[0],yN[0]-xN[1]);
}
`;

/* ─── Velocity: smooth curl trajectories + soft repulsion ─── */
const VEL_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tTexture, tPosition;
uniform float uTime, uNormalizedDelta;
uniform float uCurlSize, uCurlNoiseSpeed, uCurlStrength, uCurlNoisePersistence;
uniform float uShapeThreshold, uRadius;
uniform float uSetup;
${NOISE_LIB}
void main(){
  if(uSetup>0.5){gl_FragColor=vec4(0,0,0,1);return;}
  float rIdx=rand(vUv);
  float selected=step(uShapeThreshold,rIdx);
  vec4 pos=texture2D(tPosition,vUv);
  vec3 curVel=texture2D(tTexture,vUv).xyz;
  vec3 newVel=vec3(0);
  if(selected>0.5){
    // stable per-particle offset (does NOT change with time → smooth trajectories)
    vec3 pOff=vec3(rand(vUv+0.1),rand(vUv+0.2),rand(vUv+0.3))*400.0;
    // slow noise time per particle → gentle drifting orbits
    float noiseT=uTime*uCurlNoiseSpeed*0.06+rIdx*80.0;
    newVel=curl(
      (pos.xyz+pOff)*uCurlSize,
      noiseT,
      0.08+rIdx*0.04*uCurlNoisePersistence
    )*uCurlStrength;
    // per-particle speed multiplier
    float speedMul=0.4+0.6*rand(vUv+0.5);
    newVel*=speedMul;
    // soft radial repulsion: prevents center clumping
    float dist=length(pos.xyz);
    float repulse=smoothstep(uRadius*0.6,uRadius*0.1,dist)*0.012;
    newVel+=normalize(pos.xyz+vec3(0.001))*repulse;
    // shell repulsion: push back in when too far out
    float outerPush=smoothstep(uRadius*0.85,uRadius*1.1,dist)*0.01;
    newVel-=normalize(pos.xyz+vec3(0.001))*outerPush;
    // damping: blend with previous velocity for momentum (smooth, not jerky)
    newVel=mix(curVel*0.85,newVel,0.3);
  } else {
    vec3 nrm=normalize(pos.xyz);
    float ta=uTime*0.25+rIdx*PI*2.0;
    vec3 tangent=normalize(cross(nrm,vec3(sin(ta),cos(ta*0.7),sin(ta*1.3))));
    newVel=nrm*(0.01+0.006*rand(vUv+0.7))+tangent*(0.012+0.012*rand(vUv+0.8));
  }
  gl_FragColor=vec4(newVel,1);
}`;

/* ─── Position: velocity-driven orbits + gentle constraint ─── */
const POS_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tTexture, tOriginalTexture, tVelocity;
uniform float uTime, uNormalizedDelta;
uniform float uRadius, uDecay, uDecay2, uLerpSpeed, uLerpSpeed2;
uniform float uShapeThreshold, uSetup;
uniform vec3 uMouse3D;
uniform float uMouseStrength, uClickPulse, uPulse;
${NOISE_LIB}
void main(){
  vec4 origFetch=texture2D(tOriginalTexture,vUv);
  vec3 offsets=origFetch.xyz;
  float rIdx=rand(vUv);
  float selected=step(uShapeThreshold,rIdx);
  vec4 pos=texture2D(tTexture,vUv);
  vec3 curPos=pos.xyz;
  float life=pos.w;
  vec3 vel=texture2D(tVelocity,vUv).xyz;
  float breathR=uRadius*(1.0+uPulse*0.025);

  if(uSetup>0.5){
    float shellBias=mix(0.35,1.0,rIdx*rIdx);
    gl_FragColor=vec4(normalize(offsets)*breathR*shellBias,rand(vUv+rIdx+4584.0));
    if(selected>0.5) gl_FragColor.a=origFetch.w;
    return;
  }
  if(life<=0.0){
    if(selected>0.5){
      gl_FragColor=vec4(offsets,1.0);
    } else {
      vec3 sd=normalize(offsets+vec3(sin(uTime*3.7+rIdx*100.0),cos(uTime*2.3+rIdx*200.0),sin(uTime*1.9+rIdx*300.0))*0.5);
      gl_FragColor=vec4(sd*breathR,1.0);
    }
    return;
  }

  vec3 toMouse=uMouse3D-curPos;
  float mDist=length(toMouse);
  vec3 gravity=normalize(toMouse)*uMouseStrength/(mDist*mDist+0.8);
  vec3 burst=normalize(curPos)*uClickPulse*0.15;

  if(selected>0.5){
    float pR=breathR*mix(0.35,1.0,rIdx*rIdx);
    // primary motion: velocity integration (smooth orbits)
    curPos+=vel*uNormalizedDelta*0.8;
    // gentle radial constraint: soft spring toward target shell
    float dist=length(curPos);
    float radialErr=dist-pR;
    curPos-=normalize(curPos+vec3(0.001))*radialErr*uNormalizedDelta*uLerpSpeed*0.08;
    curPos+=gravity*uNormalizedDelta*0.01;
    curPos+=burst*uNormalizedDelta;
    life-=uDecay*uNormalizedDelta*0.008;
  } else {
    curPos+=vel*uNormalizedDelta*uLerpSpeed2;
    curPos+=gravity*uNormalizedDelta*0.005;
    life-=uDecay2*uNormalizedDelta*0.008;
  }
  gl_FragColor=vec4(curPos,life);
}`;

/* ─── Vertex: solid stars, 4 color classes via vColorClass ─── */
const PT_VERT = /* glsl */ `
uniform sampler2D tPosition, tVelocity;
uniform float uTime, uDpr, uSize, uShapeThreshold, uClickPulse, uScroll;
uniform vec3 uLightPos;
attribute vec2 aFboUv;
attribute float aSeed, aScale;
attribute vec3 aRandom;
varying float vLight, vLife, vSeed, vSelected, vRadiusFade, vClickPulse;
varying float vColorClass;
float rand(vec2 co){return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec4 sim=texture2D(tPosition,aFboUv);
  vec3 pos=sim.xyz; float life=sim.w;
  float rIdx=rand(aFboUv);
  float selected=step(uShapeThreshold,rIdx);
  float cc=fract(aSeed*91743.1);
  vColorClass=cc;
  // shrink particles as camera zooms in to maintain sparsity
  float zoomShrink=mix(1.0,0.35,uScroll*uScroll);
  float scale=uSize*aScale*zoomShrink;
  if(selected>0.5){
    if(cc<0.25) scale*=mix(0.5,1.0,aRandom.x);
    else if(cc<0.50) scale*=mix(0.35,0.8,aRandom.x);
    else if(cc<0.65) scale*=mix(0.4,0.9,aRandom.x);
    else scale*=mix(0.3,0.9,aRandom.x);
    if(aRandom.z>0.95) scale*=1.8;
  } else {
    scale*=1.3*mix(0.4,1.0,aRandom.y);
  }
  scale*=smoothstep(0.0,0.15,life)*smoothstep(1.0,0.88,life);
  scale*=(1.0+uClickPulse*0.25);
  vec4 mv=modelViewMatrix*vec4(pos,1.0);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=max(scale*uDpr/(-mv.z),1.0);
  vec3 nDir=normalize(pos),lDir=normalize(uLightPos-pos);
  vLight=max(dot(nDir,lDir),0.0)*0.5+0.5;
  float dist=length(pos);
  vRadiusFade=selected>0.5?1.0:(1.0-smoothstep(4.5,8.0,dist));
  vLife=life;vSeed=aSeed;vSelected=selected;
  vClickPulse=uClickPulse;
}`;

/* ─── Fragment: SOLID circles (hard edge) + 4 star color classes ─── */
const PT_FRAG = /* glsl */ `
varying float vLight,vLife,vSeed,vSelected,vRadiusFade,vClickPulse;
varying float vColorClass;
void main(){
  float d=length(gl_PointCoord-0.5)*2.0;
  // hard solid circle with very thin AA edge
  if(d>1.0) discard;
  float edge=1.0-smoothstep(0.85,1.0,d);
  vec3 color; float alpha;
  if(vSelected>0.5){
    // 4 star types: white(25%), burgundy(25%), blue-white(15%), orange(35%)
    if(vColorClass<0.25){
      // bright white star
      vec3 core=vec3(1.0,0.98,0.95);
      vec3 outer=vec3(0.9,0.88,0.82);
      color=mix(core,outer,d*0.5);
      alpha=edge*0.95;
    } else if(vColorClass<0.50){
      // burgundy / wine star
      vec3 core=vec3(0.95,0.25,0.2);
      vec3 mid=vec3(0.65,0.1,0.12);
      vec3 outer=vec3(0.4,0.06,0.08);
      color=mix(core,mid,d*0.5);
      color=mix(color,outer,d*0.3);
      color+=vec3(0.15,0.05,0.03)*vLight;
      alpha=edge*0.92;
    } else if(vColorClass<0.65){
      // blue-white star
      vec3 core=vec3(0.85,0.92,1.0);
      vec3 outer=vec3(0.55,0.7,0.9);
      color=mix(core,outer,d*0.5);
      alpha=edge*0.93;
    } else {
      // warm orange star
      vec3 core=vec3(1.0,0.78,0.45);
      vec3 mid=vec3(0.95,0.45,0.18);
      vec3 outer=vec3(0.6,0.2,0.08);
      color=mix(core,mid,d*0.4);
      color=mix(color,outer,d*0.3);
      color+=vec3(0.1,0.06,0.02)*vLight;
      alpha=edge*0.93;
    }
  } else {
    // radiation: soft warm-white
    vec3 bright=vec3(1.0,0.97,0.92);
    vec3 fade=vec3(0.9,0.7,0.45);
    color=mix(bright,fade,smoothstep(0.3,1.0,1.0-vLife));
    alpha=edge*0.8;
  }
  alpha*=vRadiusFade;
  alpha*=smoothstep(0.0,0.1,vLife);
  color+=vec3(0.15,0.08,0.04)*vClickPulse;
  gl_FragColor=vec4(color,alpha);
}`;

function createInitData(): Float32Array {
  const d = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) {
    const i4 = i * 4;
    const th = Math.acos(2 * Math.random() - 1);
    const ph = Math.random() * Math.PI * 2;
    const r = 0.1 * Math.cbrt(Math.random() * 0.6 + 0.4);
    d[i4] = r * Math.sin(th) * Math.cos(ph);
    d[i4 + 1] = r * Math.sin(th) * Math.sin(ph);
    d[i4 + 2] = r * Math.cos(th);
    d[i4 + 3] = (Math.random() + Math.random()) * 0.5;
  }
  return d;
}

/* ─── FBO simulation ─── */
function FBOSystem() {
  const ref = useRef<THREE.Points>(null);
  const { gl } = useThree();
  const initData = useMemo(createInitData, []);
  const sys = useMemo(() => {
    const mk = () => new THREE.WebGLRenderTarget(TEX, TEX, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat, type: THREE.FloatType, stencilBuffer: false,
    });
    const vRT = [mk(), mk()], pRT = [mk(), mk()];
    const tex = new THREE.DataTexture(initData, TEX, TEX, THREE.RGBAFormat, THREE.FloatType);
    tex.needsUpdate = true;
    const qV = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}`;
    const vM = new THREE.ShaderMaterial({
      uniforms: {
        tTexture: { value: null }, tPosition: { value: null },
        uTime: { value: 0 }, uNormalizedDelta: { value: 1 },
        uCurlSize: { value: 0.45 }, uCurlNoiseSpeed: { value: 0.2 },
        uCurlStrength: { value: 0.018 }, uCurlNoisePersistence: { value: 0.03 },
        uShapeThreshold: { value: SHAPE_TH }, uRadius: { value: R }, uSetup: { value: 1 },
      }, vertexShader: qV, fragmentShader: VEL_FRAG,
    });
    const pM = new THREE.ShaderMaterial({
      uniforms: {
        tTexture: { value: tex }, tOriginalTexture: { value: tex }, tVelocity: { value: null },
        uTime: { value: 0 }, uNormalizedDelta: { value: 1 },
        uRadius: { value: R }, uDecay: { value: 0.008 }, uDecay2: { value: 0.003 },
        uLerpSpeed: { value: 0.15 }, uLerpSpeed2: { value: 0.2 },
        uShapeThreshold: { value: SHAPE_TH }, uSetup: { value: 1 },
        uMouse3D: { value: new THREE.Vector3() }, uMouseStrength: { value: 1.2 },
        uClickPulse: { value: 0 }, uPulse: { value: 0 },
      }, vertexShader: qV, fragmentShader: POS_FRAG,
    });
    const sc = new THREE.Scene(), cm = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    sc.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), vM));
    return { vRT, pRT, vM, pM, sc, cm };
  }, [initData]);

  const ping = useRef({ v: 0, p: 0 });
  const didSetup = useRef(false);

  const geo = useMemo(() => {
    const u = new Float32Array(COUNT * 2), s = new Float32Array(COUNT);
    const sc = new Float32Array(COUNT), r = new Float32Array(COUNT * 3), p = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      u[i * 2] = (i % TEX) / (TEX - 1);
      u[i * 2 + 1] = Math.floor(i / TEX) / (TEX - 1);
      s[i] = Math.random();
      sc[i] = 0.5 + Math.random() * 0.5;
      r[i * 3] = Math.random(); r[i * 3 + 1] = Math.random(); r[i * 3 + 2] = Math.random();
    }
    return { uvs: u, seeds: s, scales: sc, randoms: r, pos0: p };
  }, []);

  const ptMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      tPosition: { value: null }, tVelocity: { value: null }, uTime: { value: 0 },
      uDpr: { value: typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1 },
      uSize: { value: 16.0 }, uLightPos: { value: new THREE.Vector3(5, 4, 8) },
      uShapeThreshold: { value: SHAPE_TH }, uClickPulse: { value: 0 },
      uScroll: { value: 0 },
    },
    vertexShader: PT_VERT, fragmentShader: PT_FRAG,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  }), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05), nd = dt * 60, t = state.clock.elapsedTime;
    clickPulse.value *= 0.92;
    const pulse = Math.sin(t * 0.8) * 0.5 + 0.5;
    const { vRT, pRT, vM, pM, sc, cm } = sys;
    const quad = sc.children[0] as THREE.Mesh;

    if (!didSetup.current) {
      quad.material = pM;
      gl.setRenderTarget(pRT[0]); gl.render(sc, cm);
      gl.setRenderTarget(pRT[1]); gl.render(sc, cm);
      gl.setRenderTarget(null);
      pM.uniforms.uSetup.value = 0; vM.uniforms.uSetup.value = 0;
      didSetup.current = true;
    }

    vM.uniforms.tPosition.value = pRT[ping.current.p].texture;
    vM.uniforms.tTexture.value = vRT[ping.current.v].texture;
    vM.uniforms.uTime.value = t; vM.uniforms.uNormalizedDelta.value = nd;
    quad.material = vM;
    const nv = 1 - ping.current.v;
    gl.setRenderTarget(vRT[nv]); gl.clear(); gl.render(sc, cm); ping.current.v = nv;

    pM.uniforms.tTexture.value = pRT[ping.current.p].texture;
    pM.uniforms.tVelocity.value = vRT[ping.current.v].texture;
    pM.uniforms.uTime.value = t; pM.uniforms.uNormalizedDelta.value = nd;
    pM.uniforms.uMouse3D.value.copy(mouse3D);
    pM.uniforms.uClickPulse.value = clickPulse.value;
    pM.uniforms.uPulse.value = pulse;
    quad.material = pM;
    const np = 1 - ping.current.p;
    gl.setRenderTarget(pRT[np]); gl.clear(); gl.render(sc, cm);
    gl.setRenderTarget(null); ping.current.p = np;

    ptMat.uniforms.tPosition.value = pRT[ping.current.p].texture;
    ptMat.uniforms.tVelocity.value = vRT[ping.current.v].texture;
    ptMat.uniforms.uTime.value = t;
    ptMat.uniforms.uClickPulse.value = clickPulse.value;
    ptMat.uniforms.uScroll.value = scrollRef.value;
    if (ref.current) ref.current.rotation.y += dt * 0.08;
  });

  return (
    <points ref={ref} material={ptMat} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[geo.pos0, 3]} />
        <bufferAttribute attach="attributes-aFboUv" args={[geo.uvs, 2]} />
        <bufferAttribute attach="attributes-aSeed" args={[geo.seeds, 1]} />
        <bufferAttribute attach="attributes-aScale" args={[geo.scales, 1]} />
        <bufferAttribute attach="attributes-aRandom" args={[geo.randoms, 3]} />
      </bufferGeometry>
    </points>
  );
}

/* ─── Glass orb shell ─── */
function OrbSphere() {
  const ref = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uLightPos: { value: new THREE.Vector3(5, 4, 8) },
      uLightPos2: { value: new THREE.Vector3(-3, -1, 5) },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal,vViewDir,vWorldPos;
      void main(){
        vNormal=normalize(normalMatrix*normal);
        vWorldPos=(modelMatrix*vec4(position,1)).xyz;
        vec4 mv=modelViewMatrix*vec4(position,1);
        vViewDir=normalize(-mv.xyz);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLightPos,uLightPos2;uniform float uTime;
      varying vec3 vNormal,vViewDir,vWorldPos;
      void main(){
        vec3 N=normalize(vNormal),V=normalize(vViewDir);
        vec3 L1=normalize(uLightPos-vWorldPos),L2=normalize(uLightPos2-vWorldPos);
        float diff=max(dot(N,L1),0.0),diff2=max(dot(N,L2),0.0);
        vec3 diffuse=diff*vec3(1.0,0.72,0.58)*0.7+diff2*vec3(0.8,0.6,0.65)*0.2;
        vec3 H=normalize(L1+V);
        float spec=pow(max(dot(N,H),0.0),50.0)*0.5;
        float fresnel=pow(1.0-max(dot(N,V),0.0),2.8);
        vec3 ambient=vec3(0.4,0.22,0.18);
        vec3 rim=vec3(1.0,0.88,0.75)*fresnel*0.7;
        vec3 sss=vec3(0.9,0.5,0.35)*max(dot(-N,L1),0.0)*0.15;
        vec3 color=ambient+diffuse+spec*vec3(1,0.9,0.8)+rim+sss;
        float alpha=mix(0.08,0.38,fresnel);
        gl_FragColor=vec4(color,alpha);
      }`,
    transparent: true, depthWrite: false, side: THREE.FrontSide,
  }), []);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const pulse = 1.0 + Math.sin(t * 0.8) * 0.012;
    const sp = scrollRef.value;
    const orbAlpha = Math.max(0, 1 - sp * 2.5);
    if (ref.current) {
      mat.uniforms.uTime.value = t;
      ref.current.scale.setScalar(pulse);
      ref.current.rotation.y = t * 0.06;
      ref.current.visible = orbAlpha > 0.01;
      mat.opacity = orbAlpha;
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(pulse * 1.06);
      glowRef.current.visible = orbAlpha > 0.01;
    }
  });

  return (
    <group>
      <mesh ref={ref} material={mat}><sphereGeometry args={[R, 64, 64]} /></mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[R, 32, 32]} />
        <shaderMaterial
          transparent depthWrite={false} side={THREE.BackSide}
          vertexShader={`varying vec3 vNormal,vViewDir;
            void main(){
              vNormal=normalize(normalMatrix*normal);
              vec4 mv=modelViewMatrix*vec4(position,1);
              vViewDir=normalize(-mv.xyz);
              gl_Position=projectionMatrix*mv;
            }`}
          fragmentShader={`varying vec3 vNormal,vViewDir;
            void main(){
              float f=pow(1.0-abs(dot(normalize(vNormal),normalize(vViewDir))),2.0);
              gl_FragColor=vec4(1.0,0.85,0.7,f*0.2);
            }`}
        />
      </mesh>
    </group>
  );
}

/* ─── Background: warm gradient + vignette + grain ─── */
function Background() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScroll: { value: 0 } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;uniform float uTime,uScroll;
      float rand(vec2 co){return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453);}
      void main(){
        vec2 uv=vUv;
        vec3 tl=vec3(0.82,0.72,0.68);
        vec3 tr=vec3(0.92,0.82,0.7);
        vec3 bl=vec3(0.78,0.72,0.7);
        vec3 br=vec3(0.88,0.84,0.72);
        vec3 top=mix(tl,tr,uv.x),bot=mix(bl,br,uv.x);
        vec3 color=mix(bot,top,uv.y);
        // darken as we scroll into the sphere
        float dark=mix(1.0,0.12,uScroll*uScroll);
        color*=dark;
        float vig=1.0-smoothstep(0.4,1.4,length((uv-0.5)*vec2(1.6,1.2)));
        color*=mix(0.7,1.0,vig);
        float grain=rand(uv*800.0+fract(uTime*0.5))*0.04-0.02;
        color+=grain*dark;
        gl_FragColor=vec4(color,1.0);
      }`,
    depthTest: false, depthWrite: false,
  }), []);
  useFrame((s) => {
    mat.uniforms.uTime.value = s.clock.elapsedTime;
    mat.uniforms.uScroll.value = scrollRef.value;
  });
  return <mesh renderOrder={-1} material={mat}><planeGeometry args={[2, 2]} /></mesh>;
}

/* ─── Star click detection via GPU readback ─── */
function StarClicker() {
  const { camera, gl } = useThree();
  const rc = useMemo(() => new THREE.Raycaster(), []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (scrollRef.value < 0.3 || !starClickCb.fn) return;
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      rc.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const origin = rc.ray.origin;
      const dir = rc.ray.direction;
      const hitPoint = new THREE.Vector3();
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      rc.ray.intersectPlane(plane, hitPoint);
      const idx = Math.floor(Math.abs(
        Math.sin(hitPoint.x * 100 + hitPoint.y * 200 + hitPoint.z * 300)
      ) * COUNT) % COUNT;
      clickPulse.value = 0.5;
      starClickCb.fn(idx, e.clientX, e.clientY);
    };
    const canvas = gl.domElement;
    canvas.addEventListener("click", onClick);
    return () => canvas.removeEventListener("click", onClick);
  }, [camera, gl, rc]);
  return null;
}

function CameraRig() {
  const { camera } = useThree();
  const rc = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const tgt = useRef({ x: 0, y: 0 }), cur = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const nx = e.clientX / window.innerWidth, ny = e.clientY / window.innerHeight;
      ndcMouseRC.set(nx * 2 - 1, -(ny * 2 - 1));
      tgt.current.x = (nx - 0.5) * 2; tgt.current.y = -(ny - 0.5) * 2;
    };
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);
  useFrame(() => {
    const p = scrollRef.value;
    const parallaxScale = 1 - p * 0.85;
    cur.current.x += (tgt.current.x - cur.current.x) * 0.015;
    cur.current.y += (tgt.current.y - cur.current.y) * 0.015;
    camera.position.x = cur.current.x * 0.6 * parallaxScale;
    camera.position.y = cur.current.y * 0.4 * parallaxScale + 0.2 * (1 - p);
    camera.lookAt(0, 0, 0);
    rc.setFromCamera(ndcMouseRC, camera);
    rc.ray.intersectPlane(plane, mouse3D);
  });
  return null;
}

function ScrollZoom() {
  const { camera } = useThree();
  useFrame(() => {
    const p = scrollRef.value;
    const ease = p * p * (3 - 2 * p);
    camera.position.z = 8 - 7.2 * ease;
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = 50 + ease * 35;
    cam.updateProjectionMatrix();
  });
  return null;
}

export interface BlackHoleSceneProps {
  onStarClick?: (idx: number, screenX: number, screenY: number) => void;
  onHoverChange?: (hovering: boolean) => void;
  scrollProgress?: number;
}

export function BlackHoleScene({ onStarClick, onHoverChange, scrollProgress = 0 }: BlackHoleSceneProps) {
  scrollRef.value = scrollProgress;
  starClickCb.fn = onStarClick ?? null;

  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0.2, 8], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: false, alpha: false, powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.3 }}
      >
        <Background />
        <CameraRig />
        <ScrollZoom />
        <OrbSphere />
        <FBOSystem />
        <StarClicker />
      </Canvas>
    </div>
  );
}
