import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ParticleControlMode } from './ParticleControlMode.js';
import { TextParticleGenerator } from '../utils/TextParticleGenerator.js';
import { CanvasTextParticleGenerator } from '../utils/CanvasTextParticleGenerator.js';
import { ChineseCharacterStrokes } from '../utils/ChineseCharacterStrokes.js';
import { TextParticleEffect } from '../effects/TextParticleEffect.js';

/**
 * 粒子系统类
 * 管理粒子的创建、更新、形状变换、颜色设置和模型加载
 * 支持多种形状、物理效果和自适应性能优化
 * 
 * @class ParticleSystem
 */
export class ParticleSystem {
    /**
     * 创建 ParticleSystem 实例
     * @param {THREE.Scene} scene - Three.js 场景对象
     */
    constructor(scene) {
        this.scene = scene;
        this.particles = null;
        this.baseCount = 3000; // 基础粒子数量（降低初始数量以提升性能）
        this.count = 3000; // 当前粒子数量（会根据性能动态调整）
        this.minVisibleCount = 2000; // 最小可见粒子数量（防止粒子过少）
        this.geometry = null;
        this.material = null;
        
        // Particle velocities for free diffusion
        this.velocities = new Float32Array(this.count * 3);
        
        // Particle physics properties
        this.masses = new Float32Array(this.count); // Particle masses
        
        // Visual effects properties
        this.particleSizes = new Float32Array(this.count); // Dynamic particle sizes
        this.baseSize = 0.04; // Base particle size (increased for better visibility)
        this.sizeVariation = 0.03; // Size variation based on velocity (increased)
        this.trailEnabled = false; // Trail effect (can be enabled if needed)
        
        // Current shape tracking
        this.currentShape = 'sphere'; // Track current shape for UI sync
        this.shapeChangeCallback = null;
        
        // Text input mode tracking
        this.textInputMode = false; // 文本输入模式状态
        this.textInputModeCallback = null; // 文本输入模式切换回调
        
        // Gesture state tracking for shape switching
        this.fingerCountHistory = []; // Track finger count changes (for 5→0→5 detection)
        this.handMovementDirection = new THREE.Vector3(0, 0, 0); // Hand movement direction for 5-finger drag
        this.lastHandPosition = { x: 0.5, y: 0.5 }; // Last hand position for movement calculation
        
        // Color and opacity
        this.baseOpacity = 0.8; // Base opacity (0.0 to 1.0)
        
        // Distribution mode
        this.distributionMode = 'uniform'; // 'uniform', 'random', 'clustered'
        
        // Gesture control service reference (set externally)
        this.gestureControlService = null;
        
        // Particle control mode (normal, boids)
        this.controlMode = null;
        this.currentMode = 'normal'; // 'normal', 'boids'
        
        // Diffusion parameters
        this.diffusionSpeed = 0.02; // Base speed of particle movement
        this.attractionStrength = 0.003; // Strength of attraction to target shape (提升3倍以加快转换速度)
        this.randomness = 0.005; // Random movement component
        
        // Physics parameters
        this.gravity = -0.0005; // Gravity strength (negative = downward)
        this.forceFieldStrength = 0.0002; // Force field strength
        this.forceFieldRadius = 2.0; // Force field radius
        this.forceFieldCenter = new THREE.Vector3(0, 0, 0); // Force field center
        this.forceFieldType = 'attract'; // 'attract' or 'repel'

        // 内存优化：性能监控和自适应调整
        this.fpsHistory = [];
        this.fpsHistorySize = 30;
        this.lastFrameTime = performance.now();
        this.targetFPS = 30;
        this.adaptiveUpdateInterval = 60;
        this.frameCounter = 0;
        this.minParticleCount = 1000; // 最小粒子数
        this.maxParticleCount = 10000; // 最大粒子数
        this.particleCountSteps = [1000, 2000, 3000, 5000, 7000, 10000]; // 粒子数量等级

        // 对象池：重用数组（预分配最大尺寸）
        this.positionPool = null;
        this.velocityPool = null;
        this.colorPool = null;
        this.maxPoolSize = this.maxParticleCount;

        // 文本粒子生成器
        this.textParticleGenerator = new TextParticleGenerator();

        // Canvas文本粒子生成器（支持中文）
        this.canvasTextParticleGenerator = new CanvasTextParticleGenerator();

        // 中文字符笔画数据库
        this.chineseCharacterStrokes = ChineseCharacterStrokes;

        // 文本粒子特效
        this.textParticleEffect = null;

        this.init();
    }

    init() {
        this.createParticleSystem(this.count);
        // 初始化控制模式
        this.controlMode = new ParticleControlMode(this);
    }

        // 创建粒子系统（支持动态调整）
    createParticleSystem(count) {
        // 如果已存在，先移除旧的
        if (this.particles) {
            this.scene.remove(this.particles);
            this.geometry.dispose();
            this.material.dispose();
        }

        this.count = count;
        this.geometry = new THREE.BufferGeometry();
        
        // 对象池：预分配最大尺寸的数组，重用以减少内存分配
        // 如果对象池不存在或太小，创建/扩展它
        if (!this.positionPool || this.positionPool.length < this.maxPoolSize * 3) {
            this.positionPool = new Float32Array(this.maxPoolSize * 3);
            this.velocityPool = new Float32Array(this.maxPoolSize * 3);
            this.colorPool = new Float32Array(this.maxPoolSize * 3);
        }
        
        // 创建新数组，但重用对象池的buffer以减少内存碎片
        // 对于当前count，创建新的Float32Array视图
        this.initialPositions = new Float32Array(count * 3);
        this.targetPositions = new Float32Array(count * 3);
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        
        // 重用velocity pool（如果大小足够）
        if (this.velocities && this.velocities.length >= count * 3) {
            // 重用现有数组
            this.velocities = this.velocities.subarray(0, count * 3);
        } else {
            // 创建新数组
            this.velocities = new Float32Array(count * 3);
        }
        
        // Initialize physics properties arrays
        if (!this.masses || this.masses.length < count) {
            this.masses = new Float32Array(count);
        } else {
            this.masses = this.masses.subarray(0, count);
        }
        
        // Initialize particle sizes array
        if (!this.particleSizes || this.particleSizes.length < count) {
            this.particleSizes = new Float32Array(count);
        } else {
            this.particleSizes = this.particleSizes.subarray(0, count);
        }

        const color = new THREE.Color();
        // Default to a very dark grey/black for contrast against white
        this.baseColor = new THREE.Color(0x222222);

        // Initialize with Sphere
        this.calculateShapePositions('sphere', this.initialPositions);
        this.calculateShapePositions('sphere', this.targetPositions);

        // Copy to current positions
        for (let i = 0; i < count * 3; i++) {
            positions[i] = this.initialPositions[i];
        }

        // Initialize velocities with random directions
        for (let i = 0; i < count; i++) {
            // Random velocity direction
            const speed = this.diffusionSpeed * (0.5 + Math.random() * 0.5);
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            this.velocities[i * 3] = speed * Math.sin(phi) * Math.cos(theta);
            this.velocities[i * 3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
            this.velocities[i * 3 + 2] = speed * Math.cos(phi);
            
            // Initialize physics properties
            this.masses[i] = 0.5 + Math.random() * 0.5; // Random mass between 0.5 and 1.0
            
            this.updateParticleColor(color, i);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        // Initialize particle sizes
        for (let i = 0; i < count; i++) {
            this.particleSizes[i] = this.baseSize;
        }

        const sprite = new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/disc.png');

        this.material = new THREE.PointsMaterial({
            size: this.baseSize, // Base size, will be updated dynamically
            sizeAttenuation: true, // Enable size attenuation for depth
            vertexColors: true,
            map: sprite,
            // Normal blending works better for dark particles on white background
            blending: THREE.NormalBlending,
            depthWrite: false,
            transparent: true,
            opacity: this.baseOpacity, // Use baseOpacity
            // Enable size variation per particle (requires custom shader, but we'll update size dynamically)
        });

        this.particles = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.particles);
    }

    calculateShapePositions(shape, array) {
        for (let i = 0; i < this.count; i++) {
            let x, y, z;
            
            // Apply distribution mode
            let randomFactor = 1.0;
            if (this.distributionMode === 'random') {
                randomFactor = 0.5 + Math.random() * 1.5; // 0.5 to 2.0
            } else if (this.distributionMode === 'clustered') {
                // Create clusters: use a few random centers
                const clusterCenters = 5;
                const clusterIndex = Math.floor(Math.random() * clusterCenters);
                const clusterOffset = (Math.random() - 0.5) * 0.3; // Small offset for clustering
                randomFactor = 0.7 + clusterOffset;
            }

            if (shape === 'sphere') {
                const r = 2 * Math.cbrt(Math.random()) * randomFactor;
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos(2 * Math.random() - 1);
                x = r * Math.sin(phi) * Math.cos(theta);
                y = r * Math.sin(phi) * Math.sin(theta);
                z = r * Math.cos(phi);
            } else if (shape === 'torus') {
                const u = Math.random() * Math.PI * 2;
                const v = Math.random() * Math.PI * 2;
                const R = 1.5 * randomFactor;
                const r = 0.5 * randomFactor;
                x = (R + r * Math.cos(v)) * Math.cos(u);
                y = (R + r * Math.cos(v)) * Math.sin(u);
                z = r * Math.sin(v);
                // Add some volume
                const volumeFactor = this.distributionMode === 'clustered' ? 0.15 : 0.2;
                x += (Math.random() - 0.5) * volumeFactor;
                y += (Math.random() - 0.5) * volumeFactor;
                z += (Math.random() - 0.5) * volumeFactor;
            } else if (shape === 'heart') {
                // Heart shape with 3D volume filling for a solid, dispersed heart
                // Use a combination of parametric surface and volume filling
                const t = Math.random() * Math.PI * 2;
                const scale = 0.15 * randomFactor; // Slightly larger scale for better visibility
                
                // Heart parametric equations (standard heart curve)
                const heartX = 16 * Math.pow(Math.sin(t), 3);
                const heartY = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
                
                // Create 3D volume by adding radial offset from the heart surface
                // This creates a solid heart instead of just a surface
                const radialOffset = Math.random(); // 0 to 1, controls distance from surface
                const volumeRadius = 0.4; // Maximum distance from surface for volume filling
                
                // Calculate surface normal direction (simplified)
                const angle = Math.random() * Math.PI * 2; // Random angle around the surface
                const offsetX = Math.cos(angle) * radialOffset * volumeRadius;
                const offsetY = Math.sin(angle) * radialOffset * volumeRadius;
                const offsetZ = (Math.random() - 0.5) * volumeRadius * 0.6; // Z-axis volume
                
                // Apply volume offset to create solid heart
                x = scale * heartX + offsetX;
                y = scale * heartY + offsetY;
                z = offsetZ;
                
                // Add additional random dispersion for more natural, less dense distribution
                const dispersionFactor = this.distributionMode === 'clustered' ? 0.08 : 0.12;
                x += (Math.random() - 0.5) * dispersionFactor;
                y += (Math.random() - 0.5) * dispersionFactor;
                z += (Math.random() - 0.5) * dispersionFactor * 0.8;
            } else if (shape === 'number1' || shape === 'number2' || shape === 'number3') {
                // 3D数字形状
                const number = shape === 'number1' ? 1 : (shape === 'number2' ? 2 : 3);
                const numResult = { x: 0, y: 0, z: 0 };
                this.calculateNumberShape(number, i, numResult, randomFactor);
                x = numResult.x;
                y = numResult.y;
                z = numResult.z;
            } else if (shape.startsWith('text:')) {
                // 文本形状（格式：text:lxq）
                const text = shape.substring(5); // 移除 "text:" 前缀
                const textResult = { x: 0, y: 0, z: 0 };
                this.calculateTextShape(text, i, textResult, randomFactor);
                x = textResult.x;
                y = textResult.y;
                z = textResult.z;
            } else {
                // Default to sphere if unknown shape
                const r = 2 * Math.cbrt(Math.random()) * randomFactor;
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos(2 * Math.random() - 1);
                x = r * Math.sin(phi) * Math.cos(theta);
                y = r * Math.sin(phi) * Math.sin(theta);
                z = r * Math.cos(phi);
            }

            array[i * 3] = x;
            array[i * 3 + 1] = y;
            array[i * 3 + 2] = z;
        }
    }
    
    /**
     * 计算3D数字形状的粒子位置
     * @param {number} number - 数字 (1, 2, 或 3)
     * @param {number} particleIndex - 粒子索引
     * @param {Object} result - 结果对象 {x, y, z}
     * @param {number} randomFactor - 随机因子
     */
    calculateNumberShape(number, particleIndex, result, randomFactor) {
        const scale = 1.2 * randomFactor; // 稍微增大数字尺寸
        const thickness = 0.25; // 数字的厚度（稍微减小以更清晰）
        const lineWidth = 0.15; // 线条宽度
        
        // 使用更均匀的分布方式，确保数字各部分都有足够的粒子
        const progress = particleIndex / this.count;
        
        let numX = 0, numY = 0, numZ = 0;
        
        if (number === 1) {
            // 数字1：一条竖线，顶部有短斜线，底部有短横线
            if (progress < 0.05) {
                // 顶部短斜线（左上到右上）
                const topProgress = progress / 0.05;
                numX = -0.3 + topProgress * 0.3; // 从 -0.3 到 0
                numY = 1.0 + (Math.random() - 0.5) * 0.08; // 固定在顶部
                numZ = (Math.random() - 0.5) * thickness;
            } else if (progress < 0.85) {
                // 主体竖线（垂直，占据大部分粒子）
                const mainProgress = (progress - 0.05) / 0.8;
                numX = (Math.random() - 0.5) * lineWidth; // 竖线宽度
                numY = 0.9 - mainProgress * 1.8; // 从 0.9 到 -0.9
                numZ = (Math.random() - 0.5) * thickness;
            } else {
                // 底部短横线
                const botProgress = (progress - 0.85) / 0.15;
                numX = -0.2 + botProgress * 0.4; // 从 -0.2 到 0.2
                numY = -0.9 + (Math.random() - 0.5) * 0.08; // 固定在底部
                numZ = (Math.random() - 0.5) * thickness;
            }
        } else if (number === 2) {
            // 数字2：顶部向右弧线 + 中间向左下斜线 + 底部向右弧线
            if (progress < 0.3) {
                // 顶部弧线（向右上方弯曲，从左上到右上）
                const topProgress = progress / 0.3;
                // 使用更平滑的贝塞尔曲线效果
                const t = topProgress;
                const startX = -0.7, startY = 0.8;
                const endX = 0.3, endY = 0.6;
                const controlX = 0.0, controlY = 1.0; // 控制点使曲线向上弯曲
                
                // 二次贝塞尔曲线
                numX = (1-t)*(1-t)*startX + 2*(1-t)*t*controlX + t*t*endX;
                numY = (1-t)*(1-t)*startY + 2*(1-t)*t*controlY + t*t*endY;
                numX += (Math.random() - 0.5) * lineWidth;
                numY += (Math.random() - 0.5) * lineWidth;
                numZ = (Math.random() - 0.5) * thickness;
            } else if (progress < 0.6) {
                // 中间斜线（从左下到右下，形成"2"的中间部分）
                const midProgress = (progress - 0.3) / 0.3;
                numX = 0.3 - midProgress * 1.2; // 从 0.3 到 -0.9
                numY = 0.6 - midProgress * 0.8; // 从 0.6 到 -0.2
                numX += (Math.random() - 0.5) * lineWidth;
                numY += (Math.random() - 0.5) * lineWidth;
                numZ = (Math.random() - 0.5) * thickness;
            } else {
                // 底部弧线（向右下方弯曲，从左下到右下）
                const botProgress = (progress - 0.6) / 0.4;
                const t = botProgress;
                const startX = -0.9, startY = -0.2;
                const endX = 0.2, endY = -0.8;
                const controlX = 0.0, controlY = -0.5; // 控制点使曲线向下弯曲
                
                // 二次贝塞尔曲线
                numX = (1-t)*(1-t)*startX + 2*(1-t)*t*controlX + t*t*endX;
                numY = (1-t)*(1-t)*startY + 2*(1-t)*t*controlY + t*t*endY;
                numX += (Math.random() - 0.5) * lineWidth;
                numY += (Math.random() - 0.5) * lineWidth;
                numZ = (Math.random() - 0.5) * thickness;
            }
        } else if (number === 3) {
            // 数字3：标准的数字3形状
            // 由三个部分组成：上半圆、中间横线、下半圆

            const segment = Math.floor(progress * 3); // 分为3段
            const segmentProgress = (progress * 3) % 1;
            const t = segmentProgress;

            if (segment === 0) {
                // 上半部分：类似数字2的上半部分，但是反向的
                // 从右上到左中
                const startX = 0.5, startY = 0.8;
                const endX = -0.3, endY = 0.1;
                const controlX = 0.6, controlY = 0.4;

                numX = (1-t)*(1-t)*startX + 2*(1-t)*t*controlX + t*t*endX;
                numY = (1-t)*(1-t)*startY + 2*(1-t)*t*controlY + t*t*endY;

            } else if (segment === 1) {
                // 中间部分：横线
                const startX = -0.3, startY = 0.1;
                const endX = 0.5, endY = 0.1;

                numX = startX + (endX - startX) * t;
                numY = startY + (endY - startY) * t;

            } else {
                // 下半部分：从左中到右下
                const startX = -0.3, startY = -0.1;
                const endX = 0.5, endY = -0.8;
                const controlX = 0.6, controlY = -0.4;

                numX = (1-t)*(1-t)*startX + 2*(1-t)*t*controlX + t*t*endX;
                numY = (1-t)*(1-t)*startY + 2*(1-t)*t*controlY + t*t*endY;
            }

            numX += (Math.random() - 0.5) * lineWidth;
            numY += (Math.random() - 0.5) * lineWidth;
            numZ = (Math.random() - 0.5) * thickness;
        }
        
        // 添加少量随机偏移使数字更自然（减少随机性以保持清晰度）
        numX += (Math.random() - 0.5) * 0.02;
        numY += (Math.random() - 0.5) * 0.02;
        numZ += (Math.random() - 0.5) * 0.015;
        
        // 通过修改对象属性的方式返回结果
        result.x = numX * scale;
        result.y = numY * scale;
        result.z = numZ * scale;
    }

    /**
     * 计算文本形状的粒子位置（使用优化的文本粒子生成器）
     * @param {string} text - 要显示的文本（如 "lxq"）
     * @param {number} particleIndex - 粒子索引
     * @param {Object} result - 结果对象 {x, y, z}
     * @param {number} randomFactor - 随机因子
     */
    calculateTextShape(text, particleIndex, result, randomFactor) {
        const scale = 0.8 * randomFactor;
        let position;

        // 检测是否包含中文字符
        const hasChinese = /[\u4e00-\u9fff]/.test(text);

        if (hasChinese) {
            // 使用Canvas文本生成器处理中文
            position = this.canvasTextParticleGenerator.generateTextParticle(
                text,
                this.count,
                particleIndex
            );
        } else {
            // 使用原始生成器处理英文和数字
            position = this.textParticleGenerator.generateTextParticle(
                text,
                this.count,
                particleIndex
            );
        }

        // 应用缩放和随机偏移
        result.x = position.x * scale;
        result.y = position.y * scale;
        result.z = position.z * scale;

        // 添加额外的随机效果以增加自然度
        const offset = hasChinese ? 0.02 : this.textParticleGenerator.config.randomOffset;
        result.x += (Math.random() - 0.5) * offset;
        result.y += (Math.random() - 0.5) * offset;
        result.z += (Math.random() - 0.5) * offset;
    }
    
    /**
     * 计算单个字母的形状
     * @param {string} letter - 字母
     * @param {number} progress - 在该字母内的进度 (0-1)
     * @param {number} lineWidth - 线条宽度
     * @param {number} thickness - 厚度
     * @returns {Object} {x, y, z} 局部坐标
     */
    calculateLetterShape(letter, progress, lineWidth, thickness) {
        let x = 0, y = 0, z = 0;
        
        switch(letter) {
            case 'l':
                // L: 竖线 + 底部横线
                if (progress < 0.7) {
                    const vertProgress = progress / 0.7;
                    x = (Math.random() - 0.5) * lineWidth;
                    y = 0.8 - vertProgress * 1.6;
                    z = (Math.random() - 0.5) * thickness;
                } else {
                    const horzProgress = (progress - 0.7) / 0.3;
                    x = -0.4 + horzProgress * 0.8;
                    y = -0.8 + (Math.random() - 0.5) * lineWidth;
                    z = (Math.random() - 0.5) * thickness;
                }
                break;
                
            case 'x':
                // X: 两条交叉的对角线
                if (progress < 0.5) {
                    const diag1Progress = progress / 0.5;
                    x = -0.4 + diag1Progress * 0.8;
                    y = 0.8 - diag1Progress * 1.6;
                    x += (Math.random() - 0.5) * lineWidth;
                    y += (Math.random() - 0.5) * lineWidth;
                    z = (Math.random() - 0.5) * thickness;
                } else {
                    const diag2Progress = (progress - 0.5) / 0.5;
                    x = 0.4 - diag2Progress * 0.8;
                    y = 0.8 - diag2Progress * 1.6;
                    x += (Math.random() - 0.5) * lineWidth;
                    y += (Math.random() - 0.5) * lineWidth;
                    z = (Math.random() - 0.5) * thickness;
                }
                break;
                
            case 'q':
                // Q: 圆形 + 右下角斜线
                if (progress < 0.85) {
                    const circleProgress = progress / 0.85;
                    const angle = circleProgress * Math.PI * 2;
                    const radius = 0.4;
                    x = Math.cos(angle) * radius;
                    y = Math.sin(angle) * radius;
                    x += (Math.random() - 0.5) * lineWidth;
                    y += (Math.random() - 0.5) * lineWidth;
                    z = (Math.random() - 0.5) * thickness;
                } else {
                    const lineProgress = (progress - 0.85) / 0.15;
                    x = 0.3 + lineProgress * 0.3;
                    y = -0.3 - lineProgress * 0.3;
                    x += (Math.random() - 0.5) * lineWidth;
                    y += (Math.random() - 0.5) * lineWidth;
                    z = (Math.random() - 0.5) * thickness;
                }
                break;
                
            default:
                // 未知字母，使用默认形状
                x = (Math.random() - 0.5) * 0.2;
                y = (Math.random() - 0.5) * 0.2;
                z = (Math.random() - 0.5) * thickness;
        }
        
        // 添加少量随机偏移
        x += (Math.random() - 0.5) * 0.02;
        y += (Math.random() - 0.5) * 0.02;
        z += (Math.random() - 0.5) * 0.015;
        
        return { x, y, z };
    }

    setShape(shape) {
        // Only update if shape actually changed
        if (shape !== this.currentShape) {
            this.currentShape = shape;
            this.calculateShapePositions(shape, this.targetPositions);

            // 如果是文本形状，初始化特效系统
            if (shape.startsWith('text:') && !this.textParticleEffect) {
                this.textParticleEffect = new TextParticleEffect(this);
            } else if (!shape.startsWith('text:') && this.textParticleEffect) {
                this.textParticleEffect = null;
            }

            // 如果是文本形状，创建出现动画
            if (shape.startsWith('text:') && this.textParticleEffect) {
                const text = shape.substring(5);
                this.textParticleEffect.createTextAppearAnimation(text, 1500);
            }

            // Notify callback if shape changed
            if (this.shapeChangeCallback) {
                this.shapeChangeCallback(shape);
            }

            // Add some initial velocity boost when shape changes for more dynamic effect
            for (let i = 0; i < this.count; i++) {
                const idx = i * 3;
                const boost = 0.03;
                this.velocities[idx] += (Math.random() - 0.5) * boost;
                this.velocities[idx + 1] += (Math.random() - 0.5) * boost;
                this.velocities[idx + 2] += (Math.random() - 0.5) * boost;
            }
        }
    }
    
    /**
     * 循环切换形状（用于五根手指关闭再打开的手势）
     * 只在基础形状之间切换，不包括数字形状
     */
    cycleShape() {
        const shapes = ['sphere', 'heart', 'torus'];
        // 如果当前是数字形状，切换到第一个基础形状
        if (this.currentShape.startsWith('number')) {
            this.setShape('sphere');
        } else {
            const currentIndex = shapes.indexOf(this.currentShape);
            const nextIndex = (currentIndex + 1) % shapes.length;
            this.setShape(shapes[nextIndex]);
        }
    }
    
    setShapeChangeCallback(callback) {
        this.shapeChangeCallback = callback;
    }
    
    getCurrentShape() {
        return this.currentShape;
    }
    
    /**
     * 设置文本输入模式
     * @param {boolean} enabled - 是否启用文本输入模式
     */
    setTextInputMode(enabled) {
        if (this.textInputMode !== enabled) {
            this.textInputMode = enabled;
            // 通知回调
            if (this.textInputModeCallback) {
                this.textInputModeCallback(enabled);
            }
        }
    }
    
    /**
     * 获取文本输入模式状态
     * @returns {boolean} 是否处于文本输入模式
     */
    getTextInputMode() {
        return this.textInputMode;
    }
    
    /**
     * 设置文本输入模式切换回调
     * @param {Function} callback - 回调函数，接收 (enabled) 参数
     */
    setTextInputModeCallback(callback) {
        this.textInputModeCallback = callback;
    }

    /**
     * 设置文本特效
     * @param {string} effectName - 特效名称 ('wave', 'glow', 'dissolve', 'rotate', 'pulse')
     * @param {boolean} enabled - 是否启用
     * @param {Object} params - 特效参数
     */
    setTextEffect(effectName, enabled, params = {}) {
        if (this.textParticleEffect) {
            this.textParticleEffect.setEffect(effectName, enabled, params);
        }
    }

    /**
     * 启用所有文本特效
     */
    enableAllTextEffects() {
        if (this.textParticleEffect) {
            this.textParticleEffect.enableAllEffects();
        }
    }

    /**
     * 禁用所有文本特效
     */
    disableAllTextEffects() {
        if (this.textParticleEffect) {
            this.textParticleEffect.disableAllEffects();
        }
    }

    /**
     * 创建文本闪烁效果
     * @param {number} count - 闪烁次数
     * @param {number} interval - 闪烁间隔（毫秒）
     */
    createTextBlinkEffect(count = 3, interval = 500) {
        if (this.textParticleEffect) {
            this.textParticleEffect.createTextBlinkEffect(count, interval);
        }
    }

    setColor(hexColor, opacity = null) {
        this.baseColor.set(hexColor);
        if (opacity !== null) {
            this.baseOpacity = Math.max(0, Math.min(1, opacity));
            this.material.opacity = this.baseOpacity;
        }
        const colors = this.geometry.attributes.color.array;
        const color = new THREE.Color();

        for (let i = 0; i < this.count; i++) {
            this.updateParticleColor(color, i);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        this.geometry.attributes.color.needsUpdate = true;
    }
    
    setOpacity(opacity) {
        this.baseOpacity = Math.max(0, Math.min(1, opacity));
        this.material.opacity = this.baseOpacity;
    }
    
    getOpacity() {
        return this.baseOpacity;
    }
    
    setParticleCount(count) {
        const newCount = Math.max(this.minParticleCount, Math.min(this.maxParticleCount, Math.floor(count)));
        if (newCount !== this.count) {
            this.createParticleSystem(newCount);
        }
    }
    
    getParticleCount() {
        return this.count;
    }
    
    /**
     * 设置分布模式
     * @param {string} mode - 分布模式 ('uniform', 'random', 'clustered')
     */
    setDistributionMode(mode) {
        if (['uniform', 'random', 'clustered'].includes(mode)) {
            this.distributionMode = mode;
            // Recalculate positions with new distribution
            this.calculateShapePositions(this.currentShape, this.targetPositions);
        }
    }
    
    getDistributionMode() {
        return this.distributionMode;
    }
    
    /**
     * 设置控制模式
     * @param {string} mode - 模式 ('normal', 'boids')
     */
    setControlMode(mode) {
        console.log('[ParticleSystem] Setting control mode to:', mode);
        this.currentMode = mode;
        if (this.controlMode) {
            this.controlMode.setMode(mode);
        } else {
            console.warn('[ParticleSystem] controlMode is null, initializing...');
            this.controlMode = new ParticleControlMode(this);
            this.controlMode.setMode(mode);
        }
    }
    
    /**
     * 设置控制目标（用于boids模式）
     * @param {THREE.Vector3} target - 目标位置
     */
    setControlTarget(target) {
        if (this.controlMode) {
            this.controlMode.setControlTarget(target);
        }
    }
    
    setGestureControlService(service) {
        this.gestureControlService = service;
    }

    updateParticleColor(colorObj, index) {
        colorObj.copy(this.baseColor);
        // Very subtle variation
        const hsl = {};
        colorObj.getHSL(hsl);
        colorObj.setHSL(hsl.h, hsl.s, hsl.l + (Math.random() * 0.1 - 0.05));
    }

    loadModel(url) {
        const loader = new GLTFLoader();
        loader.load(url, (gltf) => {
            let mesh = null;
            gltf.scene.traverse((child) => {
                if (child.isMesh && !mesh) {
                    mesh = child;
                }
            });

            if (mesh) {
                // Sample points from mesh geometry
                const geometry = mesh.geometry;
                geometry.computeBoundingBox();
                const center = new THREE.Vector3();
                geometry.boundingBox.getCenter(center);
                geometry.center(); // Center the geometry

                const posAttribute = geometry.attributes.position;
                const vertexCount = posAttribute.count;

                for (let i = 0; i < this.count; i++) {
                    // Randomly sample vertices
                    const index = Math.floor(Math.random() * vertexCount);

                    // Scale up slightly if model is too small
                    const scale = 2.0;

                    this.targetPositions[i * 3] = posAttribute.getX(index) * scale;
                    this.targetPositions[i * 3 + 1] = posAttribute.getY(index) * scale;
                    this.targetPositions[i * 3 + 2] = posAttribute.getZ(index) * scale;
                }
            }
        });
    }

    update(time, leftHand = null, rightHand = null) {
        if (this.particles) {
            // 内存优化：性能监控和自适应粒子数量调整
            const currentTime = performance.now();
            const deltaTime = currentTime - this.lastFrameTime;
            const currentFPS = deltaTime > 0 ? 1000 / deltaTime : 60;
            this.lastFrameTime = currentTime;
            
            // 更新FPS历史记录
            this.fpsHistory.push(currentFPS);
            if (this.fpsHistory.length > this.fpsHistorySize) {
                this.fpsHistory.shift();
            }
            
            // 每N帧更新一次自适应参数
            this.frameCounter++;
            if (this.frameCounter >= this.adaptiveUpdateInterval) {
                this.updateAdaptiveParticleCount();
                this.frameCounter = 0;
            }
            
            // 手势控制：检测五根手指关闭再打开切换形状
            const currentHand = rightHand || leftHand;
            const currentFingers = currentHand ? currentHand.fingers : 0;
            
            // 跟踪手指数量变化历史（用于检测关闭再打开）
            this.fingerCountHistory.push(currentFingers);
            if (this.fingerCountHistory.length > 30) { // 保留最近30帧
                this.fingerCountHistory.shift();
            }
            
            // 检测从5指→0指→5指的模式（关闭再打开）
            if (this.fingerCountHistory.length >= 20) {
                const recent = this.fingerCountHistory.slice(-20);
                // 检查是否有5→0→5的模式
                let found5 = false, found0 = false, found5Again = false;
                for (let i = 0; i < recent.length; i++) {
                    if (recent[i] === 5 && !found5) {
                        found5 = true;
                    } else if (found5 && recent[i] === 0 && !found0) {
                        found0 = true;
                    } else if (found0 && recent[i] === 5 && !found5Again) {
                        found5Again = true;
                        // 检测到关闭再打开
                        if (this.textInputMode) {
                            // 如果处于文本输入模式，切换文本输入模式（关闭）
                            this.setTextInputMode(false);
                        } else {
                            // 否则切换形状（保持原有功能）
                            this.cycleShape();
                        }
                        // 清空历史避免重复触发
                        this.fingerCountHistory = [];
                        break;
                    }
                }
            }
            
            // 手势1,2,3显示3D数字（只在右手检测到时触发，且形状手势启用时）
            // 使用更稳定的检测算法：需要连续多帧确认才切换
            if (rightHand && (!this.gestureControlService || this.gestureControlService.isGestureEnabled('shape'))) {
                const rightFingers = rightHand.fingers;
                
                // 跟踪数字手势历史，需要连续确认才切换
                if (!this.numberGestureHistory) {
                    this.numberGestureHistory = [];
                }
                this.numberGestureHistory.push(rightFingers);
                if (this.numberGestureHistory.length > 15) {
                    this.numberGestureHistory.shift();
                }
                
                // 检查最近15帧中是否有稳定的数字手势（至少12帧一致）
                if (this.numberGestureHistory.length >= 15) {
                    const recent = this.numberGestureHistory.slice(-15);
                    const fingerCounts = {};
                    recent.forEach(count => {
                        fingerCounts[count] = (fingerCounts[count] || 0) + 1;
                    });
                    
                    // 找到出现次数最多的手指数量（至少12次）
                    let stableFingers = null;
                    let maxCount = 0;
                    for (const [count, occurrences] of Object.entries(fingerCounts)) {
                        if (occurrences >= 12 && occurrences > maxCount) {
                            maxCount = occurrences;
                            stableFingers = parseInt(count);
                        }
                    }
                    
                    // 只有在检测到稳定的1、2、3指手势时才切换
                    if (stableFingers === 1 && this.currentShape !== 'number1') {
                        this.setShape('number1');
                        this.numberGestureHistory = []; // 清空历史避免重复触发
                    } else if (stableFingers === 2 && this.currentShape !== 'number2') {
                        this.setShape('number2');
                        this.numberGestureHistory = []; // 清空历史避免重复触发
                    } else if (stableFingers === 3 && this.currentShape !== 'number3') {
                        this.setShape('number3');
                        this.numberGestureHistory = []; // 清空历史避免重复触发
                    }
                }
            } else {
                // 没有右手或手势禁用时，清空历史
                if (this.numberGestureHistory) {
                    this.numberGestureHistory = [];
                }
            }
            
            // 五根手指张开时移动控制粒子方向（使用右手，如果右手不存在则使用左手）
            // 实现上下左右移动控制
            const moveHand = rightHand || leftHand;
            if (moveHand && moveHand.fingers === 5) {
                // 初始化最后位置（如果还没有设置）
                if (this.lastHandPosition.x === 0.5 && this.lastHandPosition.y === 0.5 && 
                    (moveHand.position.x !== 0.5 || moveHand.position.y !== 0.5)) {
                    this.lastHandPosition.x = moveHand.position.x;
                    this.lastHandPosition.y = moveHand.position.y;
                }
                
                // 计算手部移动方向（每帧都计算，确保实时响应）
                const dx = moveHand.position.x - this.lastHandPosition.x;
                const dy = moveHand.position.y - this.lastHandPosition.y;
                
                // 检查是否有明显移动（降低阈值以提高灵敏度）
                const moveThreshold = 0.0003; // 进一步降低阈值，提高灵敏度
                if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {
                    // 更新移动方向向量（映射到3D空间）
                    // 使用更大的缩放系数，使移动效果更明显
                    const movementScale = 100; // 增加移动效果灵敏度
                    this.handMovementDirection.set(
                        dx * movementScale, // X轴：左右移动（正数向右，负数向左）
                        -dy * movementScale, // Y轴：上下移动（反转Y轴，正数向上，负数向下）
                        0 // Z轴：暂时不控制深度移动
                    );
                } else {
                    // 移动太小，逐渐衰减（减慢衰减速度以保持移动惯性）
                    this.handMovementDirection.multiplyScalar(0.9); // 减慢衰减，保持移动惯性
                }
                
                // 更新最后位置（每帧都更新，确保连续移动检测）
                this.lastHandPosition.x = moveHand.position.x;
                this.lastHandPosition.y = moveHand.position.y;
            } else {
                // 手指不是5根时，快速衰减移动方向
                this.handMovementDirection.multiplyScalar(0.5); // 加快衰减速度
            }
            
            // 更新控制目标（用于boids模式）
            if (this.currentMode === 'boids') {
                // 确保controlMode已初始化
                if (!this.controlMode) {
                    this.controlMode = new ParticleControlMode(this);
                }
                
                // 将手势位置映射到3D空间
                if (leftHand) {
                    // 使用左手位置控制目标
                    const targetX = (leftHand.position.x - 0.5) * 5;
                    const targetY = (0.5 - leftHand.position.y) * 5; // 反转Y轴
                    const targetZ = 0;
                    this.controlMode.setControlTarget(new THREE.Vector3(targetX, targetY, targetZ));
                } else if (rightHand) {
                    // 使用右手位置控制目标
                    const targetX = (rightHand.position.x - 0.5) * 5;
                    const targetY = (0.5 - rightHand.position.y) * 5;
                    const targetZ = 0;
                    this.controlMode.setControlTarget(new THREE.Vector3(targetX, targetY, targetZ));
                }
                // 无手检测时，保持当前目标位置（不更新目标，让粒子继续跟随之前的目标）
            }
            
            // Dual hand control: Left hand controls position and rotation, Right hand controls scale
            let targetRotY, targetRotX, targetRotZ;
            let targetScale;
            
            if (leftHand && rightHand) {
                // Both hands detected - use dual hand control
                // Left hand: position and rotation
                targetRotY = (leftHand.position.x - 0.5) * Math.PI * 1.5;
                targetRotX = (leftHand.position.y - 0.5) * Math.PI * 1.5;
                targetRotZ = leftHand.rotationZ * Math.PI;
                
                // Right hand: scale (调整缩放范围：0.3 到 3.0)
                targetScale = 0.5 + (rightHand.gestureState * 2.7); // 0.3 to 3.0
            } else if (leftHand) {
                // Only left hand detected - use for rotation, default scale
                targetRotY = (leftHand.position.x - 0.5) * Math.PI * 1.5;
                targetRotX = (leftHand.position.y - 0.5) * Math.PI * 1.5;
                targetRotZ = leftHand.rotationZ * Math.PI;
                targetScale = 0.5; // Default scale
            } else if (rightHand) {
                // Only right hand detected - keep current rotation, only apply scale
                targetRotY = this.particles.rotation.y;
                targetRotX = this.particles.rotation.x;
                targetRotZ = this.particles.rotation.z;
                targetScale = 0.3 + (rightHand.gestureState * 2.7); // 0.3 to 3.0
            } else {
                // No hands detected - maintain current rotation and scale
                targetRotY = this.particles.rotation.y;
                targetRotX = this.particles.rotation.x;
                targetRotZ = this.particles.rotation.z;
                targetScale = this.particles.scale.x;
            }

            // Smooth rotation (降低灵敏度：从0.1/0.12降到0.06/0.08)
            // Check if rotation gesture is enabled
            if (!this.gestureControlService || this.gestureControlService.isGestureEnabled('rotation')) {
                this.particles.rotation.y += (targetRotY - this.particles.rotation.y) * 0.06;
                this.particles.rotation.x += (targetRotX - this.particles.rotation.x) * 0.06;
                this.particles.rotation.z += (targetRotZ - this.particles.rotation.z) * 0.08;
            }

            // Auto rotation if no hand detected
            if (!leftHand && !rightHand) {
                this.particles.rotation.y += 0.002;
            }

            // 移除breathing效果以避免闪烁，使用固定值
            this.material.opacity = this.baseOpacity;

            // Free diffusion with attraction to target shape + Physics
            const positions = this.geometry.attributes.position.array;
            const colors = this.geometry.attributes.color.array;
            const actualDeltaTime = 0.016; // Approximate frame time (60fps)
            
            // 性能优化：根据模式选择不同的更新方式
            if (this.currentMode === 'boids') {
                // 确保controlMode已初始化
                if (!this.controlMode) {
                    console.warn('[ParticleSystem] controlMode not initialized, creating now...');
                    this.controlMode = new ParticleControlMode(this);
                }
                
                // Boids模式
                this.controlMode.updateBoidsMode(positions, this.velocities, actualDeltaTime);
                
                // 更新位置（带边界限制）
                const boundaryRadius = this.controlMode.boidsConfig.boundaryRadius;
                for (let i = 0; i < this.count; i++) {
                    const idx = i * 3;
                    positions[idx] += this.velocities[idx] * actualDeltaTime * 60;
                    positions[idx + 1] += this.velocities[idx + 1] * actualDeltaTime * 60;
                    positions[idx + 2] += this.velocities[idx + 2] * actualDeltaTime * 60;
                    
                    // 硬边界：如果超出边界，直接拉回边界内
                    const dist = Math.sqrt(
                        positions[idx] ** 2 + positions[idx + 1] ** 2 + positions[idx + 2] ** 2
                    );
                    if (dist > boundaryRadius) {
                        const scale = boundaryRadius / dist;
                        positions[idx] *= scale;
                        positions[idx + 1] *= scale;
                        positions[idx + 2] *= scale;
                    }
                }
                
                // 更新颜色
                this.controlMode.updateParticleColors(colors);
                this.geometry.attributes.color.needsUpdate = true;
                this.geometry.attributes.position.needsUpdate = true;
                this.material.size = this.baseSize;
                return; // 提前返回，跳过默认更新
            }

            // 默认模式：原有的更新逻辑
            for (let i = 0; i < this.count; i++) {
                const idx = i * 3;
                
                // Removed lifetime-based particle reset - particles now have continuous breathing effect
                
                // Current position
                const px = positions[idx];
                const py = positions[idx + 1];
                const pz = positions[idx + 2];
                
                // Target position
                const tx = this.targetPositions[idx];
                const ty = this.targetPositions[idx + 1];
                const tz = this.targetPositions[idx + 2];
                
                // Calculate direction to target
                const dx = tx - px;
                const dy = ty - py;
                const dz = tz - pz;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                // Attraction force towards target shape
                let attractionX = dist > 0 ? (dx / dist) * this.attractionStrength : 0;
                let attractionY = dist > 0 ? (dy / dist) * this.attractionStrength : 0;
                let attractionZ = dist > 0 ? (dz / dist) * this.attractionStrength : 0;
                
                // 五根手指张开时，添加手部移动方向的力（实现上下左右移动）
                const movementMagnitude = this.handMovementDirection.length();
                if (movementMagnitude > 0.001) {
                    // 使用更大的移动强度，直接添加到速度
                    // 确保上下左右移动都能正确控制粒子
                    const movementStrength = 0.15; // 增加移动强度，使效果更明显
                    
                    // 直接修改速度，使移动更明显
                    // X轴：左右移动（dx为正向右，为负向左）
                    // Y轴：上下移动（dy为正向上，为负向下，已反转）
                    this.velocities[idx] += this.handMovementDirection.x * movementStrength;
                    this.velocities[idx + 1] += this.handMovementDirection.y * movementStrength;
                    this.velocities[idx + 2] += this.handMovementDirection.z * movementStrength;
                }
                
                // Gravity effect (downward force)
                const gravityForce = this.gravity * this.masses[i];
                
                // Force field effect
                const fieldDx = this.forceFieldCenter.x - px;
                const fieldDy = this.forceFieldCenter.y - py;
                const fieldDz = this.forceFieldCenter.z - pz;
                const fieldDist = Math.sqrt(fieldDx * fieldDx + fieldDy * fieldDy + fieldDz * fieldDz);
                
                let forceFieldX = 0, forceFieldY = 0, forceFieldZ = 0;
                if (fieldDist < this.forceFieldRadius && fieldDist > 0.01) {
                    const fieldStrength = this.forceFieldStrength * (1 - fieldDist / this.forceFieldRadius);
                    const direction = this.forceFieldType === 'attract' ? 1 : -1;
                    forceFieldX = (fieldDx / fieldDist) * fieldStrength * direction;
                    forceFieldY = (fieldDy / fieldDist) * fieldStrength * direction;
                    forceFieldZ = (fieldDz / fieldDist) * fieldStrength * direction;
                }
                
                // Update velocity with all forces
                this.velocities[idx] += (attractionX + forceFieldX + (Math.random() - 0.5) * this.randomness) * actualDeltaTime * 60;
                this.velocities[idx + 1] += (attractionY + forceFieldY + gravityForce + (Math.random() - 0.5) * this.randomness) * actualDeltaTime * 60;
                this.velocities[idx + 2] += (attractionZ + forceFieldZ + (Math.random() - 0.5) * this.randomness) * actualDeltaTime * 60;
                
                // Damping to prevent infinite acceleration
                this.velocities[idx] *= 0.98;
                this.velocities[idx + 1] *= 0.98;
                this.velocities[idx + 2] *= 0.98;
                
                // Limit maximum velocity
                const velMag = Math.sqrt(
                    this.velocities[idx] * this.velocities[idx] +
                    this.velocities[idx + 1] * this.velocities[idx + 1] +
                    this.velocities[idx + 2] * this.velocities[idx + 2]
                );
                const maxVel = this.diffusionSpeed * 3;
                if (velMag > maxVel) {
                    const scale = maxVel / velMag;
                    this.velocities[idx] *= scale;
                    this.velocities[idx + 1] *= scale;
                    this.velocities[idx + 2] *= scale;
                }
                
                // Dynamic particle size based on velocity (trail effect)
                // Faster particles appear larger (motion blur effect)
                const normalizedVel = Math.min(velMag / (this.diffusionSpeed * 2), 1.0);
                this.particleSizes[i] = this.baseSize + normalizedVel * this.sizeVariation;
                
                // Update position based on velocity
                positions[idx] += this.velocities[idx] * actualDeltaTime * 60;
                positions[idx + 1] += this.velocities[idx + 1] * actualDeltaTime * 60;
                positions[idx + 2] += this.velocities[idx + 2] * actualDeltaTime * 60;
                
                // 简化颜色更新，移除breathing效果以避免闪烁
                const colorIdx = i * 3;
                // 使用固定颜色，只保留轻微的速度变化
                const velColorBoost = Math.min(normalizedVel * 0.1, 0.1); // 降低速度对颜色的影响
                const finalBrightness = Math.min(1.0 + velColorBoost, 1.0);
                
                // Apply brightness to colors
                colors[colorIdx] = Math.min(this.baseColor.r * finalBrightness, 1.0);
                colors[colorIdx + 1] = Math.min(this.baseColor.g * finalBrightness, 1.0);
                colors[colorIdx + 2] = Math.min(this.baseColor.b * finalBrightness, 1.0);
            }
            
            this.geometry.attributes.color.needsUpdate = true;
            this.geometry.attributes.position.needsUpdate = true;

            // 使用固定大小，移除动态大小变化以避免闪烁
            this.material.size = this.baseSize;

            // 更新文本特效
            if (this.textParticleEffect && this.currentShape.startsWith('text:')) {
                this.textParticleEffect.update(time);
                this.geometry.attributes.color.needsUpdate = true;
                this.geometry.attributes.position.needsUpdate = true;
            }

            // Gesture Interaction: Scale (降低灵敏度：从0.15降到0.08)
            // Check if scale gesture is enabled
            if (!this.gestureControlService || this.gestureControlService.isGestureEnabled('scale')) {
                const currentScale = this.particles.scale.x;
                const newScale = currentScale + (targetScale - currentScale) * 0.08;
                this.particles.scale.set(newScale, newScale, newScale);
            }
        }
    }

    // 自适应粒子数量调整：根据性能动态调整粒子数量
    updateAdaptiveParticleCount() {
        if (this.fpsHistory.length < 10) {
            return; // 数据不足，不调整
        }
        
        // 计算平均FPS
        const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
        
        // 根据FPS调整粒子数量
        let targetCount = this.count;
        
        if (avgFPS < this.targetFPS * 0.7) {
            // 性能较差，减少粒子数量，但确保不低于最小可见数量
            const currentIndex = this.particleCountSteps.indexOf(this.count);
            if (currentIndex > 0) {
                targetCount = this.particleCountSteps[currentIndex - 1];
            } else {
                targetCount = Math.max(this.minParticleCount, this.minVisibleCount);
            }
            // 确保不低于最小可见数量
            targetCount = Math.max(targetCount, this.minVisibleCount);
        } else if (avgFPS > this.targetFPS * 1.3) {
            // 性能良好，可以增加粒子数量
            const currentIndex = this.particleCountSteps.indexOf(this.count);
            if (currentIndex < this.particleCountSteps.length - 1) {
                targetCount = this.particleCountSteps[currentIndex + 1];
            } else {
                targetCount = this.maxParticleCount;
            }
        }
        
        // 如果粒子数量需要改变，重新创建粒子系统
        if (targetCount !== this.count) {
            console.log(`[ParticleSystem] Adaptive adjustment: ${this.count} -> ${targetCount} particles (FPS: ${avgFPS.toFixed(1)})`);
            this.createParticleSystem(targetCount);
        }
    }
}
