import * as THREE from 'three';

/**
 * 文本粒子特效类
 * 提供文本粒子的动态效果和动画
 */
export class TextParticleEffect {
    constructor(particleSystem) {
        this.particleSystem = particleSystem;

        // 特效参数
        this.effects = {
            wave: {
                enabled: false,
                amplitude: 0.2,
                frequency: 2,
                speed: 1,
                phase: 0
            },
            glow: {
                enabled: true,
                intensity: 1.5,
                radius: 0.1,
                color: new THREE.Color(0xffffff)
            },
            dissolve: {
                enabled: false,
                speed: 0.5,
                threshold: 0
            },
            rotate: {
                enabled: false,
                speed: 1,
                axis: 'y'
            },
            pulse: {
                enabled: false,
                amplitude: 0.1,
                frequency: 2
            },
            typewriter: {
                enabled: false,
                speed: 50, // 每秒显示的字符数
                currentIndex: 0,
                lastUpdateTime: 0
            }
        };

        // 粒子效果数据
        this.particleEffectData = [];
        this.initializeEffectData();
    }

    /**
     * 初始化粒子效果数据
     */
    initializeEffectData() {
        const count = this.particleSystem.count;
        this.particleEffectData = new Array(count);

        for (let i = 0; i < count; i++) {
            this.particleEffectData[i] = {
                originalPosition: new THREE.Vector3(),
                waveOffset: Math.random() * Math.PI * 2,
                dissolveValue: Math.random(),
                glowIntensity: 1,
                rotationAngle: Math.random() * Math.PI * 2,
                pulsePhase: Math.random() * Math.PI * 2
            };
        }
    }

    /**
     * 更新所有特效
     * @param {number} time - 当前时间
     */
    update(time) {
        const positions = this.particleSystem.geometry.attributes.position.array;
        const colors = this.particleSystem.geometry.attributes.color.array;

        // 更新wave效果相位
        if (this.effects.wave.enabled) {
            this.effects.wave.phase += this.effects.wave.speed * 0.01;
        }

        // 更新pulse效果
        if (this.effects.pulse.enabled) {
            const pulseValue = Math.sin(time * this.effects.pulse.frequency * 0.001) *
                               this.effects.pulse.amplitude;
        }

        // 更新dissolve效果
        if (this.effects.dissolve.enabled) {
            this.effects.dissolve.threshold += this.effects.dissolve.speed * 0.01;
            if (this.effects.dissolve.threshold > 1) {
                this.effects.dissolve.threshold = 0;
            }
        }

        // 更新typewriter效果
        if (this.effects.typewriter.enabled) {
            this.updateTypewriterEffect(time);
        }

        // 应用特效到每个粒子
        for (let i = 0; i < this.particleSystem.count; i++) {
            this.applyEffectsToParticle(i, positions, colors, time);
        }
    }

    /**
     * 应用特效到单个粒子
     * @param {number} index - 粒子索引
     * @param {Array} positions - 位置数组
     * @param {Array} colors - 颜色数组
     * @param {number} time - 当前时间
     */
    applyEffectsToParticle(index, positions, colors, time) {
        const idx = index * 3;
        const effectData = this.particleEffectData[index];

        // 获取原始位置
        if (this.particleSystem.targetPositions) {
            effectData.originalPosition.set(
                this.particleSystem.targetPositions[idx],
                this.particleSystem.targetPositions[idx + 1],
                this.particleSystem.targetPositions[idx + 2]
            );
        }

        let x = positions[idx];
        let y = positions[idx + 1];
        let z = positions[idx + 2];

        // Wave效果
        if (this.effects.wave.enabled) {
            const waveY = Math.sin(
                this.effects.wave.frequency * x +
                effectData.waveOffset +
                this.effects.wave.phase
            ) * this.effects.wave.amplitude;
            y += waveY;
        }

        // Glow效果
        if (this.effects.glow.enabled) {
            const glowIntensity = effectData.glowIntensity * this.effects.glow.intensity;
            colors[idx] = Math.min(colors[idx] * glowIntensity, 1.0);
            colors[idx + 1] = Math.min(colors[idx + 1] * glowIntensity, 1.0);
            colors[idx + 2] = Math.min(colors[idx + 2] * glowIntensity, 1.0);
        }

        // Dissolve效果
        if (this.effects.dissolve.enabled) {
            if (effectData.dissolveValue < this.effects.dissolve.threshold) {
                // 隐藏粒子
                colors[idx + 3] = 0; // Alpha
            }
        }

        // Rotate效果
        if (this.effects.rotate.enabled) {
            const angle = effectData.rotationAngle + time * this.effects.rotate.speed * 0.001;
            if (this.effects.rotate.axis === 'y') {
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const tempX = x - effectData.originalPosition.x;
                const tempZ = z - effectData.originalPosition.z;
                x = effectData.originalPosition.x + tempX * cos - tempZ * sin;
                z = effectData.originalPosition.z + tempX * sin + tempZ * cos;
            }
        }

        // Pulse效果
        if (this.effects.pulse.enabled) {
            const pulseScale = 1 + Math.sin(time * this.effects.pulse.frequency * 0.001 +
                                              effectData.pulsePhase) *
                                              this.effects.pulse.amplitude;
            x = effectData.originalPosition.x + (x - effectData.originalPosition.x) * pulseScale;
            y = effectData.originalPosition.y + (y - effectData.originalPosition.y) * pulseScale;
            z = effectData.originalPosition.z + (z - effectData.originalPosition.z) * pulseScale;
        }

        // 更新位置
        positions[idx] = x;
        positions[idx + 1] = y;
        positions[idx + 2] = z;
    }

    /**
     * 更新打字机效果
     * @param {number} time - 当前时间
     */
    updateTypewriterEffect(time) {
        const deltaTime = time - this.effects.typewriter.lastUpdateTime;
        const charsPerUpdate = Math.floor(
            this.effects.typewriter.speed * deltaTime / 1000
        );

        if (charsPerUpdate > 0) {
            this.effects.typewriter.currentIndex += charsPerUpdate;
            this.effects.typewriter.lastUpdateTime = time;
        }
    }

    /**
     * 设置特效状态
     * @param {string} effectName - 特效名称
     * @param {boolean} enabled - 是否启用
     * @param {Object} params - 特效参数
     */
    setEffect(effectName, enabled, params = {}) {
        if (this.effects[effectName]) {
            this.effects[effectName].enabled = enabled;
            Object.assign(this.effects[effectName], params);
        }
    }

    /**
     * 启用所有特效
     */
    enableAllEffects() {
        Object.keys(this.effects).forEach(effect => {
            this.effects[effect].enabled = true;
        });
    }

    /**
     * 禁用所有特效
     */
    disableAllEffects() {
        Object.keys(this.effects).forEach(effect => {
            this.effects[effect].enabled = false;
        });
    }

    /**
     * 创建文字出现动画
     * @param {string} text - 要显示的文字
     * @param {number} duration - 动画持续时间（毫秒）
     */
    createTextAppearAnimation(text, duration = 2000) {
        // 先设置所有粒子为不可见
        const colors = this.particleSystem.geometry.attributes.color.array;
        for (let i = 0; i < this.particleSystem.count; i++) {
            const idx = i * 3;
            colors[idx] = 0;
            colors[idx + 1] = 0;
            colors[idx + 2] = 0;
        }

        // 启用dissolve效果并反向播放
        this.effects.dissolve.enabled = true;
        this.effects.dissolve.threshold = 1;
        this.effects.dissolve.speed = -1 / (duration / 16.67); // 从1到0的速度

        // 动画结束后禁用效果
        setTimeout(() => {
            this.effects.dissolve.enabled = false;
            this.effects.dissolve.threshold = 0;
        }, duration);
    }

    /**
     * 创建文字消失动画
     * @param {number} duration - 动画持续时间（毫秒）
     */
    createTextDisappearAnimation(duration = 2000) {
        // 启用dissolve效果正向播放
        this.effects.dissolve.enabled = true;
        this.effects.dissolve.threshold = 0;
        this.effects.dissolve.speed = 1 / (duration / 16.67);

        // 动画结束后禁用效果
        setTimeout(() => {
            this.effects.dissolve.enabled = false;
            this.effects.dissolve.threshold = 1;
        }, duration);
    }

    /**
     * 创建文字闪烁效果
     * @param {number} count - 闪烁次数
     * @param {number} interval - 闪烁间隔（毫秒）
     */
    createTextBlinkEffect(count = 3, interval = 500) {
        let blinkCount = 0;
        const blink = () => {
            if (blinkCount >= count * 2) return;

            const colors = this.particleSystem.geometry.attributes.color.array;
            const isOn = blinkCount % 2 === 0;

            for (let i = 0; i < this.particleSystem.count; i++) {
                const idx = i * 3;
                if (isOn) {
                    this.particleSystem.updateParticleColor(
                        new THREE.Color(colors[idx], colors[idx + 1], colors[idx + 2]),
                        i
                    );
                } else {
                    colors[idx] = 0;
                    colors[idx + 1] = 0;
                    colors[idx + 2] = 0;
                }
            }

            this.particleSystem.geometry.attributes.color.needsUpdate = true;
            blinkCount++;
            setTimeout(blink, interval);
        };

        blink();
    }
}