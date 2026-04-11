# 3D 天体模型系统改造

## 上下文
将原有 GL_POINTS 粒子系统替换为多种 3D 天体模型（InstancedMesh），保留 FBO 位置/速度模拟。

## 架构
- `scene-config.ts` — 新增 `BODY_TYPES` 配置（7种天体比例和大小范围）
- `celestial-bodies.tsx` — 新文件：粒子分配、7种天体的 InstancedMesh 渲染、CPU端FBO读取桥接
- `black-hole-scene.tsx` — 移除 `<points>` 和 PT_VERT/PT_FRAG，改用 `<CelestialBodies>` + 场景灯光

## 天体类型
| 类型 | 比例 | 几何体 | 材质 |
|------|------|--------|------|
| 恒星 Star | 5% | SphereGeo | MeshBasicMaterial（脉冲发光） |
| 黑洞 BlackHole | 5% | SphereGeo + TorusGeo吸积盘 | 黑色球 + 橙红旋转环 |
| 行星 Planet | 35% | SphereGeo | MeshStandardMaterial（4子类颜色） |
| 环形行星 RingPlanet | 10% | SphereGeo + RingGeo | 土星样式半透明环 |
| 陨石 Asteroid | 25% | IcosahedronGeo（顶点扰动） | 灰褐色粗糙 |
| 卫星 Satellite | 5% | Box + 两片太阳能板 | 金属银色 |
| 彗星 Comet | 15% | SphereGeo | 蓝白发光 |

## 关键设计
- FBO 模拟层完全保留（VEL_FRAG/POS_FRAG 不变）
- 每帧单次 `readRenderTargetPixels` → 共享给所有 BodyGroup
- 密度裁剪：CPU 端 `scale=0` 隐藏
- Draw calls = 7 主体 + 2 环（黑洞+土星） = 9 次

## 状态
- [x] 完成所有实现
- [x] TypeScript 编译通过
- [x] Dev server 运行正常
