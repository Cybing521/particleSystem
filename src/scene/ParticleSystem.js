import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = null;
        this.glowParticles = null; // Glow effect layer
        this.baseCount = 5000; // 基础粒子数量
        this.count = 5000; // 当前粒子数量（会根据性能动态调整）
        this.geometry = null;
        this.material = null;
        this.glowGeometry = null;
        this.glowMaterial = null;
        
        // Particle velocities for free diffusion
        this.velocities = new Float32Array(this.count * 3);
        
        // Particle physics properties
        this.masses = new Float32Array(this.count); // Particle masses
        this.lifetimes = new Float32Array(this.count); // Particle lifetimes (0-1)
        this.maxLifetime = 8.0; // Maximum lifetime in seconds (reduced for more frequent resets)
        
        // Visual effects properties
        this.particleSizes = new Float32Array(this.count); // Dynamic particle sizes
        this.baseSize = 0.03; // Base particle size
        this.sizeVariation = 0.03; // Size variation based on velocity (increased)
        this.trailEnabled = false; // Trail effect (can be enabled if needed)
        this.glowIntensity = 0.5; // Glow effect intensity (increased)
        this.lifetimeColorIntensity = 0.5; // Lifetime color variation intensity
        
        // Current shape tracking
        this.currentShape = 'sphere'; // Track current shape for UI sync
        this.shapeChangeCallback = null;
        
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
        if (this.glowParticles) {
            this.scene.remove(this.glowParticles);
            this.glowGeometry.dispose();
            this.glowMaterial.dispose();
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
        if (!this.lifetimes || this.lifetimes.length < count) {
            this.lifetimes = new Float32Array(count);
        } else {
            this.lifetimes = this.lifetimes.subarray(0, count);
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
            this.lifetimes[i] = Math.random(); // Random initial lifetime
            
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
            opacity: 0.6,
            // Enable size variation per particle (requires custom shader, but we'll update size dynamically)
        });

        this.particles = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.particles);
        
        // Create glow layer for enhanced visual effects
        this.createGlowLayer(count);
    }
    
    createGlowLayer(count) {
        // Create a separate layer for glow effect
        this.glowGeometry = new THREE.BufferGeometry();
        const glowPositions = new Float32Array(count * 3);
        const glowColors = new Float32Array(count * 3);
        
        // Copy positions and colors from main particles
        for (let i = 0; i < count; i++) {
            const idx = i * 3;
            glowPositions[idx] = this.initialPositions[idx];
            glowPositions[idx + 1] = this.initialPositions[idx + 1];
            glowPositions[idx + 2] = this.initialPositions[idx + 2];
            glowColors[idx] = this.baseColor.r;
            glowColors[idx + 1] = this.baseColor.g;
            glowColors[idx + 2] = this.baseColor.b;
        }
        
        this.glowGeometry.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3));
        this.glowGeometry.setAttribute('color', new THREE.BufferAttribute(glowColors, 3));
        
        const glowSprite = new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/disc.png');
        
        this.glowMaterial = new THREE.PointsMaterial({
            size: this.baseSize * 4.0, // Much larger size for visible glow
            sizeAttenuation: true,
            vertexColors: true,
            map: glowSprite,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0.4 // More visible glow
        });
        
        this.glowParticles = new THREE.Points(this.glowGeometry, this.glowMaterial);
        this.scene.add(this.glowParticles);
    }

    calculateShapePositions(shape, array) {
        for (let i = 0; i < this.count; i++) {
            let x, y, z;

            if (shape === 'sphere') {
                const r = 2 * Math.cbrt(Math.random());
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos(2 * Math.random() - 1);
                x = r * Math.sin(phi) * Math.cos(theta);
                y = r * Math.sin(phi) * Math.sin(theta);
                z = r * Math.cos(phi);
            } else if (shape === 'torus') {
                const u = Math.random() * Math.PI * 2;
                const v = Math.random() * Math.PI * 2;
                const R = 1.5;
                const r = 0.5;
                x = (R + r * Math.cos(v)) * Math.cos(u);
                y = (R + r * Math.cos(v)) * Math.sin(u);
                z = r * Math.sin(v);
                // Add some volume
                x += (Math.random() - 0.5) * 0.2;
                y += (Math.random() - 0.5) * 0.2;
                z += (Math.random() - 0.5) * 0.2;
            } else {
                // Default to sphere if unknown shape
                const r = 2 * Math.cbrt(Math.random());
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

    setColor(hexColor) {
        this.baseColor.set(hexColor);
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
                
                // Right hand: shape and scale
                shapeFingers = rightHand.fingers;
                targetScale = 0.3 + (rightHand.gestureState * 0.7);
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
                targetScale = 0.3 + (rightHand.gestureState * 0.7);
            } else {
                // No hands or legacy single hand mode
                targetRotY = (handPos.x - 0.5) * Math.PI * 1.5;
                targetRotX = (handPos.y - 0.5) * Math.PI * 1.5;
                targetRotZ = rotationZ * Math.PI;
                shapeFingers = fingers;
                targetScale = 0.3 + (gestureState * 0.7);
            }

            // Smooth rotation with increased responsiveness
            this.particles.rotation.y += (targetRotY - this.particles.rotation.y) * 0.1;
            this.particles.rotation.x += (targetRotX - this.particles.rotation.x) * 0.1;
            this.particles.rotation.z += (targetRotZ - this.particles.rotation.z) * 0.12;

            // Auto rotation if no hand
            if (!leftHand && !rightHand && gestureState > 0.95 && fingers === 0) {
                this.particles.rotation.y += 0.002;
            }

            // Finger Shape Switching (from right hand)
            // 1: Sphere, 3: Torus
            if (shapeFingers === 1) this.setShape('sphere');
            if (shapeFingers === 3) this.setShape('torus');

            // Breathing Effect with enhanced glow
            const breath = Math.sin(time * 2.0) * 0.008; // Increased breath effect
            const glowPulse = Math.sin(time * 1.5) * 0.15 + 0.85; // Pulse between 0.7 and 1.0
            this.material.size = this.baseSize + breath;
            this.material.opacity = 0.7 + glowPulse * 0.2; // More visible pulsing opacity

            // Free diffusion with attraction to target shape + Physics
            const positions = this.geometry.attributes.position.array;
            const colors = this.geometry.attributes.color.array;
            const actualDeltaTime = 0.016; // Approximate frame time (60fps)

            for (let i = 0; i < this.count; i++) {
                const idx = i * 3;
                
                // Update particle lifetime
                this.lifetimes[i] += actualDeltaTime / this.maxLifetime;
                if (this.lifetimes[i] >= 1.0) {
                    // Reset particle when lifetime expires - create visible rebirth effect
                    this.lifetimes[i] = 0;
                    // Reset position to initial
                    positions[idx] = this.initialPositions[idx];
                    positions[idx + 1] = this.initialPositions[idx + 1];
                    positions[idx + 2] = this.initialPositions[idx + 2];
                    // Reset velocity with initial boost for visibility
                    const speed = this.diffusionSpeed * (0.8 + Math.random() * 0.4); // Slightly faster initial speed
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1);
                    this.velocities[idx] = speed * Math.sin(phi) * Math.cos(theta);
                    this.velocities[idx + 1] = speed * Math.sin(phi) * Math.sin(theta);
                    this.velocities[idx + 2] = speed * Math.cos(phi);
                    // Reset mass for variation
                    this.masses[i] = 0.5 + Math.random() * 0.5;
                }
                
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
                
                // Update color based on lifetime and velocity (enhanced visual effects)
                const lifetimeFactor = 1.0 - this.lifetimes[i]; // 0 (new) to 1 (old)
                const colorIdx = i * 3;
                
                // Add velocity-based color variation (faster particles are brighter)
                const velColorBoost = Math.min(normalizedVel * 0.5, 0.5); // Increased boost
                
                // Enhanced lifetime effect: particles fade from bright to dark as they age
                // New particles are brighter, old particles are darker
                const lifetimeBrightness = 0.3 + lifetimeFactor * 0.7; // Range: 0.3 to 1.0
                const finalBrightness = lifetimeBrightness * (1.0 + velColorBoost);
                
                // Enhanced glow effect: faster particles have more intense colors
                // Also apply lifetime-based color variation
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
            
            // Update glow layer to follow main particles
            if (this.glowParticles && this.glowGeometry) {
                const glowPositions = this.glowGeometry.attributes.position.array;
                const glowColors = this.glowGeometry.attributes.color.array;
                
                for (let i = 0; i < this.count; i++) {
                    const idx = i * 3;
                    glowPositions[idx] = positions[idx];
                    glowPositions[idx + 1] = positions[idx + 1];
                    glowPositions[idx + 2] = positions[idx + 2];
                    
                    // Enhanced glow colors: much brighter and more saturated
                    // Glow is more intense for new particles (based on lifetime)
                    const lifetimeFactor = 1.0 - this.lifetimes[i];
                    const glowIntensity = 0.5 + lifetimeFactor * 0.5; // New particles have stronger glow
                    
                    // Glow colors are much brighter and more saturated
                    glowColors[idx] = Math.min(colors[idx] * 2.5 * glowIntensity, 1.0);
                    glowColors[idx + 1] = Math.min(colors[idx + 1] * 2.5 * glowIntensity, 1.0);
                    glowColors[idx + 2] = Math.min(colors[idx + 2] * 2.5 * glowIntensity, 1.0);
                }
                
                this.glowGeometry.attributes.position.needsUpdate = true;
                this.glowGeometry.attributes.color.needsUpdate = true;
                
                // Update glow size dynamically - make it more visible
                this.glowMaterial.size = avgSize * 4.0; // Increased from 2.5 to 4.0
                // Enhanced pulsing glow with more variation
                this.glowMaterial.opacity = 0.3 + Math.sin(time * 1.5) * 0.15; // Range: 0.15 to 0.45
            }

            // Gesture Interaction: Scale (from right hand or legacy gestureState)
            const currentScale = this.particles.scale.x;
            const newScale = currentScale + (targetScale - currentScale) * 0.15;

            this.particles.scale.set(newScale, newScale, newScale);
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
            // 性能较差，减少粒子数量
            const currentIndex = this.particleCountSteps.indexOf(this.count);
            if (currentIndex > 0) {
                targetCount = this.particleCountSteps[currentIndex - 1];
            } else {
                targetCount = this.minParticleCount;
            }
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
