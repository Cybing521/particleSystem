/**
 * 手势校准服务
 * 提供手势灵敏度调整和校准功能
 */
export class GestureCalibrationService {
    constructor(handTracker) {
        this.handTracker = handTracker;
        this.calibrationSettings = {
            // 捏合检测灵敏度
            pinchSensitivity: 1.0, // 1.0 = 默认, >1.0 = 更敏感, <1.0 = 不敏感
            pinchMinDistance: 0.03, // 最小距离
            pinchMaxDistance: 0.15, // 最大距离
            
            // 手指检测灵敏度
            fingerSensitivity: 1.0,
            fingerThreshold: 0.02, // 手指检测阈值
            
            // 位置检测灵敏度
            positionSensitivity: 1.0,
            
            // 旋转检测灵敏度
            rotationSensitivity: 1.0,
            
            // 平滑度
            smoothingFactor: 0.2, // 插值系数，越小越平滑但响应越慢
        };
        
        this.defaultSettings = { ...this.calibrationSettings };
    }
    
    /**
     * 获取校准设置
     */
    getSettings() {
        return { ...this.calibrationSettings };
    }
    
    /**
     * 更新校准设置
     */
    updateSettings(newSettings) {
        Object.assign(this.calibrationSettings, newSettings);
        this.saveToLocalStorage();
        return this.calibrationSettings;
    }
    
    /**
     * 重置为默认设置
     */
    resetToDefaults() {
        this.calibrationSettings = { ...this.defaultSettings };
        this.saveToLocalStorage();
        return this.calibrationSettings;
    }
    
    /**
     * 应用校准设置到手部追踪器
     */
    applyToHandTracker() {
        // 将校准设置应用到 HandTracker
        // 注意：这需要 HandTracker 支持这些参数
        if (this.handTracker && typeof this.handTracker.setCalibrationSettings === 'function') {
            this.handTracker.setCalibrationSettings(this.calibrationSettings);
        }
    }
    
    /**
     * 保存到本地存储
     */
    saveToLocalStorage() {
        try {
            localStorage.setItem('gestureCalibration', JSON.stringify(this.calibrationSettings));
        } catch (e) {
            console.warn('[GestureCalibration] Failed to save to localStorage:', e);
        }
    }
    
    /**
     * 从本地存储加载
     */
    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('gestureCalibration');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.calibrationSettings = { ...this.defaultSettings, ...parsed };
                return true;
            }
        } catch (e) {
            console.warn('[GestureCalibration] Failed to load from localStorage:', e);
        }
        return false;
    }
    
    /**
     * 开始校准流程
     */
    startCalibration() {
        return {
            steps: [
                {
                    name: 'pinch',
                    title: '捏合检测校准',
                    description: '请张开和捏合手指，调整灵敏度直到检测准确',
                    testGesture: 'pinch'
                },
                {
                    name: 'fingers',
                    title: '手指计数校准',
                    description: '请依次伸出1-4根手指，确保计数准确',
                    testGesture: 'fingers'
                },
                {
                    name: 'position',
                    title: '位置检测校准',
                    description: '请移动手部到屏幕不同位置，检查位置跟踪是否准确',
                    testGesture: 'position'
                },
                {
                    name: 'rotation',
                    title: '旋转检测校准',
                    description: '请倾斜手部，检查旋转检测是否准确',
                    testGesture: 'rotation'
                }
            ]
        };
    }
}

