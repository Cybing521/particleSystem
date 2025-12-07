# GLB 模型生成流水线集成方案

## 概述

本文档描述如何将在线 GLB/GLTF 模型生成服务集成到粒子系统中，通过 MCP（Model Context Protocol）实现自动化流水线。

## 在线 GLB 生成服务

### 1. 推荐服务

#### a) **Three.js GLTF Exporter** (本地)
- **优点**: 完全控制，无需网络
- **实现**: 使用 `three/examples/jsm/exporters/GLTFExporter.js`
- **适用场景**: 从代码生成简单几何体

#### b) **ModelFormatConvert API**
- **URL**: https://modelformatconvert.com
- **功能**: 支持多种格式转换（OBJ → GLB, FBX → GLB等）
- **API**: 需要检查是否提供REST API

#### c) **Meshy AI**
- **URL**: https://www.meshy.ai
- **功能**: AI驱动的3D模型生成和转换
- **特点**: 支持文本到3D、图片到3D

#### d) **GLTF/GLB 在线编辑器**
- **URL**: https://www.mvrlink.com
- **功能**: 在线预览、编辑、动画查看

### 2. 程序化生成方案

#### 方案A: 使用 Three.js GLTFExporter（推荐）

```javascript
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

class GLBGenerator {
    constructor() {
        this.exporter = new GLTFExporter();
    }
    
    /**
     * 从几何体生成GLB
     */
    async generateFromGeometry(geometry, material, options = {}) {
        const scene = new THREE.Scene();
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        
        return new Promise((resolve, reject) => {
            this.exporter.parse(
                scene,
                (result) => {
                    const blob = new Blob([result], { type: 'application/octet-stream' });
                    const url = URL.createObjectURL(blob);
                    resolve(url);
                },
                { binary: true, ...options }
            );
        });
    }
    
    /**
     * 从形状参数生成GLB
     */
    async generateShape(shapeType, params) {
        let geometry;
        switch(shapeType) {
            case 'sphere':
                geometry = new THREE.SphereGeometry(params.radius || 1, 32, 32);
                break;
            case 'heart':
                geometry = this.createHeartGeometry(params);
                break;
            case 'torus':
                geometry = new THREE.TorusGeometry(params.radius || 1, params.tube || 0.3, 16, 100);
                break;
            // 更多形状...
        }
        
        const material = new THREE.MeshStandardMaterial({ color: params.color || 0xffffff });
        return this.generateFromGeometry(geometry, material);
    }
    
    /**
     * 创建心形几何体
     */
    createHeartGeometry(params = {}) {
        const scale = params.scale || 1;
        const shape = new THREE.Shape();
        
        // 心形路径
        const t = 0;
        const x = 16 * Math.pow(Math.sin(t), 3) * scale * 0.1;
        const y = (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) * scale * 0.1;
        
        // 使用LatheGeometry创建3D心形
        const points = [];
        for (let i = 0; i <= 50; i++) {
            const t = (i / 50) * Math.PI * 2;
            const x = 16 * Math.pow(Math.sin(t), 3) * scale * 0.1;
            const y = (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) * scale * 0.1;
            points.push(new THREE.Vector2(x, y));
        }
        
        return new THREE.LatheGeometry(points, 32);
    }
}
```

#### 方案B: MCP 集成架构

```javascript
// services/GLBGenerationService.js
export class GLBGenerationService {
    constructor() {
        this.generator = new GLBGenerator();
        this.cache = new Map(); // 缓存生成的模型
    }
    
    /**
     * 通过MCP协议生成GLB模型
     */
    async generateViaMCP(shapeType, params) {
        const cacheKey = `${shapeType}_${JSON.stringify(params)}`;
        
        // 检查缓存
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        // 生成模型
        const glbUrl = await this.generator.generateShape(shapeType, params);
        
        // 缓存结果
        this.cache.set(cacheKey, glbUrl);
        
        return glbUrl;
    }
    
    /**
     * 从在线服务获取模型（如果服务提供API）
     */
    async fetchFromOnlineService(serviceName, params) {
        // 实现API调用逻辑
        // 例如：POST到Meshy AI API
    }
}
```

### 3. 集成到粒子系统

```javascript
// 在 ParticleSystem.js 中添加
import { GLBGenerationService } from '../services/GLBGenerationService.js';

export class ParticleSystem {
    constructor(scene) {
        // ... 现有代码 ...
        this.glbGenerationService = new GLBGenerationService();
    }
    
    /**
     * 动态生成形状并加载
     */
    async generateAndLoadShape(shapeType, params) {
        try {
            const glbUrl = await this.glbGenerationService.generateViaMCP(shapeType, params);
            this.loadModel(glbUrl);
        } catch (error) {
            console.error('Failed to generate GLB:', error);
            // Fallback to built-in shape
            this.setShape(shapeType);
        }
    }
}
```

## MCP 流水线架构

### 1. 工作流程

```
用户请求 → MCP服务 → 形状生成器 → GLB导出 → 粒子系统加载
                ↓
            缓存检查
                ↓
            在线服务（可选）
```

### 2. 实现步骤

1. **创建 GLBGenerationService**
   - 封装 Three.js GLTFExporter
   - 实现形状生成逻辑
   - 添加缓存机制

2. **集成到 UI**
   - 添加"生成模型"按钮
   - 参数输入界面
   - 预览功能

3. **优化性能**
   - Web Worker 中生成（避免阻塞主线程）
   - 模型缓存
   - 渐进式加载

## 推荐的实现方案

### 短期方案（立即可用）
使用 **Three.js GLTFExporter** 在客户端生成：
- ✅ 无需网络请求
- ✅ 完全控制
- ✅ 快速响应
- ✅ 支持自定义形状

### 长期方案（扩展性）
集成在线服务 API：
- 使用 Meshy AI 进行复杂模型生成
- 使用 ModelFormatConvert 进行格式转换
- 实现服务降级机制

## 代码示例：完整集成

```javascript
// src/services/GLBGenerationService.js
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as THREE from 'three';

export class GLBGenerationService {
    constructor() {
        this.exporter = new GLTFExporter();
        this.cache = new Map();
    }
    
    async generateShape(shapeType, params = {}) {
        const cacheKey = `${shapeType}_${JSON.stringify(params)}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        const geometry = this.createGeometry(shapeType, params);
        const material = new THREE.MeshStandardMaterial({ 
            color: params.color || 0xffffff 
        });
        
        const scene = new THREE.Scene();
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        
        return new Promise((resolve, reject) => {
            this.exporter.parse(
                scene,
                (result) => {
                    const blob = new Blob([result], { type: 'application/octet-stream' });
                    const url = URL.createObjectURL(blob);
                    this.cache.set(cacheKey, url);
                    resolve(url);
                },
                { binary: true }
            );
        });
    }
    
    createGeometry(shapeType, params) {
        // 实现各种形状的几何体生成
        // ...
    }
}
```

## 注意事项

1. **性能**: GLB生成是CPU密集型操作，考虑使用Web Worker
2. **内存**: 生成的模型会占用内存，需要及时清理
3. **兼容性**: 确保浏览器支持Blob和URL.createObjectURL
4. **错误处理**: 实现完善的错误处理和降级方案

## 未来扩展

- [ ] 支持在线服务API集成
- [ ] 实现Web Worker版本
- [ ] 添加模型预览功能
- [ ] 支持批量生成
- [ ] 实现模型编辑功能





