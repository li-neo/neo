"use client";

import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SCENE as C } from "./scene-config";
import { allocateBodies, CelestialBodies, type BodyAlloc } from "./celestial-bodies";

const TEX = C.TEX;
const COUNT = TEX * TEX;

const ndcMouseRC = new THREE.Vector2(0, 0);
const mouse3D = new THREE.Vector3(0, 0, 0);
const clickPulse = { value: 0 };
const scrollRef = { value: 0 };
const hoverCb = { fn: null as null | ((info: { idx: number; x: number; y: number } | null) => void) };
const starClickCb = { fn: null as null | ((idx: number, x: number, y: number) => void) };
const sharedTime = { value: 0 };

/* ── noise library shared by FBO shaders ── */
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
  const vec4 C2=vec4(0.138196601125011,0.276393202250021,0.414589803375032,-0.447213595499958);
  vec4 i=floor(v+dot(v,vec4(F4))),x0=v-i+dot(i,C2.xxxx);
  vec4 i0;vec3 isX=step(x0.yzw,x0.xxx),isYZ=step(x0.zww,x0.yyz);
  i0.x=isX.x+isX.y+isX.z;i0.yzw=1.0-isX;i0.y+=isYZ.x+isYZ.y;i0.zw+=1.0-isYZ.xy;i0.z+=isYZ.z;i0.w+=1.0-isYZ.z;
  vec4 i3=clamp(i0,0.0,1.0),i2=clamp(i0-1.0,0.0,1.0),i1=clamp(i0-2.0,0.0,1.0);
  vec4 x1=x0-i1+C2.xxxx,x2=x0-i2+C2.yyyy,x3=x0-i3+C2.zzzz,x4=x0+C2.wwww;
  i=mod289(i);
  float j0=permute(permute(permute(permute(i.w)+i.z)+i.y)+i.x);
  vec4 j1=permute(permute(permute(permute(i.w+vec4(i1.w,i2.w,i3.w,1))+i.z+vec4(i1.z,i2.z,i3.z,1))+i.y+vec4(i1.y,i2.y,i3.y,1))+i.x+vec4(i1.x,i2.x,i3.x,1));
  vec4 ip2=vec4(1.0/294.0,1.0/49.0,1.0/7.0,0);
  vec4 p0=grad4(j0,ip2),p1=grad4(j1.x,ip2),p2=grad4(j1.y,ip2),p3=grad4(j1.z,ip2),p4=grad4(j1.w,ip2);
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

/* ── FBO velocity shader ── */
const VEL_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tTexture, tPosition;
uniform float uTime, uNormalizedDelta;
uniform float uShapeThreshold, uRadius, uScroll;
uniform vec3 uMouse3D;
uniform float uSetup;
uniform float uOrbitMin, uOrbitMax, uKeplerExp;
uniform float uCometMin, uCometMax, uCometKeplerExp;
uniform float uNoiseStr, uNoiseTimeScale;
uniform float uRadialRepulse, uOuterPush;
uniform float uMomentumBlend, uVelRetain;
uniform float uMouseFreezeR, uMouseFreezeStr, uMouseAttractBlend, uMouseScrollTh;
#define COMET_TH ${C.COMET_RATIO.toFixed(4)}
${NOISE_LIB}
void main(){
  if(uSetup>0.5){gl_FragColor=vec4(0,0,0,1);return;}
  float rIdx=rand(vUv);
  float selected=step(uShapeThreshold,rIdx);
  vec4 pos=texture2D(tPosition,vUv);
  vec3 curVel=texture2D(tTexture,vUv).xyz;
  vec3 newVel=vec3(0);
  bool isComet=rIdx>uShapeThreshold && rIdx<(uShapeThreshold+COMET_TH);
  if(selected>0.5){
    vec3 p=pos.xyz;
    float dist=length(p);
    vec3 nrm=normalize(p+vec3(0.0001));
    float axTh=acos(rand(vUv+0.1)*2.0-1.0);
    float axPh=rand(vUv+0.2)*6.2831853;
    vec3 axis=vec3(sin(axTh)*cos(axPh),sin(axTh)*sin(axPh),cos(axTh));
    float dir=step(0.5,rand(vUv+0.35))*2.0-1.0;
    float rNorm=max(dist/uRadius,0.1);
    float omega;
    if(isComet){
      omega=mix(uCometMin,uCometMax,rand(vUv+0.9))*pow(rNorm,-uCometKeplerExp);
    } else {
      float speedVar=rand(vUv+0.4)*rand(vUv+0.41);
      omega=mix(uOrbitMin,uOrbitMax,speedVar)*pow(rNorm,-uKeplerExp);
    }
    vec3 tangent=cross(axis,nrm);
    float tl=length(tangent);
    if(tl>0.001) tangent/=tl; else tangent=vec3(1,0,0);
    newVel=tangent*omega*dist*dir;
    vec3 pOff=vec3(rand(vUv+0.5),rand(vUv+0.6),rand(vUv+0.7))*200.0;
    float noisePhase=uTime*uNoiseTimeScale+rIdx*50.0;
    newVel+=curl((p+pOff)*0.25,noisePhase,0.04)*uNoiseStr;
    float repulse=smoothstep(uRadius*0.4,uRadius*0.05,dist)*uRadialRepulse;
    newVel+=nrm*repulse;
    float outerP=smoothstep(uRadius*0.85,uRadius*1.1,dist)*uOuterPush;
    newVel-=nrm*outerP;
    if(uScroll>uMouseScrollTh){
      float mDist=length(uMouse3D-p);
      float attract=smoothstep(uMouseFreezeR,0.02,mDist)*uScroll;
      vec3 toMouse=normalize(uMouse3D-p+vec3(0.0001));
      newVel=mix(newVel, toMouse*0.0003, attract*uMouseAttractBlend);
      newVel*=(1.0-attract*uMouseFreezeStr);
    }
    float blend=isComet?0.35:uMomentumBlend;
    float retain=isComet?0.65:uVelRetain;
    newVel=mix(curVel*retain,newVel,blend);
  } else {
    vec3 nrm=normalize(pos.xyz);
    float ta=uTime*0.12+rIdx*PI*2.0;
    vec3 tangent=normalize(cross(nrm,vec3(sin(ta),cos(ta*0.7),sin(ta*1.3))));
    newVel=nrm*(0.005+0.003*rand(vUv+0.7))+tangent*(0.006+0.006*rand(vUv+0.8));
  }
  gl_FragColor=vec4(newVel,1);
}`;

/* ── FBO position shader ── */
const POS_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tTexture, tOriginalTexture, tVelocity;
uniform float uTime, uNormalizedDelta;
uniform float uRadius, uDecay, uDecay2, uLerpSpeed, uLerpSpeed2;
uniform float uShapeThreshold, uSetup;
uniform float uClickPulse, uPulse;
uniform float uPosIntegrate, uSpringK, uCometSpringK, uDecayComet, uPulseAmp;
#define COMET_TH ${C.COMET_RATIO.toFixed(4)}
${NOISE_LIB}
void main(){
  vec4 origFetch=texture2D(tOriginalTexture,vUv);
  vec3 offsets=origFetch.xyz;
  float rIdx=rand(vUv);
  float selected=step(uShapeThreshold,rIdx);
  bool isComet=rIdx>uShapeThreshold && rIdx<(uShapeThreshold+COMET_TH);
  vec4 pos=texture2D(tTexture,vUv);
  vec3 curPos=pos.xyz;
  float life=pos.w;
  vec3 vel=texture2D(tVelocity,vUv).xyz;
  float breathR=uRadius*(1.0+uPulse*uPulseAmp);
  if(uSetup>0.5){
    float shellBias=mix(0.35,1.0,rIdx*rIdx);
    gl_FragColor=vec4(normalize(offsets)*breathR*shellBias,rand(vUv+rIdx+4584.0));
    if(selected>0.5) gl_FragColor.a=origFetch.w;
    return;
  }
  if(life<=0.0){
    if(selected>0.5){
      if(isComet){
        float th=rand(vUv+uTime*0.1)*PI*2.0;
        float ph=acos(rand(vUv+uTime*0.2)*2.0-1.0);
        float rr=breathR*mix(0.3,0.95,rand(vUv+uTime*0.3));
        gl_FragColor=vec4(vec3(sin(ph)*cos(th),sin(ph)*sin(th),cos(ph))*rr,1.0);
      } else {
        gl_FragColor=vec4(offsets,1.0);
      }
    } else {
      vec3 sd=normalize(offsets+vec3(sin(uTime*3.7+rIdx*100.0),cos(uTime*2.3+rIdx*200.0),sin(uTime*1.9+rIdx*300.0))*0.5);
      gl_FragColor=vec4(sd*breathR,1.0);
    }
    return;
  }
  vec3 burst=normalize(curPos+vec3(0.001))*uClickPulse*0.08;
  if(selected>0.5){
    float pR=breathR*mix(0.35,1.0,rIdx*rIdx);
    curPos+=vel*uNormalizedDelta*uPosIntegrate;
    float dist=length(curPos);
    float radialErr=dist-pR;
    float sk=isComet?uCometSpringK:uSpringK;
    curPos-=normalize(curPos+vec3(0.001))*radialErr*uNormalizedDelta*uLerpSpeed*sk;
    curPos+=burst*uNormalizedDelta;
    float dr=isComet?uDecayComet:uDecay;
    life-=dr*uNormalizedDelta*0.008;
  } else {
    curPos+=vel*uNormalizedDelta*uLerpSpeed2;
    life-=uDecay2*uNormalizedDelta*0.008;
  }
  gl_FragColor=vec4(curPos,life);
}`;

/* ── GL_POINTS particle shaders (far-away view) ── */
const PT_VERT = /* glsl */ `
uniform sampler2D tPosition, tVelocity;
uniform float uTime, uDpr, uSize, uShapeThreshold, uClickPulse, uScroll;
uniform vec3 uLightPos, uMouse3D, uCamPos;
uniform float uZoomGrow, uDensityCull, uMouseScrollTh, uHoverScale;
uniform float uPointFade;
attribute vec2 aFboUv;
attribute float aSeed, aScale;
attribute vec3 aRandom;
varying float vLight, vLife, vSeed, vSelected, vRadiusFade, vClickPulse;
varying float vColorClass, vIsComet, vMouseProx;
varying vec3 vNDir;
#define COMET_TH ${C.COMET_RATIO.toFixed(4)}
float rand(vec2 co){return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec4 sim=texture2D(tPosition,aFboUv);
  vec3 pos=sim.xyz; float life=sim.w;
  vec3 vel=texture2D(tVelocity,aFboUv).xyz;
  float rIdx=rand(aFboUv);
  float selected=step(uShapeThreshold,rIdx);
  float isComet=step(uShapeThreshold,rIdx)*step(rIdx,uShapeThreshold+COMET_TH);
  float cc=fract(aSeed*91743.1);
  vColorClass=cc; vIsComet=isComet;
  float sp=uScroll;
  float zoomGrow=mix(1.0,uZoomGrow,sp*sp);

  // depth-based culling: particles closer to camera are hidden first during zoom
  float camDist=length(pos-uCamPos);
  float nearCull=1.0-smoothstep(1.0,3.5,camDist)*sp*0.7;
  float densityCull=step(sp*sp*uDensityCull*nearCull,aRandom.z);

  float scale=uSize*aScale*zoomGrow*densityCull;
  if(isComet>0.5){
    float streak=length(vel)*80.0;
    scale*=mix(0.5,1.2,aRandom.x)*(1.0+min(streak,3.0));
  } else if(selected>0.5){
    if(cc<0.18) scale*=mix(0.5,1.0,aRandom.x);
    else if(cc<0.35) scale*=mix(0.35,0.8,aRandom.x);
    else if(cc<0.52) scale*=mix(0.35,0.8,aRandom.x);
    else if(cc<0.67) scale*=mix(0.4,0.9,aRandom.x);
    else if(cc<0.82) scale*=mix(0.3,0.9,aRandom.x);
    else scale*=mix(0.35,0.85,aRandom.x);
    if(aRandom.z>0.95) scale*=1.8;
  } else {
    scale*=1.3*mix(0.4,1.0,aRandom.y);
  }
  scale*=smoothstep(0.0,0.15,life)*smoothstep(1.0,0.88,life);
  scale*=uPointFade;
  float mDist=length(uMouse3D-pos);
  vMouseProx=smoothstep(0.7,0.02,mDist)*step(uMouseScrollTh,sp);
  if(vMouseProx>0.2) scale*=1.0+vMouseProx*uHoverScale;
  vec4 mv=modelViewMatrix*vec4(pos,1.0);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=max(scale*uDpr/(-mv.z),1.0);
  vec3 nDir=normalize(pos);
  vNDir=nDir;
  vec3 lDir=normalize(uLightPos-pos);
  vLight=max(dot(nDir,lDir),0.0)*0.6+0.4;
  vRadiusFade=selected>0.5?1.0:(1.0-smoothstep(4.5,8.0,length(pos)));
  vLife=life;vSeed=aSeed;vSelected=selected;
  vClickPulse=uClickPulse;
}`;

const PT_FRAG = /* glsl */ `
varying float vLight,vLife,vSeed,vSelected,vRadiusFade,vClickPulse;
varying float vColorClass,vIsComet,vMouseProx;
varying vec3 vNDir;
void main(){
  vec2 pc=gl_PointCoord-0.5;
  float d=length(pc)*2.0;
  if(d>1.0) discard;
  vec3 N=normalize(vec3(pc*2.0,sqrt(max(1.0-d*d,0.0))));
  float diffuse=max(dot(N,normalize(vec3(0.5,0.6,1.0))),0.0)*0.4+0.6;
  float spec=pow(max(dot(N,normalize(vec3(0.3,0.5,0.8))),0.0),20.0);
  float rimGlow=pow(d,3.0)*0.3;
  vec3 baseColor;
  if(vIsComet>0.5){
    baseColor=mix(vec3(1.0,0.97,0.85),vec3(0.6,0.85,1.0),d*0.3);
  } else if(vSelected>0.5){
    if(vColorClass<0.18) baseColor=mix(vec3(1.0,0.98,0.95),vec3(0.88,0.85,0.78),d*0.3);
    else if(vColorClass<0.35) baseColor=mix(vec3(0.98,0.82,0.38),vec3(0.75,0.5,0.12),d*0.35);
    else if(vColorClass<0.52) baseColor=mix(vec3(0.92,0.22,0.18),vec3(0.5,0.08,0.1),d*0.35);
    else if(vColorClass<0.67) baseColor=mix(vec3(0.82,0.9,1.0),vec3(0.5,0.65,0.88),d*0.35);
    else if(vColorClass<0.82) baseColor=mix(vec3(1.0,0.72,0.35),vec3(0.65,0.25,0.08),d*0.35);
    else baseColor=mix(vec3(0.95,0.72,0.75),vec3(0.62,0.3,0.42),d*0.35);
  } else {
    baseColor=mix(vec3(1.0,0.95,0.88),vec3(0.85,0.65,0.4),smoothstep(0.3,1.0,1.0-vLife));
  }
  vec3 color=baseColor*diffuse*vLight+spec*vec3(1.0,0.95,0.9)*0.3+baseColor*rimGlow;
  float alpha=1.0;
  alpha*=vRadiusFade;
  alpha*=smoothstep(0.0,0.1,vLife);
  if(vMouseProx>0.1) color+=vec3(0.3,0.25,0.18)*vMouseProx;
  color+=vec3(0.12,0.06,0.03)*vClickPulse;
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

/**
 * FBOSystem: runs the FBO simulation and renders both GL_POINTS (far) and
 * CelestialBodies InstancedMesh (close). Cross-fades based on scroll.
 */
function FBOSystem() {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const { gl } = useThree();
  const initData = useMemo(createInitData, []);
  const allocs = useMemo<BodyAlloc[]>(() => allocateBodies(), []);

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
        uShapeThreshold: { value: C.SHAPE_THRESHOLD }, uRadius: { value: C.RADIUS }, uSetup: { value: 1 },
        uScroll: { value: 0 }, uMouse3D: { value: new THREE.Vector3() },
        uOrbitMin: { value: C.ORBIT_SPEED[0] }, uOrbitMax: { value: C.ORBIT_SPEED[1] },
        uKeplerExp: { value: C.KEPLER_EXPONENT },
        uCometMin: { value: C.COMET_SPEED[0] }, uCometMax: { value: C.COMET_SPEED[1] },
        uCometKeplerExp: { value: C.COMET_KEPLER_EXPONENT },
        uNoiseStr: { value: C.NOISE_STRENGTH }, uNoiseTimeScale: { value: C.NOISE_TIME_SCALE },
        uRadialRepulse: { value: C.RADIAL_REPULSE }, uOuterPush: { value: C.OUTER_PUSH },
        uMomentumBlend: { value: C.MOMENTUM_BLEND }, uVelRetain: { value: C.VELOCITY_RETAIN },
        uMouseFreezeR: { value: C.MOUSE_FREEZE_RADIUS }, uMouseFreezeStr: { value: C.MOUSE_FREEZE_STRENGTH },
        uMouseAttractBlend: { value: C.MOUSE_ATTRACT_BLEND }, uMouseScrollTh: { value: C.MOUSE_SCROLL_THRESHOLD },
      }, vertexShader: qV, fragmentShader: VEL_FRAG,
    });
    const pM = new THREE.ShaderMaterial({
      uniforms: {
        tTexture: { value: tex }, tOriginalTexture: { value: tex }, tVelocity: { value: null },
        uTime: { value: 0 }, uNormalizedDelta: { value: 1 },
        uRadius: { value: C.RADIUS }, uDecay: { value: C.DECAY_RATE }, uDecay2: { value: C.RADIATION_DECAY },
        uLerpSpeed: { value: C.LERP_SPEED }, uLerpSpeed2: { value: C.LERP_SPEED_RADIATION },
        uShapeThreshold: { value: C.SHAPE_THRESHOLD }, uSetup: { value: 1 },
        uClickPulse: { value: 0 }, uPulse: { value: 0 },
        uPosIntegrate: { value: C.POSITION_INTEGRATE },
        uSpringK: { value: C.SPRING_K }, uCometSpringK: { value: C.COMET_SPRING_K },
        uDecayComet: { value: C.COMET_DECAY_RATE }, uPulseAmp: { value: C.PULSE_AMPLITUDE },
      }, vertexShader: qV, fragmentShader: POS_FRAG,
    });
    const sc = new THREE.Scene(), cm = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    sc.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), vM));
    return { vRT, pRT, vM, pM, sc, cm };
  }, [initData]);

  const ping = useRef({ v: 0, p: 0 });
  const didSetup = useRef(false);

  /* geometry for GL_POINTS */
  const geo = useMemo(() => {
    const u = new Float32Array(COUNT * 2), s = new Float32Array(COUNT);
    const sc = new Float32Array(COUNT), r = new Float32Array(COUNT * 3), p = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      u[i * 2] = (i % TEX) / (TEX - 1);
      u[i * 2 + 1] = Math.floor(i / TEX) / (TEX - 1);
      s[i] = Math.random(); sc[i] = 0.5 + Math.random() * 0.5;
      r[i * 3] = Math.random(); r[i * 3 + 1] = Math.random(); r[i * 3 + 2] = Math.random();
    }
    return { uvs: u, seeds: s, scales: sc, randoms: r, pos0: p };
  }, []);

  const ptMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      tPosition: { value: null }, tVelocity: { value: null }, uTime: { value: 0 },
      uDpr: { value: typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1 },
      uSize: { value: C.PARTICLE_SIZE }, uLightPos: { value: new THREE.Vector3(...C.LIGHT_POS) },
      uShapeThreshold: { value: C.SHAPE_THRESHOLD }, uClickPulse: { value: 0 },
      uScroll: { value: 0 }, uMouse3D: { value: new THREE.Vector3() },
      uZoomGrow: { value: C.ZOOM_GROW_MAX }, uDensityCull: { value: C.ZOOM_DENSITY_CULL },
      uMouseScrollTh: { value: C.MOUSE_SCROLL_THRESHOLD }, uHoverScale: { value: C.HOVER_SCALE_BOOST },
      uPointFade: { value: 1.0 },
      uCamPos: { value: new THREE.Vector3(0, 0, 8) },
    },
    vertexShader: PT_VERT, fragmentShader: PT_FRAG,
    transparent: true, depthTest: true, depthWrite: true,
    blending: THREE.NormalBlending,
  }), []);

  const getPosRT = () => sys.pRT[ping.current.p] ?? null;

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05), nd = dt * 60, t = state.clock.elapsedTime;
    clickPulse.value *= 0.92;
    const pulse = Math.sin(t * C.ORB_PULSE_FREQ) * 0.5 + 0.5;
    const sp = scrollRef.value;
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
    vM.uniforms.uScroll.value = sp;
    vM.uniforms.uMouse3D.value.copy(mouse3D);
    quad.material = vM;
    const nv = 1 - ping.current.v;
    gl.setRenderTarget(vRT[nv]); gl.clear(); gl.render(sc, cm); ping.current.v = nv;

    pM.uniforms.tTexture.value = pRT[ping.current.p].texture;
    pM.uniforms.tVelocity.value = vRT[ping.current.v].texture;
    pM.uniforms.uTime.value = t; pM.uniforms.uNormalizedDelta.value = nd;
    pM.uniforms.uClickPulse.value = clickPulse.value;
    pM.uniforms.uPulse.value = pulse;
    quad.material = pM;
    const np = 1 - ping.current.p;
    gl.setRenderTarget(pRT[np]); gl.clear(); gl.render(sc, cm);
    gl.setRenderTarget(null); ping.current.p = np;

    sharedTime.value = t;

    /* smooth cross-fade: points fade out, 3D bodies fade in */
    const rawT = Math.max(0, Math.min(1, (sp - C.BODY_APPEAR_SCROLL) / (C.BODY_FULL_SCROLL - C.BODY_APPEAR_SCROLL)));
    const bodyT = rawT * rawT * (3 - 2 * rawT);
    const pointFade = 1 - bodyT;

    ptMat.uniforms.tPosition.value = pRT[ping.current.p].texture;
    ptMat.uniforms.tVelocity.value = vRT[ping.current.v].texture;
    ptMat.uniforms.uTime.value = t;
    ptMat.uniforms.uClickPulse.value = clickPulse.value;
    ptMat.uniforms.uScroll.value = sp;
    ptMat.uniforms.uMouse3D.value.copy(mouse3D);
    ptMat.uniforms.uPointFade.value = pointFade;
    ptMat.uniforms.uCamPos.value.copy(state.camera.position);

    if (pointsRef.current) {
      pointsRef.current.visible = pointFade > 0.01;
    }

    if (groupRef.current) {
      groupRef.current.rotation.y += dt * C.GALAXY_ROTATION_SPEED * (1 - sp * 0.7);
    }
  });

  return (
    <group ref={groupRef}>
      {/* GL_POINTS: visible when unzoomed */}
      <points ref={pointsRef} material={ptMat} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[geo.pos0, 3]} />
          <bufferAttribute attach="attributes-aFboUv" args={[geo.uvs, 2]} />
          <bufferAttribute attach="attributes-aSeed" args={[geo.seeds, 1]} />
          <bufferAttribute attach="attributes-aScale" args={[geo.scales, 1]} />
          <bufferAttribute attach="attributes-aRandom" args={[geo.randoms, 3]} />
        </bufferGeometry>
      </points>

      {/* 3D bodies: visible when zoomed in */}
      <CelestialBodiesWrapper
        allocs={allocs}
        posTex={getPosRT}
        gl={gl}
        time={sharedTime}
        scroll={scrollRef}
        mouse={mouse3D}
      />
    </group>
  );
}

function CelestialBodiesWrapper(props: Omit<Parameters<typeof CelestialBodies>[0], "camPos">) {
  const { camera } = useThree();
  return <CelestialBodies {...props} camPos={camera.position} />;
}

function OrbSphere() {
  const ref = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const fadeUni = useMemo(() => ({ value: 1.0 }), []);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uLightPos: { value: new THREE.Vector3(...C.LIGHT_POS) },
      uLightPos2: { value: new THREE.Vector3(-3, -1, 5) },
      uTime: { value: 0 },
      uFade: fadeUni,
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
      uniform vec3 uLightPos,uLightPos2;uniform float uTime,uFade;
      varying vec3 vNormal,vViewDir,vWorldPos;
      void main(){
        if(uFade<0.01) discard;
        vec3 N=normalize(vNormal),V=normalize(vViewDir);
        vec3 L1=normalize(uLightPos-vWorldPos),L2=normalize(uLightPos2-vWorldPos);
        float diff=max(dot(N,L1),0.0);float diff2=max(dot(N,L2),0.0);
        vec3 diffuse=diff*vec3(1.0,0.72,0.58)*0.7+diff2*vec3(0.8,0.6,0.65)*0.2;
        vec3 H=normalize(L1+V);float spec=pow(max(dot(N,H),0.0),50.0)*0.5;
        float fresnel=pow(1.0-max(dot(N,V),0.0),2.8);
        vec3 color=vec3(0.4,0.22,0.18)+diffuse+spec*vec3(1,0.9,0.8)+vec3(1.0,0.88,0.75)*fresnel*0.7;
        color+=vec3(0.9,0.5,0.35)*max(dot(-N,L1),0.0)*0.15;
        gl_FragColor=vec4(color,mix(0.08,0.38,fresnel)*uFade);
      }`,
    transparent: true, depthWrite: false, side: THREE.FrontSide,
  }), [fadeUni]);

  const glowMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide,
    uniforms: { uFade: fadeUni },
    vertexShader: `varying vec3 vN,vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform float uFade;varying vec3 vN,vV;void main(){if(uFade<0.01)discard;float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.0);gl_FragColor=vec4(1.0,0.85,0.7,f*0.2*uFade);}`,
  }), [fadeUni]);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const pulse = 1.0 + Math.sin(t * C.ORB_PULSE_FREQ) * C.ORB_PULSE_AMP;
    const sp = scrollRef.value;
    const vis = Math.max(0, 1 - sp * C.ORB_FADE_SPEED);
    fadeUni.value = vis;
    mat.uniforms.uTime.value = t;
    const sc = pulse * (0.3 + vis * 0.7);
    if (ref.current) { ref.current.scale.setScalar(sc); ref.current.rotation.y = t * C.ORB_ROTATION_SPEED; ref.current.visible = vis > 0.01; }
    if (glowRef.current) { glowRef.current.scale.setScalar(sc * 1.06); glowRef.current.visible = vis > 0.01; }
  });

  return (
    <group>
      <mesh ref={ref} material={mat}><sphereGeometry args={[C.RADIUS, 64, 64]} /></mesh>
      <mesh ref={glowRef} material={glowMat}><sphereGeometry args={[C.RADIUS, 32, 32]} /></mesh>
    </group>
  );
}

function Background() {
  const bg = C.BG_COLORS;
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uScroll: { value: 0 },
      uTL: { value: new THREE.Vector3(...bg.TL) }, uTR: { value: new THREE.Vector3(...bg.TR) },
      uBL: { value: new THREE.Vector3(...bg.BL) }, uBR: { value: new THREE.Vector3(...bg.BR) },
      uDarkMin: { value: C.BG_DARK_MIN },
    },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime,uScroll,uDarkMin;
      uniform vec3 uTL,uTR,uBL,uBR;
      float rand(vec2 co){return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453);}
      void main(){
        vec2 uv=vUv;
        vec3 warmBg=mix(mix(uBL,uBR,uv.x),mix(uTL,uTR,uv.x),uv.y);
        float vig=1.0-smoothstep(0.4,1.4,length((uv-0.5)*vec2(1.6,1.2)));
        warmBg*=mix(0.7,1.0,vig);
        float sp=uScroll;
        float darkT=smoothstep(0.0,0.5,sp);
        vec3 color=warmBg*(1.0-darkT)+vec3(uDarkMin)*darkT;
        float noiseAmt=mix(0.04,0.015,darkT);
        color+=rand(uv*800.0+fract(uTime*0.5))*noiseAmt-noiseAmt*0.5;

        // distant stars appear as background darkens during zoom
        float starVis=smoothstep(0.15,0.5,uScroll);
        if(starVis>0.0){
          for(int i=0;i<3;i++){
            vec2 grid=uv*vec2(40.0+float(i)*20.0,30.0+float(i)*15.0);
            vec2 cell=floor(grid);
            vec2 f=fract(grid);
            float h=rand(cell+float(i)*100.0);
            if(h>0.92){
              vec2 center=vec2(rand(cell+0.1+float(i)*50.0),rand(cell+0.2+float(i)*50.0));
              float d=length(f-center);
              float brightness=rand(cell+0.3+float(i)*50.0);
              float twinkle=0.6+0.4*sin(uTime*(1.5+brightness*3.0)+h*30.0);
              float star=smoothstep(0.08,0.0,d)*brightness*twinkle*starVis;
              vec3 starCol=mix(vec3(1.0,0.95,0.85),vec3(0.8,0.88,1.0),brightness);
              color+=starCol*star*0.6;
            }
          }
        }

        gl_FragColor=vec4(color,1.0);
      }`,
    depthTest: false, depthWrite: false,
  }), [bg]);
  useFrame((s) => { mat.uniforms.uTime.value = s.clock.elapsedTime; mat.uniforms.uScroll.value = scrollRef.value; });
  return <mesh renderOrder={-1} material={mat}><planeGeometry args={[2, 2]} /></mesh>;
}

function Interaction() {
  const { camera, gl } = useThree();
  const rc = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const tgt = useRef({ x: 0, y: 0 }), cur = useRef({ x: 0, y: 0 });
  const screenMouse = useRef({ x: 0, y: 0 });
  const stableTime = useRef(0);
  const hoverShown = useRef(false);
  const hoverIdx = useRef(-1);

  const getIdx = () => Math.floor(Math.abs(
    Math.sin(mouse3D.x * 73.1 + mouse3D.y * 137.3 + mouse3D.z * 211.7)
  ) * COUNT) % COUNT;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const nx = e.clientX / window.innerWidth, ny = e.clientY / window.innerHeight;
      ndcMouseRC.set(nx * 2 - 1, -(ny * 2 - 1));
      tgt.current.x = (nx - 0.5) * 2; tgt.current.y = -(ny - 0.5) * 2;
      const dx = e.clientX - screenMouse.current.x;
      const dy = e.clientY - screenMouse.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > C.HOVER_MOVE_THRESHOLD) {
        stableTime.current = 0;
        if (hoverShown.current) {
          hoverShown.current = false; hoverIdx.current = -1;
          document.body.style.cursor = "default"; hoverCb.fn?.(null);
        }
      }
      screenMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onClick = (e: MouseEvent) => {
      if (scrollRef.value < C.MOUSE_SCROLL_THRESHOLD || !starClickCb.fn) return;
      if (!hoverShown.current || hoverIdx.current < 0) return;
      clickPulse.value = 0.5;
      starClickCb.fn(hoverIdx.current, e.clientX, e.clientY);
    };
    window.addEventListener("mousemove", onMove);
    gl.domElement.addEventListener("click", onClick);
    return () => { window.removeEventListener("mousemove", onMove); gl.domElement.removeEventListener("click", onClick); };
  }, [gl, camera]);

  useFrame((_, delta) => {
    const p = scrollRef.value;
    const ps = 1 - p * 0.85;
    cur.current.x += (tgt.current.x - cur.current.x) * C.PARALLAX_LERP;
    cur.current.y += (tgt.current.y - cur.current.y) * C.PARALLAX_LERP;
    camera.position.x = cur.current.x * C.PARALLAX_X * ps;
    camera.position.y = cur.current.y * C.PARALLAX_Y * ps + 0.2 * (1 - p);
    camera.lookAt(0, 0, 0);
    rc.setFromCamera(ndcMouseRC, camera);
    rc.ray.intersectPlane(plane, mouse3D);
    if (p > C.MOUSE_SCROLL_THRESHOLD) {
      const dist = mouse3D.length();
      const inRange = dist < C.RADIUS * 1.3;
      if (inRange) {
        document.body.style.cursor = "pointer";
        if (!hoverShown.current) {
          stableTime.current += delta;
          if (stableTime.current > C.HOVER_DWELL_TIME) {
            hoverShown.current = true; hoverIdx.current = getIdx();
            hoverCb.fn?.({ idx: hoverIdx.current, x: screenMouse.current.x, y: screenMouse.current.y });
          }
        }
      } else {
        stableTime.current = 0;
        if (hoverShown.current) { hoverShown.current = false; hoverIdx.current = -1; hoverCb.fn?.(null); }
        document.body.style.cursor = "default";
      }
    } else {
      if (hoverShown.current) { hoverShown.current = false; hoverIdx.current = -1; hoverCb.fn?.(null); }
      document.body.style.cursor = "default";
    }
  });
  return null;
}

function ScrollZoom() {
  const { camera } = useThree();
  useFrame(() => {
    const p = scrollRef.value;
    const ease = p * p * (3 - 2 * p);
    camera.position.z = C.CAMERA_INITIAL[2] - (C.CAMERA_INITIAL[2] - C.CAMERA_ZOOM_Z) * ease;
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = C.CAMERA_FOV + ease * C.CAMERA_ZOOM_FOV_ADD;
    cam.updateProjectionMatrix();
  });
  return null;
}

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.4} color="#ffeedd" />
      <directionalLight position={[5, 4, 8]} intensity={1.2} color="#fff5ee" />
      <directionalLight position={[-3, -1, 5]} intensity={0.4} color="#ddc8cc" />
    </>
  );
}

export interface BlackHoleSceneProps {
  onStarClick?: (idx: number, x: number, y: number) => void;
  onStarHover?: (info: { idx: number; x: number; y: number } | null) => void;
  scrollProgress?: number;
}

export function BlackHoleScene({ onStarClick, onStarHover, scrollProgress = 0 }: BlackHoleSceneProps) {
  scrollRef.value = scrollProgress;
  starClickCb.fn = onStarClick ?? null;
  hoverCb.fn = onStarHover ?? null;
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: C.CAMERA_INITIAL as unknown as THREE.Vector3Tuple, fov: C.CAMERA_FOV }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.3 }}>
        <SceneLights />
        <Background /><Interaction /><ScrollZoom /><OrbSphere /><FBOSystem />
      </Canvas>
    </div>
  );
}
