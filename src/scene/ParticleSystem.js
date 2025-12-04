import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = null;
        this.baseCount = 5000; // 基础粒子数量
        this.count = 5000; // 当前粒子数量（会根据性能动态调整）
        this.minVisibleCount = 3000; // 最小可见粒子数量（防止粒子过少）
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
        
        // Color and opacity
        this.baseOpacity = 0.8; // Base opacity (0.0 to 1.0)
        
        // Distribution mode
        this.distributionMode = 'uniform'; // 'uniform', 'random', 'clustered'
        
        // Gesture control service reference (set externally)
        this.gestureControlService = null;
        
        // Diffusion parameters
        this.diffusionSpeed = 0.02; // Base speed of particle movement
        this.attractionStrength = 0.001; // Strength of attraction to target shape
        this.randomness = 0.005; // Random movement component
        
        // Physics parameters
        this.gravity = -0.0005; // Gravity strength (negative = downward)
        this.collisionRadius = 0.05; // Collision detection radius
        this.collisionDamping = 0.8; // Collision damping factor
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

        this.init();
    }

    init() {
        this.createParticleSystem(this.count);
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
                // Heart shape using parametric equations with volume
                const t = Math.random() * Math.PI * 2;
                const scale = 0.12 * randomFactor; // Scale factor for heart size
                // Heart parametric equations (standard heart curve)
                const heartX = 16 * Math.pow(Math.sin(t), 3);
                const heartY = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
                // Add volume by varying the depth based on position
                const depthVariation = this.distributionMode === 'clustered' ? 0.2 : 0.3;
                const depth = (Math.random() - 0.5) * depthVariation; // Volume variation
                x = scale * heartX;
                y = scale * heartY;
                z = depth;
                // Add some random variation for more natural distribution
                const variationFactor = this.distributionMode === 'clustered' ? 0.03 : 0.05;
                x += (Math.random() - 0.5) * variationFactor;
                y += (Math.random() - 0.5) * variationFactor;
                z += (Math.random() - 0.5) * variationFactor;
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

    setShape(shape) {
        // Only update if shape actually changed
        if (shape !== this.currentShape) {
            this.currentShape = shape;
            this.calculateShapePositions(shape, this.targetPositions);
            
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
    
    setShapeChangeCallback(callback) {
        this.shapeChangeCallback = callback;
    }
    
    getCurrentShape() {
        return this.currentShape;
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

    update(time, leftHand = null, rightHand = null, gestureState = 1.0, fingers = 0, handPos = { x: 0.5, y: 0.5 }, rotationZ = 0.0, rotationX = 0.0) {
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
            
            // Dual hand control: Left hand controls position and rotation, Right hand controls shape and scale
            let targetRotY, targetRotX, targetRotZ;
            let targetScale;
            let shapeFingers;
            
            if (leftHand && rightHand) {
                // Both hands detected - use dual hand control
                // Left hand: position and rotation
                targetRotY = (leftHand.position.x - 0.5) * Math.PI * 1.5;
                targetRotX = (leftHand.position.y - 0.5) * Math.PI * 1.5;
                targetRotZ = leftHand.rotationZ * Math.PI;
                
                // Right hand: shape and scale (调整缩放范围：0.3 到 3.0)
                shapeFingers = rightHand.fingers;
                targetScale = 0.5 + (rightHand.gestureState * 2.7); // 0.3 to 3.0
            } else if (leftHand) {
                // Only left hand detected - use for rotation, default scale
                targetRotY = (leftHand.position.x - 0.5) * Math.PI * 1.5;
                targetRotX = (leftHand.position.y - 0.5) * Math.PI * 1.5;
                targetRotZ = leftHand.rotationZ * Math.PI;
                shapeFingers = 0;
                targetScale = 0.5; // Default scale
            } else if (rightHand) {
                // Only right hand detected - use for both rotation and scale
                // When only one hand is present, HandTracker provides both leftHand and rightHand data
                // But if only rightHand is available here, use it for both functions
                targetRotY = (rightHand.position.x - 0.5) * Math.PI * 1.5;
                targetRotX = (rightHand.position.y - 0.5) * Math.PI * 1.5;
                targetRotZ = rotationZ * Math.PI;
                shapeFingers = rightHand.fingers;
                targetScale = 0.3 + (rightHand.gestureState * 2.7); // 0.3 to 3.0
            } else {
                // No hands or legacy single hand mode
                targetRotY = (handPos.x - 0.5) * Math.PI * 1.5;
                targetRotX = (handPos.y - 0.5) * Math.PI * 1.5;
                targetRotZ = rotationZ * Math.PI;
                shapeFingers = fingers;
                targetScale = 0.3 + (gestureState * 2.7); // 0.3 to 3.0
            }

            // Smooth rotation (降低灵敏度：从0.1/0.12降到0.06/0.08)
            // Check if rotation gesture is enabled
            if (!this.gestureControlService || this.gestureControlService.isGestureEnabled('rotation')) {
                this.particles.rotation.y += (targetRotY - this.particles.rotation.y) * 0.06;
                this.particles.rotation.x += (targetRotX - this.particles.rotation.x) * 0.06;
                this.particles.rotation.z += (targetRotZ - this.particles.rotation.z) * 0.08;
            }

            // Auto rotation if no hand
            if (!leftHand && !rightHand && gestureState > 0.95 && fingers === 0) {
                this.particles.rotation.y += 0.002;
            }

            // Finger Shape Switching (from right hand)
            // 1: Sphere, 2: Heart, 3: Torus
            // Check if shape gesture is enabled
            if ((!this.gestureControlService || this.gestureControlService.isGestureEnabled('shape'))) {
                if (shapeFingers === 1) this.setShape('sphere');
                if (shapeFingers === 2) this.setShape('heart');
                if (shapeFingers === 3) this.setShape('torus');
            }

            // Enhanced Breathing Effect - size and opacity pulse together
            const breathSize = Math.sin(time * 2.0) * 0.01; // Size breathing effect
            // Use baseOpacity for breathing effect, but keep it within reasonable range
            const breathOpacity = this.baseOpacity * (Math.sin(time * 1.8) * 0.15 + 0.85); // Opacity breathing
            this.material.size = this.baseSize + breathSize;
            this.material.opacity = breathOpacity; // Breathing opacity for depth

            // Free diffusion with attraction to target shape + Physics
            const positions = this.geometry.attributes.position.array;
            const colors = this.geometry.attributes.color.array;
            const actualDeltaTime = 0.016; // Approximate frame time (60fps)

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
                const attractionX = dist > 0 ? (dx / dist) * this.attractionStrength : 0;
                const attractionY = dist > 0 ? (dy / dist) * this.attractionStrength : 0;
                const attractionZ = dist > 0 ? (dz / dist) * this.attractionStrength : 0;
                
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
                
                // Collision detection with nearby particles (simplified)
                for (let j = i + 1; j < Math.min(i + 10, this.count); j++) {
                    const jdx = i * 3;
                    const px2 = positions[jdx];
                    const py2 = positions[jdx + 1];
                    const pz2 = positions[jdx + 2];
                    
                    const colDx = px - px2;
                    const colDy = py - py2;
                    const colDz = pz - pz2;
                    const colDist = Math.sqrt(colDx * colDx + colDy * colDy + colDz * colDz);
                    
                    if (colDist < this.collisionRadius && colDist > 0.001) {
                        // Simple collision response
                        const overlap = this.collisionRadius - colDist;
                        const normalX = colDx / colDist;
                        const normalY = colDy / colDist;
                        const normalZ = colDz / colDist;
                        
                        // Separate particles
                        const separation = overlap * 0.5;
                        positions[idx] += normalX * separation;
                        positions[idx + 1] += normalY * separation;
                        positions[idx + 2] += normalZ * separation;
                        positions[jdx] -= normalX * separation;
                        positions[jdx + 1] -= normalY * separation;
                        positions[jdx + 2] -= normalZ * separation;
                        
                        // Apply collision damping
                        this.velocities[idx] *= this.collisionDamping;
                        this.velocities[idx + 1] *= this.collisionDamping;
                        this.velocities[idx + 2] *= this.collisionDamping;
                        this.velocities[jdx] *= this.collisionDamping;
                        this.velocities[jdx + 1] *= this.collisionDamping;
                        this.velocities[jdx + 2] *= this.collisionDamping;
                    }
                }
                
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
                
                // Update color with breathing effect: alternating bright (1.0) and dark (0.75)
                // Use particle index and time to create wave-like breathing effect
                const colorIdx = i * 3;
                const breathingPhase = (i * 0.1 + time * 2.0) % (Math.PI * 2);
                const breathingFactor = (Math.sin(breathingPhase) + 1.0) / 2.0; // 0 to 1
                const brightness = 0.75 + breathingFactor * 0.25; // Range: 0.75 to 1.0
                
                // Add velocity-based color variation (faster particles are brighter)
                const velColorBoost = Math.min(normalizedVel * 0.3, 0.3);
                const finalBrightness = Math.min(brightness * (1.0 + velColorBoost), 1.0);
                
                // Apply brightness to colors
                colors[colorIdx] = Math.min(this.baseColor.r * finalBrightness, 1.0);
                colors[colorIdx + 1] = Math.min(this.baseColor.g * finalBrightness, 1.0);
                colors[colorIdx + 2] = Math.min(this.baseColor.b * finalBrightness, 1.0);
            }
            
            this.geometry.attributes.color.needsUpdate = true;
            this.geometry.attributes.position.needsUpdate = true;
            
            // Update material size based on average particle size for dynamic effect
            // Note: Three.js PointsMaterial doesn't support per-particle sizes natively,
            // but we can adjust the overall size based on average velocity for a dynamic effect
            let avgSize = 0;
            for (let i = 0; i < this.count; i++) {
                avgSize += this.particleSizes[i];
            }
            avgSize /= this.count;
            this.material.size = avgSize;

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
