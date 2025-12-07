/**
 * 手势检测服务（模块化重构）
 * 将手势检测抽象为独立的服务，提供统一的接口和错误处理
 * 
 * @class GestureService
 */
export class GestureService {
    /**
     * 创建 GestureService 实例
     * @param {HandTracker} handTracker - HandTracker 实例
     */
    constructor(handTracker) {
        this.handTracker = handTracker;
        this.isInitialized = false;
        this.errorHandlers = [];
        this.gestureCallbacks = new Map();
        this.recoveryAttempts = 0;
        this.maxRecoveryAttempts = 3;
    }
    
    /**
     * 初始化服务
     * @returns {Promise<boolean>} 初始化成功返回 true，失败返回 false
     */
    async initialize() {
        try {
            await this.handTracker.init();
            this.isInitialized = true;
            this.recoveryAttempts = 0;
            return true;
        } catch (error) {
            this.handleError('initialization', error);
            return false;
        }
    }
    
    /**
     * 启用摄像头
     * @returns {Promise<boolean>} 启用成功返回 true，失败返回 false
     */
    async enableCamera() {
        try {
            await this.handTracker.enableCamera();
            this.recoveryAttempts = 0;
            return true;
        } catch (error) {
            this.handleError('camera', error);
            // 尝试恢复
            return await this.attemptRecovery('camera');
        }
    }
    
    /**
     * 禁用摄像头
     * @returns {boolean} 禁用成功返回 true，失败返回 false
     */
    disableCamera() {
        try {
            this.handTracker.disableCamera();
            return true;
        } catch (error) {
            this.handleError('camera', error);
            return false;
        }
    }
    
    /**
     * 获取手势数据
     * @returns {Object|null} 手势数据对象，如果未初始化则返回 null
     * @returns {Object} returns.leftHand - 左手数据
     * @returns {Object} returns.rightHand - 右手数据
     * @returns {boolean} returns.isTracking - 是否正在追踪
     */
    getGestureData() {
        if (!this.isInitialized) {
            return null;
        }
        
        try {
            return {
                leftHand: this.handTracker.getLeftHand(),
                rightHand: this.handTracker.getRightHand(),
                isTracking: this.handTracker.isCameraEnabled()
            };
        } catch (error) {
            this.handleError('getGestureData', error);
            return null;
        }
    }
    
    /**
     * 注册手势回调
     * @param {string} gestureType - 手势类型
     * @param {Function} callback - 回调函数
     */
    onGesture(gestureType, callback) {
        if (!this.gestureCallbacks.has(gestureType)) {
            this.gestureCallbacks.set(gestureType, []);
        }
        this.gestureCallbacks.get(gestureType).push(callback);
    }
    
    /**
     * 移除手势回调
     * @param {string} gestureType - 手势类型
     * @param {Function} callback - 要移除的回调函数
     */
    offGesture(gestureType, callback) {
        if (this.gestureCallbacks.has(gestureType)) {
            const callbacks = this.gestureCallbacks.get(gestureType);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    /**
     * 触发手势事件
     * @param {string} gestureType - 手势类型
     * @param {*} data - 事件数据
     */
    triggerGesture(gestureType, data) {
        if (this.gestureCallbacks.has(gestureType)) {
            this.gestureCallbacks.get(gestureType).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[GestureService] Error in gesture callback for ${gestureType}:`, error);
                }
            });
        }
    }
    
    /**
     * 注册错误处理器
     * @param {Function} handler - 错误处理函数，接收 errorInfo 参数
     */
    onError(handler) {
        this.errorHandlers.push(handler);
    }
    
    /**
     * 移除错误处理器
     * @param {Function} handler - 要移除的错误处理函数
     */
    offError(handler) {
        const index = this.errorHandlers.indexOf(handler);
        if (index > -1) {
            this.errorHandlers.splice(index, 1);
        }
    }
    
    /**
     * 处理错误
     * @param {string} context - 错误上下文
     * @param {Error} error - 错误对象
     */
    handleError(context, error) {
        const errorInfo = {
            context,
            error,
            timestamp: Date.now(),
            recoveryAttempts: this.recoveryAttempts
        };
        
        console.error(`[GestureService] Error in ${context}:`, error);
        
        // 调用所有错误处理器
        this.errorHandlers.forEach(handler => {
            try {
                handler(errorInfo);
            } catch (e) {
                console.error('[GestureService] Error in error handler:', e);
            }
        });
    }
    
    /**
     * 尝试恢复
     * @param {string} context - 恢复上下文（'camera' 或 'initialization'）
     * @returns {Promise<boolean>} 恢复成功返回 true，失败返回 false
     */
    async attemptRecovery(context) {
        if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
            console.warn(`[GestureService] Max recovery attempts reached for ${context}`);
            return false;
        }
        
        this.recoveryAttempts++;
        console.log(`[GestureService] Attempting recovery (${this.recoveryAttempts}/${this.maxRecoveryAttempts}) for ${context}`);
        
        try {
            // 根据上下文尝试不同的恢复策略
            if (context === 'camera') {
                // 等待一段时间后重试
                await new Promise(resolve => setTimeout(resolve, 1000));
                return await this.enableCamera();
            } else if (context === 'initialization') {
                // 重新初始化
                await new Promise(resolve => setTimeout(resolve, 1000));
                return await this.initialize();
            }
        } catch (error) {
            this.handleError('recovery', error);
            return false;
        }
        
        return false;
    }
    
    /**
     * 重置恢复尝试计数
     */
    resetRecoveryAttempts() {
        this.recoveryAttempts = 0;
    }
    
    /**
     * 获取服务状态
     * @returns {Object} 服务状态对象
     * @returns {boolean} returns.isInitialized - 是否已初始化
     * @returns {boolean} returns.isTracking - 是否正在追踪
     * @returns {number} returns.recoveryAttempts - 恢复尝试次数
     * @returns {boolean} returns.hasError - 是否有错误
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isTracking: this.handTracker?.isCameraEnabled() || false,
            recoveryAttempts: this.recoveryAttempts,
            hasError: this.recoveryAttempts >= this.maxRecoveryAttempts
        };
    }
}

