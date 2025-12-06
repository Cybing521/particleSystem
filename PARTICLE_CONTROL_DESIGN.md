# 粒子移动控制与"北冥有鱼"效果设计文档

## 概述

本文档描述两种粒子系统增强功能的实现方案：
1. **第三视角粒子控制** - 用户可控制部分粒子，周围有随机移动的粒子（熵增效果）
2. **"北冥有鱼"效果** - 模拟生物群落的动态行为，粒子形成有机的、流动的形态

---

## 一、第三视角粒子控制系统

### 1.1 核心概念

**设计理念**：
- 用户控制的粒子群：可响应手势/鼠标，形成"可控区域"
- 环境粒子：随机移动，遵循物理规律（熵增），不受直接控制
- 交互边界：可控粒子与环境粒子之间存在动态边界和相互作用

### 1.2 视觉效果

```
┌─────────────────────────────────┐
│                                 │
│   🌌 环境粒子（随机、熵增）      │
│   ═══ 边界区域（渐变过渡）       │
│   ✨ 可控粒子群（响应手势）      │
│   ═══ 边界区域（渐变过渡）       │
│   🌌 环境粒子（随机、熵增）      │
│                                 │
└─────────────────────────────────┘
```

**视觉特征**：
- **可控粒子群**：
  - 颜色：更亮、更饱和（如金色、蓝色）
  - 大小：略大于环境粒子
  - 运动：平滑、有方向性
  - 聚集度：可形成紧密的群体形态

- **环境粒子**：
  - 颜色：较暗、低饱和度（灰色调）
  - 大小：标准大小
  - 运动：随机布朗运动 + 轻微重力
  - 分布：均匀或轻微聚集

- **边界区域**：
  - 渐变过渡：颜色和大小在边界处平滑过渡
  - 相互作用：可控粒子可"推开"环境粒子
  - 动态变化：边界随可控粒子的移动而变化

### 1.3 交互方式

#### 手势控制（主要）
- **左手位置** → 控制可控粒子群的中心位置
- **右手捏合** → 控制可控粒子群的聚集度（捏合=聚集，张开=分散）
- **手部旋转** → 控制可控粒子群的旋转方向

#### 鼠标控制（备选）
- **鼠标位置** → 控制可控粒子群的中心位置
- **鼠标拖拽** → 控制可控粒子群的移动方向
- **滚轮** → 控制可控粒子群的聚集度

### 1.4 技术实现方案

#### 粒子分类系统
```javascript
// 粒子类型
const PARTICLE_TYPES = {
    CONTROLLED: 'controlled',    // 可控粒子（20-30%）
    ENVIRONMENT: 'environment'   // 环境粒子（70-80%）
};
```

#### 可控粒子行为
```javascript
// 可控粒子跟随目标位置（手势/鼠标）
controlledParticle.target = gesturePosition;
controlledParticle.velocity = lerp(
    currentVelocity,
    directionToTarget * speed,
    smoothness
);

// 聚集度控制（基于捏合状态）
const cohesion = 1.0 - gestureState; // 0.0=分散, 1.0=聚集
controlledParticle.cohesionForce = calculateCohesion(
    nearbyControlledParticles,
    cohesion
);
```

#### 环境粒子行为
```javascript
// 随机布朗运动（熵增）
environmentParticle.velocity += randomDirection() * randomness;
environmentParticle.velocity *= damping; // 能量衰减

// 轻微重力
environmentParticle.velocity.y += gravity;

// 避免与可控粒子碰撞
const avoidanceForce = calculateAvoidance(
    environmentParticle,
    nearbyControlledParticles
);
environmentParticle.velocity += avoidanceForce;
```

#### 边界交互
```javascript
// 可控粒子推开环境粒子
function applyRepulsion(controlledParticle, environmentParticle) {
    const distance = getDistance(controlledParticle, environmentParticle);
    if (distance < repulsionRadius) {
        const force = repulsionStrength / (distance * distance);
        const direction = normalize(environmentParticle.pos - controlledParticle.pos);
        environmentParticle.velocity += direction * force;
    }
}
```

### 1.5 参数配置

```javascript
const CONTROL_CONFIG = {
    // 粒子比例
    controlledRatio: 0.25,        // 25% 可控粒子
    environmentRatio: 0.75,       // 75% 环境粒子
    
    // 可控粒子参数
    controlledSpeed: 0.05,        // 跟随速度
    controlledCohesion: 0.3,      // 聚集强度
    controlledSeparation: 0.2,   // 分离强度
    controlledAlignment: 0.1,    // 对齐强度
    
    // 环境粒子参数
    environmentRandomness: 0.01,  // 随机性
    environmentDamping: 0.98,    // 阻尼系数
    environmentGravity: -0.0003, // 重力
    
    // 交互参数
    repulsionRadius: 1.5,        // 排斥半径
    repulsionStrength: 0.001,    // 排斥强度
    boundaryBlend: 0.5           // 边界混合度
};
```

---

## 二、"北冥有鱼"效果

### 2.1 核心概念

**设计理念**：
- **生物群落模拟**：粒子形成类似鱼群、鸟群的有机形态
- **流动感**：粒子群像水中的鱼群，流畅、有机地移动
- **自组织行为**：粒子通过简单的规则产生复杂的群体行为
- **有机形态**：粒子群形成不规则的、变化的形状（如鱼、云、龙等）

### 2.2 视觉效果

**形态特征**：
- **鱼群形态**：
  - 长条形、流线型
  - 头部密集，尾部逐渐稀疏
  - 整体呈现"S"形或波浪形
  - 颜色渐变（头部亮，尾部暗）

- **云朵形态**：
  - 蓬松、不规则
  - 边缘模糊、柔和
  - 内部密度变化
  - 缓慢流动、变形

- **龙形形态**：
  - 蜿蜒、曲折
  - 头部明显，身体连贯
  - 动态摆动
  - 跟随手势移动

### 2.3 行为规则（Boids算法变体）

#### 基础规则
```javascript
// 1. 分离（Separation）- 避免碰撞
function separation(particle, neighbors) {
    let steer = new Vector3(0, 0, 0);
    let count = 0;
    
    neighbors.forEach(neighbor => {
        const distance = particle.position.distanceTo(neighbor.position);
        if (distance > 0 && distance < desiredSeparation) {
            const diff = particle.position.clone().sub(neighbor.position);
            diff.normalize();
            diff.divideScalar(distance); // 距离越近，影响越大
            steer.add(diff);
            count++;
        }
    });
    
    if (count > 0) {
        steer.divideScalar(count);
        steer.normalize();
        steer.multiplyScalar(maxSpeed);
        steer.sub(particle.velocity);
        steer.limit(maxForce);
    }
    
    return steer;
}

// 2. 对齐（Alignment）- 与邻居方向一致
function alignment(particle, neighbors) {
    let sum = new Vector3(0, 0, 0);
    let count = 0;
    
    neighbors.forEach(neighbor => {
        const distance = particle.position.distanceTo(neighbor.position);
        if (distance > 0 && distance < neighborRadius) {
            sum.add(neighbor.velocity);
            count++;
        }
    });
    
    if (count > 0) {
        sum.divideScalar(count);
        sum.normalize();
        sum.multiplyScalar(maxSpeed);
        const steer = sum.sub(particle.velocity);
        steer.limit(maxForce);
        return steer;
    }
    
    return new Vector3(0, 0, 0);
}

// 3. 聚集（Cohesion）- 向邻居中心移动
function cohesion(particle, neighbors) {
    let sum = new Vector3(0, 0, 0);
    let count = 0;
    
    neighbors.forEach(neighbor => {
        const distance = particle.position.distanceTo(neighbor.position);
        if (distance > 0 && distance < neighborRadius) {
            sum.add(neighbor.position);
            count++;
        }
    });
    
    if (count > 0) {
        sum.divideScalar(count);
        return seek(particle, sum);
    }
    
    return new Vector3(0, 0, 0);
}
```

#### 高级行为
```javascript
// 4. 跟随目标（Follow Target）- 跟随手势/鼠标
function followTarget(particle, target) {
    return seek(particle, target);
}

// 5. 边界避免（Boundary Avoidance）
function avoidBoundaries(particle, boundaries) {
    let steer = new Vector3(0, 0, 0);
    
    boundaries.forEach(boundary => {
        const distance = particle.position.distanceTo(boundary);
        if (distance < boundaryRadius) {
            const diff = particle.position.clone().sub(boundary);
            diff.normalize();
            diff.multiplyScalar(avoidanceStrength);
            steer.add(diff);
        }
    });
    
    return steer;
}

// 6. 流动感（Flow）- 添加轻微的旋转和波动
function applyFlow(particle, time) {
    const flowStrength = 0.02;
    const flowFrequency = 0.5;
    
    // 垂直波动
    const wave = Math.sin(time * flowFrequency + particle.id * 0.1) * flowStrength;
    particle.velocity.y += wave;
    
    // 轻微旋转
    const rotation = Math.cos(time * flowFrequency * 0.5 + particle.id * 0.05) * flowStrength * 0.5;
    particle.velocity.x += rotation;
    particle.velocity.z += rotation;
}
```

### 2.4 形态生成

#### 鱼群形态
```javascript
function createFishFormation(particles, targetPosition) {
    const headParticles = particles.slice(0, particles.length * 0.2);
    const bodyParticles = particles.slice(
        particles.length * 0.2,
        particles.length * 0.8
    );
    const tailParticles = particles.slice(particles.length * 0.8);
    
    // 头部：紧密聚集
    headParticles.forEach((particle, index) => {
        const angle = (index / headParticles.length) * Math.PI * 2;
        const radius = 0.3;
        particle.targetPosition = targetPosition.clone().add(
            new Vector3(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius * 0.5,
                0
            )
        );
    });
    
    // 身体：流线型排列
    bodyParticles.forEach((particle, index) => {
        const progress = index / bodyParticles.length;
        const offset = new Vector3(
            -progress * 2, // 向后延伸
            Math.sin(progress * Math.PI * 2) * 0.5, // S形波动
            0
        );
        particle.targetPosition = targetPosition.clone().add(offset);
    });
    
    // 尾部：逐渐稀疏
    tailParticles.forEach((particle, index) => {
        const progress = index / tailParticles.length;
        const tailLength = 1.5;
        const spread = progress * 0.8;
        particle.targetPosition = targetPosition.clone().add(
            new Vector3(
                -tailLength - progress * 0.5,
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread
            )
        );
    });
}
```

#### 颜色渐变
```javascript
function updateFishColors(particles) {
    particles.forEach((particle, index) => {
        const progress = index / particles.length;
        
        // 头部：亮色（金色/蓝色）
        // 尾部：暗色（深灰）
        const headColor = new Color(0xffd700); // 金色
        const tailColor = new Color(0x333333); // 深灰
        
        particle.color.lerpColors(headColor, tailColor, progress);
        
        // 头部更亮
        const brightness = 1.0 - progress * 0.5;
        particle.color.multiplyScalar(brightness);
    });
}
```

### 2.5 手势交互

#### 手势映射
```javascript
const GESTURE_MAPPING = {
    // 左手：控制"鱼群"位置
    leftHandPosition: 'fishPosition',
    
    // 右手捏合：控制"鱼群"大小/密度
    rightHandPinch: 'fishDensity', // 捏合=密集，张开=分散
    
    // 手部旋转：控制"鱼群"方向
    handRotation: 'fishDirection',
    
    // 手指数量：切换形态（1指=鱼群，2指=云朵，3指=龙形）
    fingerCount: 'formationType'
};
```

### 2.6 参数配置

```javascript
const FISH_FORMATION_CONFIG = {
    // Boids 参数
    separationWeight: 1.5,      // 分离权重
    alignmentWeight: 1.0,       // 对齐权重
    cohesionWeight: 1.0,        // 聚集权重
    targetWeight: 2.0,          // 目标跟随权重
    
    // 距离参数
    desiredSeparation: 0.5,     // 期望分离距离
    neighborRadius: 2.0,        // 邻居检测半径
    boundaryRadius: 5.0,        // 边界检测半径
    
    // 速度参数
    maxSpeed: 0.1,              // 最大速度
    maxForce: 0.05,             // 最大力
    minSpeed: 0.02,             // 最小速度
    
    // 形态参数
    headDensity: 0.3,           // 头部密度
    bodyLength: 2.0,            // 身体长度
    tailSpread: 0.8,            // 尾部扩散
    
    // 流动参数
    flowStrength: 0.02,         // 流动强度
    flowFrequency: 0.5,         // 流动频率
    waveAmplitude: 0.5          // 波动幅度
};
```

---

## 三、实现优先级

### 阶段一：基础粒子分类（1-2天）
1. ✅ 实现粒子分类系统（可控/环境）
2. ✅ 实现基础的可控粒子跟随
3. ✅ 实现环境粒子的随机运动
4. ✅ 添加视觉区分（颜色、大小）

### 阶段二：交互与控制（2-3天）
1. ✅ 实现手势控制可控粒子群
2. ✅ 实现聚集度控制（捏合）
3. ✅ 实现边界交互（排斥力）
4. ✅ 优化平滑过渡

### 阶段三："北冥有鱼"效果（3-4天）
1. ✅ 实现 Boids 算法基础（分离、对齐、聚集）
2. ✅ 实现形态生成（鱼群、云朵、龙形）
3. ✅ 实现颜色渐变
4. ✅ 实现流动感效果

### 阶段四：优化与增强（2-3天）
1. ✅ 性能优化（空间分区、LOD）
2. ✅ 视觉效果增强（轨迹、光晕）
3. ✅ 参数调优
4. ✅ UI 控制面板

---

## 四、技术难点与解决方案

### 4.1 性能优化

**问题**：大量粒子的邻居检测计算量大

**解决方案**：
- 使用空间分区（Spatial Partitioning）
- 限制邻居检测数量（最多检测 N 个最近邻居）
- 使用 Web Workers 进行并行计算
- 实现 LOD（Level of Detail）：远距离粒子简化计算

### 4.2 平滑过渡

**问题**：可控粒子与环境粒子之间的视觉过渡

**解决方案**：
- 使用距离衰减函数
- 在边界区域混合两种粒子的属性
- 使用渐变着色器

### 4.3 形态稳定性

**问题**："北冥有鱼"形态容易散开

**解决方案**：
- 增加聚集权重
- 添加"锚点"粒子（固定位置）
- 使用约束力保持形态

---

## 五、预期效果

### 5.1 第三视角控制

**用户体验**：
- 用户通过手势控制一部分粒子，形成"可控区域"
- 周围的环境粒子随机移动，形成自然的背景
- 可控粒子与环境粒子之间存在动态交互
- 整体效果：用户像是在"指挥"粒子群，而周围的环境保持自然的随机性

### 5.2 "北冥有鱼"

**用户体验**：
- 粒子形成有机的、流动的形态（如鱼群、云朵）
- 形态跟随手势移动，保持整体性
- 粒子之间有自然的"群体智能"行为
- 整体效果：像在控制一个活生生的生物群落

---

## 六、扩展方向

1. **多种形态**：除了鱼群，还可以实现鸟群、云朵、龙形等
2. **环境交互**：粒子与环境中的"障碍物"交互
3. **多群体**：同时存在多个可控粒子群
4. **物理模拟**：添加更真实的物理效果（流体、碰撞）
5. **音效反馈**：根据粒子运动生成音效

---

## 总结

这两种效果将为粒子系统带来全新的交互体验：
- **第三视角控制**：提供精确的控制感和自然的背景
- **"北冥有鱼"**：创造有机的、流动的视觉体验

两者可以结合使用，也可以独立实现。建议先实现第三视角控制（相对简单），再实现"北冥有鱼"效果（更复杂但视觉效果更震撼）。

