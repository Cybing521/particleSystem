/**
 * 数据可视化组件
 * 实时显示手势数据、性能监控和调试信息
 */
export class DataVisualization {
    constructor(handTracker, particleSystem) {
        this.handTracker = handTracker;
        this.particleSystem = particleSystem;
        this.container = document.getElementById('ui-container');
        this.panel = null;
        this.isVisible = false;
        this.updateInterval = null;
        
        // FPS tracking
        this.lastFrameTime = null;
        this.frameCount = 0;
        this.fps = 0;
        
        this.init();
    }
    
    init() {
        this.createPanel();
        this.attachToggle();
    }
    
    createPanel() {
        const panel = document.createElement('div');
        panel.className = 'data-visualization-panel';
        panel.id = 'data-viz-panel';
        panel.style.display = 'none';
        
        panel.innerHTML = `
            <div class="viz-header">
                <h3>数据监控</h3>
                <button class="viz-close">&times;</button>
            </div>
            <div class="viz-content">
                <div class="viz-section">
                    <h4>手势数据</h4>
                    <div class="viz-data">
                        <div class="viz-item">
                            <span class="viz-label">左手位置:</span>
                            <span class="viz-value" id="left-hand-pos">-</span>
                        </div>
                        <div class="viz-item">
                            <span class="viz-label">左手旋转Z:</span>
                            <span class="viz-value" id="left-hand-rotz">-</span>
                        </div>
                        <div class="viz-item">
                            <span class="viz-label">右手捏合:</span>
                            <span class="viz-value" id="right-hand-pinch">-</span>
                        </div>
                        <div class="viz-item">
                            <span class="viz-label">手指数量:</span>
                            <span class="viz-value" id="right-hand-fingers">-</span>
                        </div>
                        <div class="viz-item">
                            <span class="viz-label">摄像头状态:</span>
                            <span class="viz-value" id="camera-status">-</span>
                        </div>
                    </div>
                </div>
                
                <div class="viz-section">
                    <h4>性能监控</h4>
                    <div class="viz-data">
                        <div class="viz-item">
                            <span class="viz-label">FPS:</span>
                            <span class="viz-value" id="fps-value">-</span>
                        </div>
                        <div class="viz-item">
                            <span class="viz-label">粒子数量:</span>
                            <span class="viz-value" id="particle-count">-</span>
                        </div>
                        <div class="viz-item">
                            <span class="viz-label">粒子缩放:</span>
                            <span class="viz-value" id="particle-scale">-</span>
                        </div>
                        <div class="viz-item">
                            <span class="viz-label">当前形状:</span>
                            <span class="viz-value" id="particle-shape">-</span>
                        </div>
                    </div>
                </div>
                
                <div class="viz-section">
                    <h4>调试信息</h4>
                    <div class="viz-data">
                        <div class="viz-item">
                            <span class="viz-label">帧跳过率:</span>
                            <span class="viz-value" id="frame-skip">-</span>
                        </div>
                        <div class="viz-item">
                            <span class="viz-label">检测延迟:</span>
                            <span class="viz-value" id="detection-latency">-</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.container.appendChild(panel);
        this.panel = panel;
        
        // Close button
        panel.querySelector('.viz-close').addEventListener('click', () => {
            this.hide();
        });
    }
    
    attachToggle() {
        // Add toggle button to controls panel
        const controlsPanel = document.querySelector('.controls-panel .panel-content');
        if (controlsPanel) {
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'data-viz-toggle';
            toggleBtn.textContent = '数据监控';
            toggleBtn.className = 'data-viz-toggle-btn';
            
            const buttonRow = controlsPanel.querySelector('.button-row');
            if (buttonRow) {
                buttonRow.appendChild(toggleBtn);
            } else {
                const newRow = document.createElement('div');
                newRow.className = 'control-group button-row';
                newRow.appendChild(toggleBtn);
                controlsPanel.appendChild(newRow);
            }
            
            toggleBtn.addEventListener('click', () => {
                this.toggle();
            });
        }
    }
    
    show() {
        if (this.panel) {
            this.panel.style.display = 'block';
            this.isVisible = true;
            this.startUpdate();
        }
    }
    
    hide() {
        if (this.panel) {
            this.panel.style.display = 'none';
            this.isVisible = false;
            this.stopUpdate();
        }
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    startUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        // Reset FPS tracking
        this.lastFrameTime = null;
        this.frameCount = 0;
        this.fps = 0;
        
        // Start FPS tracking
        this.updateFPS();
        
        // Update every 100ms for smooth display
        this.updateInterval = setInterval(() => {
            this.update();
        }, 100);
        
        // Initial update
        this.update();
    }
    
    stopUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    update() {
        if (!this.isVisible || !this.panel) return;
        
        // Update gesture data
        const leftHand = this.handTracker.getLeftHand();
        const rightHand = this.handTracker.getRightHand();
        
        document.getElementById('left-hand-pos').textContent = 
            `(${leftHand.position.x.toFixed(2)}, ${leftHand.position.y.toFixed(2)})`;
        document.getElementById('left-hand-rotz').textContent = 
            leftHand.rotationZ.toFixed(3);
        document.getElementById('right-hand-pinch').textContent = 
            rightHand.gestureState.toFixed(3);
        document.getElementById('right-hand-fingers').textContent = 
            rightHand.fingers;
        document.getElementById('camera-status').textContent = 
            this.handTracker.isCameraEnabled() ? '已启用' : '已禁用';
        
        // Update performance data
        if (this.particleSystem && this.particleSystem.particles) {
            const scale = this.particleSystem.particles.scale.x;
            document.getElementById('particle-scale').textContent = 
                scale.toFixed(2) + 'x';
            document.getElementById('particle-shape').textContent = 
                this.particleSystem.getCurrentShape() || 'sphere';
            document.getElementById('particle-count').textContent = 
                this.particleSystem.count || '-';
        }
        
        // Update FPS (if available)
        this.updateFPS();
        
        // Update debug info
        if (this.handTracker.frameSkipRate !== undefined) {
            document.getElementById('frame-skip').textContent = 
                this.handTracker.frameSkipRate;
        }
    }
    
    updateFPS() {
        // Use requestAnimationFrame to track FPS more accurately
        const currentTime = performance.now();
        
        if (!this.lastFrameTime) {
            this.lastFrameTime = currentTime;
            this.frameCount = 0;
            return;
        }
        
        this.frameCount++;
        const elapsed = currentTime - this.lastFrameTime;
        
        if (elapsed >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / elapsed);
            this.frameCount = 0;
            this.lastFrameTime = currentTime;
        }
        
        // Update display
        const fpsElement = document.getElementById('fps-value');
        if (fpsElement) {
            fpsElement.textContent = this.fps + ' FPS';
        }
        
        // Continue tracking
        if (this.isVisible) {
            requestAnimationFrame(() => this.updateFPS());
        }
    }
    
    destroy() {
        this.stopUpdate();
        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
    }
}

