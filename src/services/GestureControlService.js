/**
 * 手势控制服务
 * 管理手势的启用/禁用状态
 */
export class GestureControlService {
    constructor() {
        // 手势禁用状态（true = 禁用，false = 启用）
        this.disabledGestures = {
            rotation: false,      // 旋转控制（包括位置控制的旋转）
            scale: false,         // 缩放控制
            shape: false          // 形状切换
        };
        
        // 加载保存的设置
        this.loadSettings();
    }
    
    /**
     * 设置手势的启用/禁用状态
     */
    setGestureEnabled(gesture, enabled) {
        if (Object.prototype.hasOwnProperty.call(this.disabledGestures, gesture)) {
            this.disabledGestures[gesture] = !enabled; // 反转逻辑：disabledGestures存储的是禁用状态
            this.saveSettings();
            return true;
        }
        return false;
    }
    
    /**
     * 检查手势是否启用
     */
    isGestureEnabled(gesture) {
        if (!Object.prototype.hasOwnProperty.call(this.disabledGestures, gesture)) {
            return true; // 默认启用未知手势
        }
        return !this.disabledGestures[gesture];
    }
    
    /**
     * 获取所有手势状态
     */
    getAllGestures() {
        return {
            rotation: this.isGestureEnabled('rotation'),
            scale: this.isGestureEnabled('scale'),
            shape: this.isGestureEnabled('shape')
        };
    }
    
    /**
     * 重置所有手势为启用状态
     */
    resetAllGestures() {
        Object.keys(this.disabledGestures).forEach(key => {
            this.disabledGestures[key] = false;
        });
        this.saveSettings();
    }
    
    /**
     * 保存设置到本地存储
     */
    saveSettings() {
        try {
            localStorage.setItem('gestureControlSettings', JSON.stringify(this.disabledGestures));
        } catch (e) {
            console.warn('[GestureControlService] Failed to save settings:', e);
        }
    }
    
    /**
     * 从本地存储加载设置
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('gestureControlSettings');
            if (saved) {
                const parsed = JSON.parse(saved);
                // 合并保存的设置，确保所有手势都有值
                Object.keys(this.disabledGestures).forEach(key => {
                    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
                        this.disabledGestures[key] = parsed[key];
                    }
                });
            }
        } catch (e) {
            console.warn('[GestureControlService] Failed to load settings:', e);
        }
    }
}

