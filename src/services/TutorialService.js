/**
 * 教程与引导服务
 * 提供手势教程和实时提示功能
 */
export class TutorialService {
    constructor(handTracker, particleSystem) {
        this.handTracker = handTracker;
        this.particleSystem = particleSystem;
        this.currentTutorial = null;
        this.tutorialStep = 0;
        this.isActive = false;
        this.hints = [];
    }
    
    /**
     * 获取基础教程
     */
    getBasicTutorial() {
        return {
            title: '手势控制教程',
            steps: [
                {
                    id: 'enable-camera',
                    title: '启用摄像头',
                    description: '点击"启用摄像头"按钮启用摄像头，允许应用访问您的摄像头',
                    action: 'enableCamera',
                    icon: '📷'
                },
                {
                    id: 'left-hand-rotation',
                    title: '左手控制旋转',
                    description: '使用左手移动和倾斜来控制粒子系统的旋转',
                    gesture: 'leftHand',
                    icon: '👈'
                },
                {
                    id: 'right-hand-shape',
                    title: '右手控制形状',
                    description: '伸出1根手指切换为球体，伸出2根手指切换为心形，伸出3根手指切换为圆环',
                    gesture: 'fingers',
                    icon: '✋'
                },
                {
                    id: 'right-hand-scale',
                    title: '右手控制缩放',
                    description: '捏合手指缩小，张开手指放大粒子系统',
                    gesture: 'pinch',
                    icon: '🤏'
                },
                {
                    id: 'dual-hand',
                    title: '双手协同',
                    description: '同时使用双手可以同时控制旋转、形状和缩放',
                    gesture: 'dualHand',
                    icon: '👐'
                }
            ]
        };
    }
    
    /**
     * 开始教程
     */
    startTutorial(tutorialType = 'basic') {
        this.isActive = true;
        this.tutorialStep = 0;
        
        if (tutorialType === 'basic') {
            this.currentTutorial = this.getBasicTutorial();
        }
        
        return this.currentTutorial;
    }
    
    /**
     * 下一步
     */
    nextStep() {
        if (!this.currentTutorial) return null;
        
        if (this.tutorialStep < this.currentTutorial.steps.length - 1) {
            this.tutorialStep++;
            return this.currentTutorial.steps[this.tutorialStep];
        } else {
            this.completeTutorial();
            return null;
        }
    }
    
    /**
     * 上一步
     */
    previousStep() {
        if (!this.currentTutorial || this.tutorialStep === 0) return null;
        
        this.tutorialStep--;
        return this.currentTutorial.steps[this.tutorialStep];
    }
    
    /**
     * 获取当前步骤
     */
    getCurrentStep() {
        if (!this.currentTutorial) return null;
        return this.currentTutorial.steps[this.tutorialStep];
    }
    
    /**
     * 完成教程
     */
    completeTutorial() {
        this.isActive = false;
        this.currentTutorial = null;
        this.tutorialStep = 0;
    }
    
    /**
     * 取消教程
     */
    cancelTutorial() {
        this.completeTutorial();
    }
    
    /**
     * 显示实时提示
     */
    showHint(message, duration = 3000) {
        const hint = {
            id: Date.now(),
            message,
            duration,
            timestamp: Date.now()
        };
        
        this.hints.push(hint);
        
        // 自动移除
        setTimeout(() => {
            this.removeHint(hint.id);
        }, duration);
        
        return hint.id;
    }
    
    /**
     * 移除提示
     */
    removeHint(hintId) {
        this.hints = this.hints.filter(h => h.id !== hintId);
    }
    
    /**
     * 获取所有活动提示
     */
    getActiveHints() {
        const now = Date.now();
        return this.hints.filter(h => now - h.timestamp < h.duration);
    }
    
    /**
     * 根据手势状态生成提示
     */
    generateContextualHint() {
        if (!this.handTracker.isCameraEnabled()) {
            return '请启用摄像头以开始手势控制';
        }
        
        const leftHand = this.handTracker.getLeftHand();
        const rightHand = this.handTracker.getRightHand();
        
        if (!leftHand && !rightHand) {
            return '请将手放在摄像头前';
        }
        
        if (leftHand && !rightHand) {
            return '使用左手控制旋转，尝试伸出右手控制形状和缩放';
        }
        
        if (!leftHand && rightHand) {
            return '使用右手控制形状和缩放，尝试伸出左手控制旋转';
        }
        
        return '双手协同控制：左手旋转，右手形状和缩放';
    }
}

