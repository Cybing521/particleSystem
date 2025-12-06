import * as THREE from 'three';

/**
 * 粒子控制模式
 * 实现第三视角粒子控制和生物群落效果
 * 
 * @class ParticleControlMode
 */
export class ParticleControlMode {
    /**
     * 创建 ParticleControlMode 实例
     * @param {ParticleSystem} particleSystem - 粒子系统实例
     */
    constructor(particleSystem) {
        this.particleSystem = particleSystem;
        this.mode = 'normal'; // 'normal', 'controlled', 'boids'
        
        // 可控粒子配置
        this.controlledRatio = 0.25; // 25% 可控粒子
        this.particleTypes = null; // 粒子类型数组
        
        // 控制目标
        this.controlTarget = new THREE.Vector3(0, 0, 0);
        this.controlCohesion = 0.5; // 聚集度 0.0-1.0
        
        // Boids 参数
        this.boidsConfig = {
            separationWeight: 1.5,
            alignmentWeight: 1.0,
            cohesionWeight: 1.0,
            targetWeight: 2.0,
            desiredSeparation: 0.5,
            neighborRadius: 2.0,
            maxSpeed: 0.1,
            maxForce: 0.05,
            minSpeed: 0.02
        };
        
        // 性能优化：空间分区
        this.spatialGrid = null;
        this.gridSize = 5.0;
        this.gridResolution = 10;
        
        this.init();
    }
    
    /**
     * 初始化
     */
    init() {
        this.initializeParticleTypes();
    }
    
    /**
     * 初始化粒子类型
     */
    initializeParticleTypes() {
        const count = this.particleSystem.count;
        if (!count || count === 0) {
            return; // 如果粒子数量为0，不初始化
        }
        
        this.particleTypes = new Uint8Array(count);
        
        // 随机分配粒子类型
        const controlledCount = Math.floor(count * this.controlledRatio);
        for (let i = 0; i < count; i++) {
            this.particleTypes[i] = i < controlledCount ? 1 : 0; // 1=可控, 0=环境
        }
        
        // 随机打乱
        for (let i = count - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.particleTypes[i], this.particleTypes[j]] = [this.particleTypes[j], this.particleTypes[i]];
        }
    }
    
    /**
     * 设置模式
     * @param {string} mode - 模式 ('normal', 'controlled', 'boids')
     */
    setMode(mode) {
        console.log('[ParticleControlMode] Setting mode to:', mode, 'particle count:', this.particleSystem.count);
        this.mode = mode;
        if (mode === 'controlled' || mode === 'boids') {
            if (this.particleSystem.count > 0) {
                this.initializeParticleTypes();
                const controlledCount = this.particleTypes ? this.particleTypes.filter(t => t === 1).length : 0;
                console.log('[ParticleControlMode] Initialized particle types, total:', this.particleSystem.count, 'controlled:', controlledCount);
            } else {
                console.warn('[ParticleControlMode] Particle count is 0, cannot initialize types');
            }
        }
    }
    
    /**
     * 设置控制目标
     * @param {THREE.Vector3} target - 目标位置
     */
    setControlTarget(target) {
        this.controlTarget.copy(target);
    }
    
    /**
     * 设置聚集度
     * @param {number} cohesion - 聚集度 (0.0-1.0)
     */
    setCohesion(cohesion) {
        this.controlCohesion = Math.max(0, Math.min(1, cohesion));
    }
    
    /**
     * 更新粒子（第三视角控制模式）
     * @param {Float32Array} positions - 位置数组
     * @param {Float32Array} velocities - 速度数组
     * @param {number} deltaTime - 时间增量
     */
    updateControlledMode(positions, velocities, deltaTime) {
        const count = this.particleSystem.count;
        if (!count || count === 0) {
            return;
        }
        
        // 确保粒子类型已初始化
        if (!this.particleTypes || this.particleTypes.length !== count) {
            console.log('[ParticleControlMode] Re-initializing particle types, count:', count);
            this.initializeParticleTypes();
        }
        
        const controlledSpeed = 0.05;
        const environmentRandomness = 0.01;
        const repulsionRadius = 1.5;
        const repulsionStrength = 0.001;
        
        // 构建空间分区（简化版：只用于可控粒子）
        const controlledParticles = [];
        for (let i = 0; i < count; i++) {
            if (this.particleTypes && this.particleTypes[i] === 1) {
                controlledParticles.push(i);
            }
        }
        
        if (controlledParticles.length === 0) {
            console.warn('[ParticleControlMode] No controlled particles found! Re-initializing...');
            this.initializeParticleTypes();
            // 重新收集可控粒子
            for (let i = 0; i < count; i++) {
                if (this.particleTypes && this.particleTypes[i] === 1) {
                    controlledParticles.push(i);
                }
            }
        }
        
        // 更新可控粒子
        for (let i = 0; i < controlledParticles.length; i++) {
            const idx = controlledParticles[i] * 3;
            const px = positions[idx];
            const py = positions[idx + 1];
            const pz = positions[idx + 2];
            
            // 计算到目标的方向
            const dx = this.controlTarget.x - px;
            const dy = this.controlTarget.y - py;
            const dz = this.controlTarget.z - pz;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            if (dist > 0.01) {
                // 跟随目标
                const followStrength = controlledSpeed * (1.0 - this.controlCohesion * 0.5);
                velocities[idx] += (dx / dist) * followStrength * deltaTime * 60;
                velocities[idx + 1] += (dy / dist) * followStrength * deltaTime * 60;
                velocities[idx + 2] += (dz / dist) * followStrength * deltaTime * 60;
            }
            
            // 聚集力（与其他可控粒子）
            if (this.controlCohesion > 0.1) {
                let cohesionX = 0, cohesionY = 0, cohesionZ = 0;
                let neighborCount = 0;
                
                for (let j = 0; j < controlledParticles.length && neighborCount < 10; j++) {
                    if (i === j) {continue;}
                    const jIdx = controlledParticles[j] * 3;
                    const jx = positions[jIdx];
                    const jy = positions[jIdx + 1];
                    const jz = positions[jIdx + 2];
                    
                    const dist = Math.sqrt(
                        (px - jx) ** 2 + (py - jy) ** 2 + (pz - jz) ** 2
                    );
                    
                    if (dist < 2.0 && dist > 0.01) {
                        cohesionX += (jx - px) / dist;
                        cohesionY += (jy - py) / dist;
                        cohesionZ += (jz - pz) / dist;
                        neighborCount++;
                    }
                }
                
                if (neighborCount > 0) {
                    const cohesionForce = this.controlCohesion * 0.02;
                    velocities[idx] += (cohesionX / neighborCount) * cohesionForce * deltaTime * 60;
                    velocities[idx + 1] += (cohesionY / neighborCount) * cohesionForce * deltaTime * 60;
                    velocities[idx + 2] += (cohesionZ / neighborCount) * cohesionForce * deltaTime * 60;
                }
            }
        }
        
        // 更新环境粒子（随机运动 + 避免可控粒子）
        for (let i = 0; i < count; i++) {
            if (this.particleTypes && this.particleTypes[i] === 0) {
                const idx = i * 3;
                const px = positions[idx];
                const py = positions[idx + 1];
                const pz = positions[idx + 2];
                
                // 随机布朗运动
                velocities[idx] += (Math.random() - 0.5) * environmentRandomness * deltaTime * 60;
                velocities[idx + 1] += (Math.random() - 0.5) * environmentRandomness * deltaTime * 60;
                velocities[idx + 2] += (Math.random() - 0.5) * environmentRandomness * deltaTime * 60;
                
                // 避免可控粒子（简化：只检查最近的几个）
                let avoidanceX = 0, avoidanceY = 0, avoidanceZ = 0;
                let avoidanceCount = 0;
                
                for (let j = 0; j < Math.min(controlledParticles.length, 5); j++) {
                    const jIdx = controlledParticles[j] * 3;
                    const jx = positions[jIdx];
                    const jy = positions[jIdx + 1];
                    const jz = positions[jIdx + 2];
                    
                    const dist = Math.sqrt(
                        (px - jx) ** 2 + (py - jy) ** 2 + (pz - jz) ** 2
                    );
                    
                    if (dist < repulsionRadius && dist > 0.01) {
                        const force = repulsionStrength / (dist * dist);
                        avoidanceX += (px - jx) / dist * force;
                        avoidanceY += (py - jy) / dist * force;
                        avoidanceZ += (pz - jz) / dist * force;
                        avoidanceCount++;
                    }
                }
                
                if (avoidanceCount > 0) {
                    velocities[idx] += avoidanceX * deltaTime * 60;
                    velocities[idx + 1] += avoidanceY * deltaTime * 60;
                    velocities[idx + 2] += avoidanceZ * deltaTime * 60;
                }
            }
        }
    }
    
    /**
     * 更新粒子（Boids模式）
     * @param {Float32Array} positions - 位置数组
     * @param {Float32Array} velocities - 速度数组
     * @param {number} deltaTime - 时间增量
     */
    updateBoidsMode(positions, velocities, deltaTime) {
        const count = this.particleSystem.count;
        if (!count || count === 0) {
            return;
        }
        
        const config = this.boidsConfig;
        
        // 为每个粒子计算Boids力
        for (let i = 0; i < count; i++) {
            const idx = i * 3;
            const px = positions[idx];
            const py = positions[idx + 1];
            const pz = positions[idx + 2];
            
            // 查找邻居（简化：只检查最近的N个粒子）
            const neighbors = [];
            const maxNeighbors = 15; // 限制邻居数量以提升性能
            
            for (let j = 0; j < count && neighbors.length < maxNeighbors; j++) {
                if (i === j) {continue;}
                const jIdx = j * 3;
                const jx = positions[jIdx];
                const jy = positions[jIdx + 1];
                const jz = positions[jIdx + 2];
                
                const dist = Math.sqrt(
                    (px - jx) ** 2 + (py - jy) ** 2 + (pz - jz) ** 2
                );
                
                if (dist < config.neighborRadius) {
                    neighbors.push({
                        idx: jIdx,
                        position: new THREE.Vector3(jx, jy, jz),
                        velocity: new THREE.Vector3(
                            velocities[jIdx],
                            velocities[jIdx + 1],
                            velocities[jIdx + 2]
                        ),
                        distance: dist
                    });
                }
            }
            
            // 计算Boids力
            const currentPos = new THREE.Vector3(px, py, pz);
            const currentVel = new THREE.Vector3(velocities[idx], velocities[idx + 1], velocities[idx + 2]);
            
            const separation = this.calculateSeparation(
                currentPos,
                neighbors,
                config
            );
            const alignment = this.calculateAlignment(
                currentVel,
                neighbors,
                config
            );
            const cohesion = this.calculateCohesion(
                currentPos,
                neighbors,
                config
            );
            const target = this.calculateTargetSeek(
                currentPos,
                this.controlTarget,
                config
            );
            
            // 应用力
            const totalForce = new THREE.Vector3(0, 0, 0);
            totalForce.add(separation.multiplyScalar(config.separationWeight));
            totalForce.add(alignment.multiplyScalar(config.alignmentWeight));
            totalForce.add(cohesion.multiplyScalar(config.cohesionWeight));
            totalForce.add(target.multiplyScalar(config.targetWeight));
            
            // 限制力的大小
            if (totalForce.length() > config.maxForce) {
                totalForce.normalize().multiplyScalar(config.maxForce);
            }
            
            // 更新速度
            velocities[idx] += totalForce.x * deltaTime * 60;
            velocities[idx + 1] += totalForce.y * deltaTime * 60;
            velocities[idx + 2] += totalForce.z * deltaTime * 60;
            
            // 限制速度
            const velMag = Math.sqrt(
                velocities[idx] ** 2 + velocities[idx + 1] ** 2 + velocities[idx + 2] ** 2
            );
            if (velMag > config.maxSpeed) {
                const scale = config.maxSpeed / velMag;
                velocities[idx] *= scale;
                velocities[idx + 1] *= scale;
                velocities[idx + 2] *= scale;
            } else if (velMag < config.minSpeed && velMag > 0.001) {
                const scale = config.minSpeed / velMag;
                velocities[idx] *= scale;
                velocities[idx + 1] *= scale;
                velocities[idx + 2] *= scale;
            }
        }
    }
    
    /**
     * 计算分离力
     */
    calculateSeparation(position, neighbors, config) {
        const steer = new THREE.Vector3(0, 0, 0);
        let count = 0;
        
        neighbors.forEach(neighbor => {
            if (neighbor.distance > 0 && neighbor.distance < config.desiredSeparation) {
                const diff = position.clone().sub(neighbor.position);
                diff.normalize();
                diff.divideScalar(neighbor.distance);
                steer.add(diff);
                count++;
            }
        });
        
        if (count > 0) {
            steer.divideScalar(count);
            steer.normalize();
            steer.multiplyScalar(config.maxSpeed);
            steer.sub(new THREE.Vector3(0, 0, 0)); // 简化：假设当前速度为0
            if (steer.length() > config.maxForce) {
                steer.normalize().multiplyScalar(config.maxForce);
            }
        }
        
        return steer;
    }
    
    /**
     * 计算对齐力
     */
    calculateAlignment(currentVelocity, neighbors, config) {
        const sum = new THREE.Vector3(0, 0, 0);
        let count = 0;
        
        neighbors.forEach(neighbor => {
            sum.add(neighbor.velocity);
            count++;
        });
        
        if (count > 0) {
            sum.divideScalar(count);
            sum.normalize();
            sum.multiplyScalar(config.maxSpeed);
            const steer = sum.sub(currentVelocity);
            if (steer.length() > config.maxForce) {
                steer.normalize().multiplyScalar(config.maxForce);
            }
            return steer;
        }
        
        return new THREE.Vector3(0, 0, 0);
    }
    
    /**
     * 计算聚集力
     */
    calculateCohesion(position, neighbors, config) {
        const sum = new THREE.Vector3(0, 0, 0);
        let count = 0;
        
        neighbors.forEach(neighbor => {
            sum.add(neighbor.position);
            count++;
        });
        
        if (count > 0) {
            sum.divideScalar(count);
            return this.seek(position, sum, config);
        }
        
        return new THREE.Vector3(0, 0, 0);
    }
    
    /**
     * 计算目标跟随力
     */
    calculateTargetSeek(position, target, config) {
        return this.seek(position, target, config);
    }
    
    /**
     * 寻求目标
     */
    seek(position, target, config) {
        const desired = target.clone().sub(position);
        const dist = desired.length();
        
        if (dist > 0.01) {
            desired.normalize();
            if (dist < 2.0) {
                desired.multiplyScalar(config.maxSpeed * (dist / 2.0));
            } else {
                desired.multiplyScalar(config.maxSpeed);
            }
            
            // 简化：假设当前速度为0（实际应该减去当前速度）
            const steer = desired.clone();
            if (steer.length() > config.maxForce) {
                steer.normalize().multiplyScalar(config.maxForce);
            }
            return steer;
        }
        
        return new THREE.Vector3(0, 0, 0);
    }
    
    /**
     * 更新粒子颜色（根据类型）
     * @param {Float32Array} colors - 颜色数组
     */
    updateParticleColors(colors) {
        const count = this.particleSystem.count;
        if (!count || !colors || colors.length < count * 3) {
            return;
        }
        
        const baseColor = this.particleSystem.baseColor;
        if (!baseColor) {
            return;
        }
        
        for (let i = 0; i < count; i++) {
            const colorIdx = i * 3;
            
            if (this.mode === 'controlled') {
                if (this.particleTypes && this.particleTypes.length > i && this.particleTypes[i] === 1) {
                    // 可控粒子：更亮、更饱和（金色/蓝色）
                    colors[colorIdx] = Math.min(baseColor.r * 1.5, 1.0);
                    colors[colorIdx + 1] = Math.min(baseColor.g * 1.3, 1.0);
                    colors[colorIdx + 2] = Math.min(baseColor.b * 1.2, 1.0);
                } else {
                    // 环境粒子：较暗、低饱和度
                    colors[colorIdx] = baseColor.r * 0.6;
                    colors[colorIdx + 1] = baseColor.g * 0.6;
                    colors[colorIdx + 2] = baseColor.b * 0.6;
                }
            } else if (this.mode === 'boids') {
                // Boids模式：根据位置渐变（头部亮，尾部暗）
                const progress = i / count;
                const brightness = 1.0 - progress * 0.5;
                colors[colorIdx] = Math.min(baseColor.r * brightness, 1.0);
                colors[colorIdx + 1] = Math.min(baseColor.g * brightness, 1.0);
                colors[colorIdx + 2] = Math.min(baseColor.b * brightness, 1.0);
            }
        }
    }
}

