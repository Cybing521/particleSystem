/**
 * 预设模式服务
 * 管理粒子系统配置的保存和加载
 * 
 * @class PresetService
 */
export class PresetService {
    /**
     * 创建 PresetService 实例
     */
    constructor() {
        this.storageKey = 'particleSystemPresets';
        this.currentPresetKey = 'particleSystemCurrentConfig';
    }

    /**
     * 获取当前粒子系统配置
     * @param {ParticleSystem} particleSystem - 粒子系统实例
     * @returns {Object} 配置对象
     */
    getCurrentConfig(particleSystem) {
        // 获取颜色（确保格式正确）
        let colorHex = '#222222'; // 默认颜色
        if (particleSystem.baseColor) {
            const hex = particleSystem.baseColor.getHex();
            colorHex = `#${hex.toString(16).padStart(6, '0')}`;
        }
        
        return {
            color: colorHex,
            opacity: particleSystem.baseOpacity,
            shape: particleSystem.currentShape,
            particleCount: particleSystem.count,
            distributionMode: particleSystem.distributionMode
        };
    }

    /**
     * 应用配置到粒子系统
     * @param {ParticleSystem} particleSystem - 粒子系统实例
     * @param {Object} config - 配置对象
     */
    applyConfig(particleSystem, config) {
        // 先设置形状和粒子数量（这些会影响颜色数组的大小）
        if (config.shape) {
            particleSystem.setShape(config.shape);
        }
        if (config.particleCount) {
            particleSystem.setParticleCount(config.particleCount);
        }
        if (config.distributionMode) {
            particleSystem.setDistributionMode(config.distributionMode);
        }
        
        // 最后设置颜色和透明度（确保在形状和数量设置之后）
        if (config.color !== undefined) {
            // 确保opacity有值，如果没有则使用当前值
            const opacity = config.opacity !== undefined ? config.opacity : particleSystem.baseOpacity;
            particleSystem.setColor(config.color, opacity);
        } else if (config.opacity !== undefined) {
            // 如果只有opacity，也要更新
            particleSystem.setOpacity(config.opacity);
        }
    }

    /**
     * 保存当前配置到本地存储
     * @param {ParticleSystem} particleSystem - 粒子系统实例
     * @param {string} [presetName] - 预设名称，如果不提供则保存为当前配置
     * @returns {boolean} 保存成功返回 true
     */
    savePreset(particleSystem, presetName = null) {
        try {
            const config = this.getCurrentConfig(particleSystem);
            
            if (presetName) {
                // 保存为命名预设
                const presets = this.getAllPresets();
                presets[presetName] = {
                    ...config,
                    name: presetName,
                    createdAt: new Date().toISOString()
                };
                localStorage.setItem(this.storageKey, JSON.stringify(presets));
            } else {
                // 保存为当前配置
                localStorage.setItem(this.currentPresetKey, JSON.stringify(config));
            }
            return true;
        } catch (error) {
            console.error('[PresetService] Failed to save preset:', error);
            return false;
        }
    }

    /**
     * 加载预设配置
     * @param {ParticleSystem} particleSystem - 粒子系统实例
     * @param {string} [presetName] - 预设名称，如果不提供则加载当前配置
     * @returns {boolean} 加载成功返回 true
     */
    loadPreset(particleSystem, presetName = null) {
        try {
            let config = null;
            
            if (presetName) {
                // 加载命名预设
                const presets = this.getAllPresets();
                config = presets[presetName];
            } else {
                // 加载当前配置
                const saved = localStorage.getItem(this.currentPresetKey);
                if (saved) {
                    config = JSON.parse(saved);
                }
            }
            
            if (config) {
                this.applyConfig(particleSystem, config);
                return true;
            }
            return false;
        } catch (error) {
            console.error('[PresetService] Failed to load preset:', error);
            return false;
        }
    }

    /**
     * 获取所有保存的预设
     * @returns {Object} 预设对象，键为预设名称
     */
    getAllPresets() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error('[PresetService] Failed to get presets:', error);
            return {};
        }
    }

    /**
     * 删除预设
     * @param {string} presetName - 预设名称
     * @returns {boolean} 删除成功返回 true
     */
    deletePreset(presetName) {
        try {
            const presets = this.getAllPresets();
            delete presets[presetName];
            localStorage.setItem(this.storageKey, JSON.stringify(presets));
            return true;
        } catch (error) {
            console.error('[PresetService] Failed to delete preset:', error);
            return false;
        }
    }

    /**
     * 检查是否有保存的配置
     * @returns {boolean} 如果有保存的配置返回 true
     */
    hasSavedConfig() {
        return localStorage.getItem(this.currentPresetKey) !== null;
    }

    /**
     * 清除所有预设
     */
    clearAllPresets() {
        try {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.currentPresetKey);
        } catch (error) {
            console.error('[PresetService] Failed to clear presets:', error);
        }
    }
}

