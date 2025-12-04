/**
 * 手势检测服务（模块化重构）
 * 将手势检测抽象为独立的服务，提供统一的接口和错误处理
 */
export class GestureService {
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
     */
    getGestureData() {
        if (!this.isInitialized) {
            return null;
        }
        
        try {
            return {
                leftHand: this.handTracker.getLeftHand(),
                rightHand: this.handTracker.getRightHand(),
                // 向后兼容
                gestureState: this.handTracker.getGestureState(),
                fingers: this.handTracker.getFingers(),
                position: this.handTracker.getPosition(),
                rotationZ: this.handTracker.getRotationZ(),
                rotationX: this.handTracker.getRotationX(),
                isTracking: this.handTracker.isCameraEnabled()
            };
        } catch (error) {
            this.handleError('getGestureData', error);
            return null;
        }
    }
    
    /**
     * 注册手势回调
     */
    onGesture(gestureType, callback) {
        if (!this.gestureCallbacks.has(gestureType)) {
            this.gestureCallbacks.set(gestureType, []);
        }
        this.gestureCallbacks.get(gestureType).push(callback);
    }
    
    /**
     * 移除手势回调
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
     */
    onError(handler) {
        this.errorHandlers.push(handler);
    }
    
    /**
     * 移除错误处理器
     */
    offError(handler) {
        const index = this.errorHandlers.indexOf(handler);
        if (index > -1) {
            this.errorHandlers.splice(index, 1);
        }
    }
    
    /**
     * 处理错误
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

