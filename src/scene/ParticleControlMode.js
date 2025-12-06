import * as THREE from 'three';

/**
 * 粒子控制模式
 * 实现生物群落效果（Boids算法）
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
        this.mode = 'normal'; // 'normal', 'boids'
        
        // 控制目标
        this.controlTarget = new THREE.Vector3(0, 0, 0);
        
        // Boids 参数
        this.boidsConfig = {
            separationWeight: 1.5,
            alignmentWeight: 1.0,
            cohesionWeight: 1.0,
            targetWeight: 0.5, // 降低目标跟随权重，让粒子更自由
            desiredSeparation: 0.5,
            neighborRadius: 2.0,
            maxSpeed: 0.15, // 提高速度让运动更流畅
            maxForce: 0.05,
            minSpeed: 0.02,
            boundaryRadius: 15.0, // 边界半径
            boundaryForce: 0.1 // 边界排斥力强度
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
        // Boids模式不需要粒子类型初始化
    }
    
    /**
     * 初始化粒子类型（Boids模式不需要，保留用于兼容性）
     */
    initializeParticleTypes() {
        // Boids模式不需要粒子类型
    }
    
    /**
     * 设置模式
     * @param {string} mode - 模式 ('normal', 'boids')
     */
    setMode(mode) {
        console.log('[ParticleControlMode] Setting mode to:', mode, 'particle count:', this.particleSystem.count);
        this.mode = mode;
        if (mode === 'boids') {
            if (this.particleSystem.count > 0) {
                // Boids模式：重置粒子位置和速度，让它们自由游动
                this.resetParticlesForBoids();
            } else {
                console.warn('[ParticleControlMode] Particle count is 0, cannot reset particles');
            }
        }
    }
    
    /**
     * 重置粒子位置和速度用于Boids模式
     * 让粒子从随机位置开始，避免被人脸形状影响
     */
    resetParticlesForBoids() {
        const count = this.particleSystem.count;
        const positions = this.particleSystem.geometry.attributes.position.array;
        const velocities = this.particleSystem.velocities;
        
        // 在3D空间中随机分布粒子（在边界范围内）
        const boundaryRadius = this.boidsConfig.boundaryRadius;
        const spread = boundaryRadius * 0.8; // 分布范围（边界内80%）
        
        for (let i = 0; i < count; i++) {
            const idx = i * 3;
            
            // 在球体内随机分布（使用球坐标）
            const r = Math.cbrt(Math.random()) * spread; // 立方根确保均匀分布
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[idx] = r * Math.sin(phi) * Math.cos(theta);
            positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[idx + 2] = r * Math.cos(phi);
            
            // 随机初始速度
            const speed = 0.05;
            const angle1 = Math.random() * Math.PI * 2;
            const angle2 = Math.random() * Math.PI * 2;
            velocities[idx] = Math.cos(angle1) * Math.sin(angle2) * speed;
            velocities[idx + 1] = Math.sin(angle1) * speed;
            velocities[idx + 2] = Math.cos(angle1) * Math.cos(angle2) * speed;
        }
        
        this.particleSystem.geometry.attributes.position.needsUpdate = true;
        console.log('[ParticleControlMode] Reset particles for Boids mode, boundary radius:', boundaryRadius);
    }
    
    /**
     * 设置控制目标
     * @param {THREE.Vector3} target - 目标位置
     */
    setControlTarget(target) {
        this.controlTarget.copy(target);
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
            
            // 性能优化：使用空间跳跃和距离平方避免sqrt
            const neighbors = [];
            const maxNeighbors = 20; // 增加邻居数量但通过优化减少计算
            const neighborRadiusSq = config.neighborRadius * config.neighborRadius;
            
            // 空间跳跃优化：每N个粒子检查一次，大幅减少计算量
            const skipStep = Math.max(1, Math.floor(count / 200)); // 最多检查200个候选粒子
            
            for (let j = 0; j < count && neighbors.length < maxNeighbors; j += skipStep) {
                if (i === j) {continue;}
                const jIdx = j * 3;
                const jx = positions[jIdx];
                const jy = positions[jIdx + 1];
                const jz = positions[jIdx + 2];
                
                // 使用平方距离避免sqrt，大幅提升性能
                const dx = px - jx;
                const dy = py - jy;
                const dz = pz - jz;
                const distSq = dx * dx + dy * dy + dz * dz;
                
                if (distSq < neighborRadiusSq && distSq > 0.0001) {
                    const dist = Math.sqrt(distSq);
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
            
            // 计算Boids力（复用Vector3对象减少GC压力）
            if (!this._tempVec1) {
                this._tempVec1 = new THREE.Vector3();
                this._tempVec2 = new THREE.Vector3();
                this._tempVec3 = new THREE.Vector3();
                this._tempVec4 = new THREE.Vector3();
                this._tempVec5 = new THREE.Vector3();
            }
            
            const currentPos = this._tempVec1.set(px, py, pz);
            const currentVel = this._tempVec2.set(velocities[idx], velocities[idx + 1], velocities[idx + 2]);
            
            const separation = this.calculateSeparation(
                currentPos,
                neighbors,
                config,
                this._tempVec3
            );
            const alignment = this.calculateAlignment(
                currentVel,
                neighbors,
                config,
                this._tempVec4
            );
            const cohesion = this.calculateCohesion(
                currentPos,
                neighbors,
                config,
                this._tempVec5
            );
            
            // 只在有手势控制时才应用目标跟随力
            let target = this._tempVec2.set(0, 0, 0);
            const targetDist = this.controlTarget.length();
            if (targetDist > 0.1) { // 只有目标位置有意义时才跟随
                target = this.calculateTargetSeek(
                    currentPos,
                    this.controlTarget,
                    config,
                    this._tempVec2
                );
            }
            
            // 应用力（复用totalForce对象）
            if (!this._totalForce) {
                this._totalForce = new THREE.Vector3();
            }
            const totalForce = this._totalForce.set(0, 0, 0);
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
            
            // 边界限制：如果粒子超出边界，施加向内的力
            const distFromCenter = Math.sqrt(px * px + py * py + pz * pz);
            if (distFromCenter > config.boundaryRadius) {
                // 计算指向中心的单位向量
                const centerDirX = -px / distFromCenter;
                const centerDirY = -py / distFromCenter;
                const centerDirZ = -pz / distFromCenter;
                
                // 计算超出边界的距离
                const overshoot = distFromCenter - config.boundaryRadius;
                
                // 施加边界排斥力（越远力越大）
                const boundaryForce = overshoot * config.boundaryForce;
                velocities[idx] += centerDirX * boundaryForce * deltaTime * 60;
                velocities[idx + 1] += centerDirY * boundaryForce * deltaTime * 60;
                velocities[idx + 2] += centerDirZ * boundaryForce * deltaTime * 60;
            }
        }
    }
    
    /**
     * 计算分离力
     * @param {THREE.Vector3} position - 当前位置
     * @param {Array} neighbors - 邻居列表
     * @param {Object} config - 配置
     * @param {THREE.Vector3} result - 结果向量（复用对象）
     */
    calculateSeparation(position, neighbors, config, result) {
        result.set(0, 0, 0);
        let count = 0;
        
        for (let i = 0; i < neighbors.length; i++) {
            const neighbor = neighbors[i];
            if (neighbor.distance > 0 && neighbor.distance < config.desiredSeparation) {
                result.x += (position.x - neighbor.position.x) / neighbor.distance;
                result.y += (position.y - neighbor.position.y) / neighbor.distance;
                result.z += (position.z - neighbor.position.z) / neighbor.distance;
                count++;
            }
        }
        
        if (count > 0) {
            result.divideScalar(count);
            const len = result.length();
            if (len > 0.001) {
                result.normalize().multiplyScalar(config.maxSpeed);
                if (result.length() > config.maxForce) {
                    result.normalize().multiplyScalar(config.maxForce);
                }
            }
        }
        
        return result;
    }
    
    /**
     * 计算对齐力
     * @param {THREE.Vector3} currentVelocity - 当前速度
     * @param {Array} neighbors - 邻居列表
     * @param {Object} config - 配置
     * @param {THREE.Vector3} result - 结果向量（复用对象）
     */
    calculateAlignment(currentVelocity, neighbors, config, result) {
        result.set(0, 0, 0);
        let count = 0;
        
        for (let i = 0; i < neighbors.length; i++) {
            const neighbor = neighbors[i];
            result.x += neighbor.velocity.x;
            result.y += neighbor.velocity.y;
            result.z += neighbor.velocity.z;
            count++;
        }
        
        if (count > 0) {
            result.divideScalar(count);
            const len = result.length();
            if (len > 0.001) {
                result.normalize().multiplyScalar(config.maxSpeed);
                result.sub(currentVelocity);
                if (result.length() > config.maxForce) {
                    result.normalize().multiplyScalar(config.maxForce);
                }
            }
        }
        
        return result;
    }
    
    /**
     * 计算聚集力
     * @param {THREE.Vector3} position - 当前位置
     * @param {Array} neighbors - 邻居列表
     * @param {Object} config - 配置
     * @param {THREE.Vector3} result - 结果向量（复用对象）
     */
    calculateCohesion(position, neighbors, config, result) {
        result.set(0, 0, 0);
        let count = 0;
        
        for (let i = 0; i < neighbors.length; i++) {
            const neighbor = neighbors[i];
            result.x += neighbor.position.x;
            result.y += neighbor.position.y;
            result.z += neighbor.position.z;
            count++;
        }
        
        if (count > 0) {
            result.divideScalar(count);
            return this.seek(position, result, config, result);
        }
        
        return result.set(0, 0, 0);
    }
    
    /**
     * 计算目标跟随力
     * @param {THREE.Vector3} position - 当前位置
     * @param {THREE.Vector3} target - 目标位置
     * @param {Object} config - 配置
     * @param {THREE.Vector3} result - 结果向量（复用对象）
     */
    calculateTargetSeek(position, target, config, result) {
        return this.seek(position, target, config, result);
    }
    
    /**
     * 计算朝向目标的力
     * @param {THREE.Vector3} position - 当前位置
     * @param {THREE.Vector3} target - 目标位置
     * @param {Object} config - 配置
     * @param {THREE.Vector3} result - 结果向量（复用对象）
     */
    seek(position, target, config, result) {
        result.x = target.x - position.x;
        result.y = target.y - position.y;
        result.z = target.z - position.z;
        const dist = result.length();
        
        if (dist > 0.01) {
            result.normalize();
            if (dist < 2.0) {
                result.multiplyScalar(config.maxSpeed * (dist / 2.0));
            } else {
                result.multiplyScalar(config.maxSpeed);
            }
            
            if (result.length() > config.maxForce) {
                result.normalize().multiplyScalar(config.maxForce);
            }
            return result;
        }
        
        return result.set(0, 0, 0);
    }
    
    /**
     * 更新粒子颜色（Boids模式）
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
        
        if (this.mode === 'boids') {
            // Boids模式：根据位置渐变（头部亮，尾部暗）
            for (let i = 0; i < count; i++) {
                const colorIdx = i * 3;
                const progress = i / count;
                const brightness = 1.0 - progress * 0.5;
                colors[colorIdx] = Math.min(baseColor.r * brightness, 1.0);
                colors[colorIdx + 1] = Math.min(baseColor.g * brightness, 1.0);
                colors[colorIdx + 2] = Math.min(baseColor.b * brightness, 1.0);
            }
        }
    }
}

