import { GestureCalibrationService } from '../services/GestureCalibrationService.js';
import { TutorialService } from '../services/TutorialService.js';
import { GestureControlService } from '../services/GestureControlService.js';
import { PresetService } from '../services/PresetService.js';

/**
 * UI 管理器类
 * 负责创建和管理用户界面，包括控制面板、校准面板、教程等
 * 
 * @class UIManager
 */
export class UIManager {
    /**
     * 创建 UIManager 实例
     * @param {ParticleSystem} particleSystem - 粒子系统实例
     * @param {HandTracker} handTracker - 手势追踪器实例
     * @param {GestureService} [gestureService=null] - 手势服务实例（可选）
     */
    constructor(particleSystem, handTracker, gestureService = null) {
        this.particleSystem = particleSystem;
        this.handTracker = handTracker;
        this.gestureService = gestureService;
        this.container = document.getElementById('ui-container');
        
        // Initialize services
        this.calibrationService = new GestureCalibrationService(handTracker);
        this.tutorialService = new TutorialService(handTracker, particleSystem);
        this.gestureControlService = new GestureControlService(handTracker);
        this.presetService = new PresetService();
        
        // Load saved calibration
        this.calibrationService.loadFromLocalStorage();
        this.calibrationService.applyToHandTracker();

        this.init();
    }

    init() {
        this.createControls();
        this.attachListeners();
    }

    createControls() {
        const controls = document.createElement('div');
        controls.className = 'controls-panel';
        this.controlsPanel = controls;
        this.isCollapsed = false;

        controls.innerHTML = `
            <div class="panel-header">
                <h2 class="panel-title">控制面板</h2>
                <button id="collapse-btn" class="collapse-btn" title="折叠/展开">−</button>
            </div>
            <div class="panel-content">
                <div class="tab-container">
                    <div class="tab-buttons">
                        <button class="tab-btn active" data-tab="basic">基础设置</button>
                        <button class="tab-btn" data-tab="advanced">高级设置</button>
                        <button class="tab-btn" data-tab="gesture">手势控制</button>
                        <button class="tab-btn" data-tab="system">系统功能</button>
                    </div>
                    
                    <!-- 基础设置 Tab -->
                    <div class="tab-content active" id="tab-basic">
                        <div class="control-group">
                            <h3>形状</h3>
                            <div class="shape-selector">
                                <button data-shape="sphere" class="active">球体</button>
                                <button data-shape="heart">心形</button>
                                <button data-shape="torus">圆环</button>
                            </div>
                        </div>
                        
                        <div class="control-group">
                            <h3>颜色</h3>
                            <div class="color-picker-wrapper">
                                <input type="color" id="color-picker" value="#222222">
                            </div>
                            <div class="opacity-control">
                                <label>透明度: <span id="opacity-value">80</span>%</label>
                                <input type="range" id="opacity-slider" min="0" max="100" step="1" value="80">
                            </div>
                        </div>
                        
                        <div class="control-group">
                            <h3>粒子数量</h3>
                            <div class="particle-count-control">
                                <label>数量: <span id="particle-count-value">5000</span></label>
                                <input type="range" id="particle-count-slider" min="1000" max="10000" step="500" value="5000">
                            </div>
                        </div>
                    </div>
                    
                    <!-- 高级设置 Tab -->
                    <div class="tab-content" id="tab-advanced">
                        <div class="control-group">
                            <h3>分布方式</h3>
                            <div class="distribution-selector">
                                <button data-distribution="uniform" class="active">均匀</button>
                                <button data-distribution="random">随机</button>
                                <button data-distribution="clustered">聚集</button>
                            </div>
                        </div>
                        
                        <div class="control-group">
                            <h3>控制模式</h3>
                            <div class="mode-selector">
                                <button data-mode="normal" class="active">普通</button>
                                <button data-mode="boids">生物群落</button>
                            </div>
                        </div>

                        <div class="control-group">
                            <h3>自定义模型</h3>
                            <div class="file-input-wrapper">
                                <label for="model-upload" class="custom-file-upload">
                                    上传 .glb
                                </label>
                                <input type="file" id="model-upload" accept=".glb,.gltf">
                            </div>
                        </div>
                    </div>
                    
                    <!-- 手势控制 Tab -->
                    <div class="tab-content" id="tab-gesture">
                        <div class="control-group">
                            <button id="camera-toggle-btn" class="camera-btn">
                                <span class="camera-text">启用摄像头</span>
                            </button>
                            <div class="camera-hint">
                                若无法唤起摄像头：在浏览器地址栏允许权限；系统设置中为浏览器开启摄像头；手机端需在设置里为浏览器或微信等容器授予摄像头权限。
                            </div>
                        </div>

                        <div class="control-group">
                            <h3>手势控制</h3>
                            <div class="gesture-controls">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="gesture-rotation" checked>
                                    <span>旋转控制</span>
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="gesture-scale" checked>
                                    <span>缩放控制</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 系统功能 Tab -->
                    <div class="tab-content" id="tab-system">
                        <div class="control-group">
                            <h3>预设模式</h3>
                            <div class="preset-controls">
                                <button id="save-preset-btn" class="preset-btn">保存配置</button>
                                <button id="load-preset-btn" class="preset-btn" ${this.presetService.hasSavedConfig() ? '' : 'disabled'}>加载配置</button>
                            </div>
                        </div>
                        
                        <div class="control-group button-row">
                            <button id="calibration-btn">校准</button>
                            <button id="tutorial-btn">教程</button>
                            <button id="fullscreen-btn">全屏</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.container.appendChild(controls);
        this.setupDraggable();
        this.setupCollapsible();
    }

    setupDraggable() {
        const panel = this.controlsPanel;
        let isDragging = false;
        let initialMouseX = 0;
        let initialMouseY = 0;
        let initialPanelX = 0;
        let initialPanelY = 0;
        let hasSwitchedToTopLeft = false;

        const header = panel.querySelector('.panel-header');
        header.style.cursor = 'move';
        header.style.userSelect = 'none';

        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);

        function dragStart(e) {
            if (e.target.closest('button')) {return;} // Don't drag when clicking buttons

            if (e.target === header || header.contains(e.target)) {
                e.preventDefault(); // Prevent text selection
                isDragging = true;
                hasSwitchedToTopLeft = false;
                panel.style.transition = 'none'; // Disable transition while dragging
                
                // Store initial mouse position (viewport coordinates)
                initialMouseX = e.clientX;
                initialMouseY = e.clientY;
                
                // Get current panel position
                // Check if panel already has left/top set (already using top/left positioning)
                const currentLeft = parseFloat(panel.style.left);
                const currentTop = parseFloat(panel.style.top);
                
                if (!isNaN(currentLeft) && !isNaN(currentTop)) {
                    // Panel already using top/left positioning
                    initialPanelX = currentLeft;
                    initialPanelY = currentTop;
                    hasSwitchedToTopLeft = true;
                } else {
                    // Panel using bottom/left positioning, need to convert
                    // Get visual position from getBoundingClientRect (after transform)
                    const panelRect = panel.getBoundingClientRect();
                    const parentRect = panel.parentElement.getBoundingClientRect();
                    
                    // Visual position relative to parent (this is what we see on screen)
                    const visualLeft = panelRect.left - parentRect.left;
                    const visualTop = panelRect.top - parentRect.top;
                    
                    // Store visual position as initial CSS position
                    // Since transform-origin is "left bottom", the left edge doesn't move,
                    // so visual left = CSS left. For top, we use visual top directly.
                    initialPanelX = visualLeft;
                    initialPanelY = visualTop;
                }
            }
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                
                // On first drag, switch from bottom/left to top/left positioning if needed
                if (!hasSwitchedToTopLeft) {
                    // Switch to top/left positioning
                    panel.style.left = initialPanelX + 'px';
                    panel.style.top = initialPanelY + 'px';
                    panel.style.right = 'auto';
                    panel.style.bottom = 'auto';
                    
                    hasSwitchedToTopLeft = true;
                    
                    // Update initial panel position and mouse position for smooth dragging
                    const parentRect = panel.parentElement.getBoundingClientRect();
                    initialPanelX = parseFloat(panel.style.left);
                    initialPanelY = parseFloat(panel.style.top);
                    initialMouseX = e.clientX;
                    initialMouseY = e.clientY;
                    
                    // Return early - don't move panel on first drag, just switch positioning
                    return;
                }
                
                // Calculate mouse movement delta
                const deltaX = e.clientX - initialMouseX;
                const deltaY = e.clientY - initialMouseY;
                
                // Apply delta directly to CSS position
                // CSS left/top coordinates are not affected by transform scale
                const newX = initialPanelX + deltaX;
                const newY = initialPanelY + deltaY;

                // No boundaries - free dragging
                panel.style.left = newX + 'px';
                panel.style.top = newY + 'px';
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
            }
        }

        function dragEnd(e) {
            if (isDragging) {
                panel.style.transition = ''; // Re-enable transition
                isDragging = false;
                hasSwitchedToTopLeft = false;
            }
        }
    }

    setupCollapsible() {
        const collapseBtn = this.controlsPanel.querySelector('#collapse-btn');
        const panelContent = this.controlsPanel.querySelector('.panel-content');
        
        collapseBtn.addEventListener('click', () => {
            this.isCollapsed = !this.isCollapsed;
            
            if (this.isCollapsed) {
                // Collapse: macOS-style smooth animation
                // First, set maxHeight to current height
                panelContent.style.maxHeight = panelContent.scrollHeight + 'px';
                panelContent.style.opacity = '1';
                // Force reflow to apply the height
                panelContent.offsetHeight;
                // Then animate to 0
                requestAnimationFrame(() => {
                    panelContent.style.maxHeight = '0';
                    panelContent.style.opacity = '0';
                    panelContent.style.paddingTop = '0';
                    panelContent.style.paddingBottom = '0';
                });
                
                collapseBtn.textContent = '+';
                collapseBtn.title = 'Expand';
                
                // Smooth width transition
                const currentWidth = this.controlsPanel.offsetWidth;
                this.controlsPanel.style.width = currentWidth + 'px';
                // Force reflow
                this.controlsPanel.offsetHeight;
                this.controlsPanel.style.width = '200px';
            } else {
                // Expand: macOS-style smooth animation
                this.controlsPanel.style.width = '360px';
                panelContent.style.maxHeight = '0';
                panelContent.style.opacity = '0';
                panelContent.style.paddingTop = '0';
                panelContent.style.paddingBottom = '0';
                panelContent.style.display = 'flex'; // Ensure display is set
                
                // Force reflow
                panelContent.offsetHeight;
                
                // Then animate to full height
                requestAnimationFrame(() => {
                    const targetHeight = panelContent.scrollHeight;
                    panelContent.style.maxHeight = targetHeight + 'px';
                    panelContent.style.opacity = '1';
                    panelContent.style.paddingTop = '';
                    panelContent.style.paddingBottom = '';
                });
                
                collapseBtn.textContent = '−';
                collapseBtn.title = 'Collapse';
                
                // After animation, allow natural height
                setTimeout(() => {
                    if (!this.isCollapsed) {
                        panelContent.style.maxHeight = '';
                        panelContent.style.overflow = '';
                    }
                }, 350);
            }
        });
    }

    attachListeners() {
        // Shape Selection
        const buttons = this.container.querySelectorAll('.shape-selector button');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update UI
                buttons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                // Update System
                const shape = e.target.dataset.shape;
                this.particleSystem.setShape(shape);
            });
        });

        // Color Picker
        const colorPicker = this.container.querySelector('#color-picker');
        const opacitySlider = this.container.querySelector('#opacity-slider');
        const opacityValue = this.container.querySelector('#opacity-value');
        
        colorPicker.addEventListener('input', (e) => {
            const opacity = parseFloat(opacitySlider.value) / 100;
            this.particleSystem.setColor(e.target.value, opacity);
        });
        
        opacitySlider.addEventListener('input', (e) => {
            const opacity = parseFloat(e.target.value) / 100;
            opacityValue.textContent = e.target.value;
            this.particleSystem.setOpacity(opacity);
        });
        
        // Initialize opacity from particle system
        const currentOpacity = this.particleSystem.getOpacity();
        opacitySlider.value = Math.round(currentOpacity * 100);
        opacityValue.textContent = Math.round(currentOpacity * 100);
        
        // Particle Count Slider
        const particleCountSlider = this.container.querySelector('#particle-count-slider');
        const particleCountValue = this.container.querySelector('#particle-count-value');
        
        particleCountSlider.addEventListener('input', (e) => {
            const count = parseInt(e.target.value);
            particleCountValue.textContent = count;
            this.particleSystem.setParticleCount(count);
        });
        
        // Initialize particle count from particle system
        const currentCount = this.particleSystem.getParticleCount();
        particleCountSlider.value = currentCount;
        particleCountValue.textContent = currentCount;
        
        // Distribution Mode Selector
        const distributionButtons = this.container.querySelectorAll('.distribution-selector button');
        distributionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                distributionButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const mode = e.target.dataset.distribution;
                this.particleSystem.setDistributionMode(mode);
            });
        });
        
        // Initialize distribution mode
        const currentMode = this.particleSystem.getDistributionMode();
        const activeDistBtn = Array.from(distributionButtons).find(btn => btn.dataset.distribution === currentMode);
        if (activeDistBtn) {
            distributionButtons.forEach(b => b.classList.remove('active'));
            activeDistBtn.classList.add('active');
        }
        
        // Control Mode Selector
        const modeButtons = this.container.querySelectorAll('.mode-selector button');
        if (modeButtons.length > 0) {
            modeButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    modeButtons.forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    const mode = e.target.dataset.mode;
                    console.log('[UIManager] Mode button clicked, setting mode to:', mode);
                    this.particleSystem.setControlMode(mode);
                });
            });
        } else {
            console.warn('[UIManager] Mode selector buttons not found!');
        }
        
        // Tab切换功能
        const tabButtons = this.container.querySelectorAll('.tab-btn');
        const tabContents = this.container.querySelectorAll('.tab-content');
        
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                
                // 移除所有active类
                tabButtons.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                // 添加active类到当前tab
                btn.classList.add('active');
                const targetContent = this.container.querySelector(`#tab-${targetTab}`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
        
        // Gesture Control Checkboxes
        const gestureCheckboxes = {
            rotation: this.container.querySelector('#gesture-rotation'),
            scale: this.container.querySelector('#gesture-scale')
        };
        
        // Load saved gesture states
        const gestureStates = this.gestureControlService.getAllGestures();
        Object.keys(gestureCheckboxes).forEach(key => {
            if (gestureCheckboxes[key]) {
                gestureCheckboxes[key].checked = gestureStates[key] !== false;
                gestureCheckboxes[key].addEventListener('change', (e) => {
                    this.gestureControlService.setGesture(key, e.target.checked);
                });
            }
        });

        // Model Upload
        const modelUpload = this.container.querySelector('#model-upload');
        modelUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                this.particleSystem.loadModel(url);
            }
        });

        // Camera Toggle
        const cameraBtn = this.container.querySelector('#camera-toggle-btn');
        this.updateCameraButton();
        
        const toggleCamera = async () => {
            if (this.handTracker.isCameraEnabled()) {
                this.handTracker.disableCamera();
            } else {
                try {
                    // 显示加载状态
                    const cameraText = cameraBtn.querySelector('.camera-text');
                    const originalText = cameraText.textContent;
                    cameraText.textContent = '正在初始化...';
                    cameraBtn.disabled = true;
                    
                    await this.handTracker.enableCamera();
                } catch (err) {
                    console.error('Camera error:', err);
                    
                    const errorMessage = err.message || String(err);
                    const isModelError = errorMessage.includes('无法初始化手势识别模型') ||
                        errorMessage.includes('Failed to fetch') ||
                        errorMessage.includes('ERR_CONNECTION') ||
                        errorMessage.includes('NetworkError');
                    const isPermissionError = errorMessage.includes('Permission') ||
                        errorMessage.includes('NotAllowedError') ||
                        errorMessage.includes('权限');
                    const isDeviceError = errorMessage.includes('NotFoundError') ||
                        errorMessage.includes('没有找到');

                    const sections = [
                        {
                            title: '快速判断',
                            items: [
                                '若浏览器弹出“允许摄像头”被拒绝 → 属于摄像头权限问题',
                                '若提示无法访问 storage.googleapis.com → 属于模型加载/网络问题',
                                '若摄像头指示灯未亮且未弹权限 → 可能是设备占用或缺失'
                            ]
                        },
                        {
                            title: '模型加载 / 网络',
                            items: [
                                '确认当前网络能直接访问 https://storage.googleapis.com （无科学上网时会失败）',
                                '关闭可能拦截的防火墙/代理，或为浏览器单独配置可直连策略',
                                '刷新页面后重试；若仍失败可切换网络或临时使用 VPN'
                            ],
                            highlight: isModelError
                        },
                        {
                            title: '摄像头权限',
                            items: [
                                '在浏览器地址栏点击摄像头权限图标，允许本页面访问摄像头',
                                '系统偏好设置 > 隐私与安全性 > 摄像头，确认浏览器已勾选',
                                '刷新页面重新触发权限弹窗'
                            ],
                            highlight: isPermissionError
                        },
                        {
                            title: '设备或占用',
                            items: [
                                '检查摄像头是否被其他应用占用，关闭后重试',
                                '若为外接摄像头，确认连接正常或更换端口'
                            ],
                            highlight: isDeviceError
                        }
                    ];

                    this.showErrorModal({
                        title: '无法启动摄像头或加载手势模型',
                        summary: errorMessage,
                        sections
                    });
                } finally {
                    // 恢复按钮状态
                    cameraBtn.disabled = false;
                    this.updateCameraButton();
                }
            }
            this.updateCameraButton();
        };
        
        // Mouse click toggle
        cameraBtn.addEventListener('click', toggleCamera);
        
        // Gesture toggle: Set callback for hand tracker
        this.handTracker.setToggleCallback(toggleCamera);

        // Calibration
        const calibrationBtn = this.container.querySelector('#calibration-btn');
        calibrationBtn.addEventListener('click', () => {
            this.showCalibrationPanel();
        });

        // Tutorial
        const tutorialBtn = this.container.querySelector('#tutorial-btn');
        tutorialBtn.addEventListener('click', () => {
            this.showTutorial();
        });

        // Fullscreen
        const fsBtn = this.container.querySelector('#fullscreen-btn');
        fsBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        });

        // Preset controls
        const savePresetBtn = this.container.querySelector('#save-preset-btn');
        const loadPresetBtn = this.container.querySelector('#load-preset-btn');
        
        if (savePresetBtn) {
            savePresetBtn.addEventListener('click', () => {
                const success = this.presetService.savePreset(this.particleSystem);
                if (success) {
                    this.showNotification('配置已保存', 'success');
                    if (loadPresetBtn) {
                        loadPresetBtn.disabled = false;
                        loadPresetBtn.classList.remove('disabled');
                    }
                } else {
                    this.showNotification('保存失败', 'error');
                }
            });
        }
        
        if (loadPresetBtn) {
            loadPresetBtn.addEventListener('click', () => {
                const success = this.presetService.loadPreset(this.particleSystem);
                if (success) {
                    this.showNotification('配置已加载', 'success');
                    // 更新UI以反映加载的配置
                    this.updateUIFromParticleSystem();
                } else {
                    this.showNotification('加载失败：未找到保存的配置', 'error');
                }
            });
        }
        
        // Show contextual hints periodically
        this.startHintSystem();
    }
    
    showCalibrationPanel() {
        // Create calibration modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>手势校准</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="calibration-control">
                        <label>捏合灵敏度: <span id="pinch-sens-value">1.0</span></label>
                        <input type="range" id="pinch-sens" min="0.5" max="2.0" step="0.1" value="1.0">
                    </div>
                    <div class="calibration-control">
                        <label>手指检测灵敏度: <span id="finger-sens-value">1.0</span></label>
                        <input type="range" id="finger-sens" min="0.5" max="2.0" step="0.1" value="1.0">
                    </div>
                    <div class="calibration-control">
                        <label>位置检测灵敏度: <span id="pos-sens-value">1.0</span></label>
                        <input type="range" id="pos-sens" min="0.5" max="2.0" step="0.1" value="1.0">
                    </div>
                    <div class="calibration-control">
                        <label>旋转检测灵敏度: <span id="rot-sens-value">1.0</span></label>
                        <input type="range" id="rot-sens" min="0.5" max="2.0" step="0.1" value="1.0">
                    </div>
                    <div class="calibration-control">
                        <label>平滑度: <span id="smooth-value">0.2</span></label>
                        <input type="range" id="smooth" min="0.1" max="0.5" step="0.05" value="0.2">
                    </div>
                    <div class="calibration-control">
                        <button id="panel-reset-position" class="panel-reset-btn">重置控制面板位置</button>
                    </div>
                    <div class="modal-actions">
                        <button id="calibration-reset">重置为默认</button>
                        <button id="calibration-save">保存</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Load current settings
        const settings = this.calibrationService.getSettings();
        document.getElementById('pinch-sens').value = settings.pinchSensitivity;
        document.getElementById('finger-sens').value = settings.fingerSensitivity;
        document.getElementById('pos-sens').value = settings.positionSensitivity;
        document.getElementById('rot-sens').value = settings.rotationSensitivity;
        document.getElementById('smooth').value = settings.smoothingFactor;
        
        // Update value displays
        const updateValue = (id, value) => {
            document.getElementById(id + '-value').textContent = parseFloat(value).toFixed(1);
        };
        
        // Initialize display values with current settings
        updateValue('pinch-sens', settings.pinchSensitivity);
        updateValue('finger-sens', settings.fingerSensitivity);
        updateValue('pos-sens', settings.positionSensitivity);
        updateValue('rot-sens', settings.rotationSensitivity);
        updateValue('smooth', settings.smoothingFactor);
        
        document.getElementById('pinch-sens').addEventListener('input', (e) => {
            updateValue('pinch-sens', e.target.value);
        });
        document.getElementById('finger-sens').addEventListener('input', (e) => {
            updateValue('finger-sens', e.target.value);
        });
        document.getElementById('pos-sens').addEventListener('input', (e) => {
            updateValue('pos-sens', e.target.value);
        });
        document.getElementById('rot-sens').addEventListener('input', (e) => {
            updateValue('rot-sens', e.target.value);
        });
        document.getElementById('smooth').addEventListener('input', (e) => {
            updateValue('smooth', e.target.value);
        });
        
        // Save button
        document.getElementById('calibration-save').addEventListener('click', () => {
            const newSettings = {
                pinchSensitivity: parseFloat(document.getElementById('pinch-sens').value),
                fingerSensitivity: parseFloat(document.getElementById('finger-sens').value),
                positionSensitivity: parseFloat(document.getElementById('pos-sens').value),
                rotationSensitivity: parseFloat(document.getElementById('rot-sens').value),
                smoothingFactor: parseFloat(document.getElementById('smooth').value)
            };
            this.calibrationService.updateSettings(newSettings);
            this.calibrationService.applyToHandTracker();
            document.body.removeChild(modal);
        });
        
        // Reset button
        document.getElementById('calibration-reset').addEventListener('click', () => {
            this.calibrationService.resetToDefaults();
            const settings = this.calibrationService.getSettings();
            document.getElementById('pinch-sens').value = settings.pinchSensitivity;
            document.getElementById('finger-sens').value = settings.fingerSensitivity;
            document.getElementById('pos-sens').value = settings.positionSensitivity;
            document.getElementById('rot-sens').value = settings.rotationSensitivity;
            document.getElementById('smooth').value = settings.smoothingFactor;
            updateValue('pinch-sens', settings.pinchSensitivity);
            updateValue('finger-sens', settings.fingerSensitivity);
            updateValue('pos-sens', settings.positionSensitivity);
            updateValue('rot-sens', settings.rotationSensitivity);
            updateValue('smooth', settings.smoothingFactor);
        });
        
        // Reset panel position button
        document.getElementById('panel-reset-position').addEventListener('click', () => {
            this.resetPanelPosition();
        });
        
        // Close button
        modal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }
    
    showTutorial() {
        const tutorial = this.tutorialService.startTutorial('basic');
        if (!tutorial) {return;}
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content tutorial-modal">
                <div class="modal-header">
                    <h2>基础教程</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body tutorial-tabs">
                    <div class="tab-header">
                        <button class="tab-btn active" data-tab="guide">手势管理</button>
                        <button class="tab-btn" data-tab="issues">常见问题</button>
                        <button class="tab-btn" data-tab="contact">发送反馈</button>
                    </div>
                    <div class="tab-content" id="tutorial-tab-content"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const tabContent = modal.querySelector('#tutorial-tab-content');

        const renderGuideTab = () => {
            const step = this.tutorialService.getCurrentStep();
            const currentStep = this.tutorialService.tutorialStep + 1;
            const totalSteps = tutorial.steps.length;
            return `
                <div class="tutorial-step">
                    <div class="tutorial-icon">${step.icon}</div>
                    <h3 id="tutorial-step-title">${step.title}</h3>
                    <p id="tutorial-step-desc">${step.description}</p>
                    <div class="tutorial-progress">
                        <span id="tutorial-progress">${currentStep} / ${totalSteps}</span>
                    </div>
                    <div class="modal-actions">
                        <button id="tutorial-prev" ${currentStep === 1 ? 'disabled' : ''}>上一步</button>
                        <button id="tutorial-next">${currentStep === totalSteps ? '完成' : '下一步'}</button>
                        <button id="tutorial-skip">跳过</button>
                    </div>
                </div>
            `;
        };

        const renderIssuesTab = () => `
            <div class="issues-panel">
                <h3>常见问题 & 自检</h3>
                <div class="issue-card">
                    <div class="issue-title">模型加载失败</div>
                    <ul>
                        <li>确认能直接访问 https://storage.googleapis.com</li>
                        <li>若处于国内网络，请使用可直连的网络或开启科学上网</li>
                        <li>刷新页面或切换网络后重试</li>
                    </ul>
                </div>
                <div class="issue-card">
                    <div class="issue-title">摄像头无法启用</div>
                    <ul>
                        <li>在浏览器地址栏允许摄像头访问；系统隐私中为浏览器勾选摄像头</li>
                        <li>关闭占用摄像头的其他应用，或更换外接摄像头端口</li>
                        <li>若无权限弹窗且指示灯不亮，尝试重新插拔或重启浏览器</li>
                    </ul>
                </div>
                <div class="issue-card">
                    <div class="issue-title">画面卡顿</div>
                    <ul>
                        <li>降低粒子数量或关闭其他占用 GPU 的页面</li>
                        <li>切换到性能更好的浏览器（Chrome 109+）</li>
                    </ul>
                </div>
            </div>
        `;

        const renderContactTab = () => `
            <div class="contact-panel">
                <h3>发送反馈到 cyibin07@gmail.com</h3>
                <p class="contact-tip">不会外发任何隐私，仅用于排查问题。优先描述：当前网络环境、是否开启科学上网、错误提示、浏览器版本。</p>
                <label class="contact-label">您的邮箱（可选，便于回复）</label>
                <input type="email" id="contact-email" placeholder="you@example.com" />
                <label class="contact-label">问题描述</label>
                <textarea id="contact-message" rows="5" placeholder="请输入问题、复现步骤、截图链接等"></textarea>
                <button id="contact-send">发送邮件</button>
                <div class="contact-footer">发送将调用系统邮箱或 Gmail 客户端；若未自动唤起，请复制邮件手动发送。</div>
            </div>
        `;

        const switchTab = (tabId) => {
            const buttons = modal.querySelectorAll('.tab-btn');
            buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
            if (tabId === 'guide') {
                tabContent.innerHTML = renderGuideTab();
                bindGuideActions();
            } else if (tabId === 'issues') {
                tabContent.innerHTML = renderIssuesTab();
            } else {
                tabContent.innerHTML = renderContactTab();
                bindContactActions();
            }
        };

        const bindGuideActions = () => {
            const updateStep = () => {
                const step = this.tutorialService.getCurrentStep();
                if (!step) {
                    document.body.removeChild(modal);
                    return;
                }
                tabContent.innerHTML = renderGuideTab();
                bindGuideActions();
            };

            tabContent.querySelector('#tutorial-next')?.addEventListener('click', () => {
                const step = this.tutorialService.nextStep();
                if (step) {
                    updateStep();
                } else {
                    document.body.removeChild(modal);
                }
            });

            tabContent.querySelector('#tutorial-prev')?.addEventListener('click', () => {
                this.tutorialService.previousStep();
                updateStep();
            });

            tabContent.querySelector('#tutorial-skip')?.addEventListener('click', () => {
                this.tutorialService.cancelTutorial();
                document.body.removeChild(modal);
            });
        };

        const bindContactActions = () => {
            const sendBtn = tabContent.querySelector('#contact-send');
            sendBtn?.addEventListener('click', () => {
                const email = tabContent.querySelector('#contact-email').value.trim();
                const message = tabContent.querySelector('#contact-message').value.trim();
                const subject = encodeURIComponent('手势控制反馈');
                const envInfo = [
                    `UserAgent: ${navigator.userAgent}`,
                    `Language: ${navigator.language}`,
                    `Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
                ].join('\n');
                const body = encodeURIComponent(
                    `${message || '（请填写具体问题）'}\n\n------\n联系方式: ${email || '未提供'}\n${envInfo}`
                );
                const mailto = `mailto:cyibin07@gmail.com?subject=${subject}&body=${body}`;
                window.location.href = mailto;
            });
        };

        modal.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        switchTab('guide');

        modal.querySelector('.modal-close').addEventListener('click', () => {
            this.tutorialService.cancelTutorial();
            document.body.removeChild(modal);
        });
    }
    
    startHintSystem() {
        // Show contextual hints every 5 seconds
        setInterval(() => {
            if (this.tutorialService.isActive) {return;} // Don't show hints during tutorial
            
            const hint = this.tutorialService.generateContextualHint();
            if (hint) {
                this.showHint(hint);
            }
        }, 5000);
    }
    
    showHint(message) {
        const hint = document.createElement('div');
        hint.className = 'hint-message';
        hint.textContent = message;
        this.container.appendChild(hint);
        
        setTimeout(() => {
            hint.classList.add('fade-out');
            setTimeout(() => {
                if (hint.parentNode) {
                    hint.parentNode.removeChild(hint);
                }
            }, 300);
        }, 3000);
    }

    showErrorModal({ title, summary, sections = [] }) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content error-modal">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="error-summary">
                        <div class="error-label">错误详情</div>
                        <div class="error-text">${summary}</div>
                    </div>
                    <div class="error-section-list">
                        ${sections.map(section => `
                            <div class="error-section ${section.highlight ? 'highlight' : ''}">
                                <div class="error-section-title">${section.title}</div>
                                <ul>
                                    ${section.items.map(item => `<li>${item}</li>`).join('')}
                                </ul>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    updateCameraButton() {
        const cameraBtn = this.container.querySelector('#camera-toggle-btn');
        const cameraText = cameraBtn.querySelector('.camera-text');
        
        if (this.handTracker.isCameraEnabled()) {
            cameraText.textContent = '禁用摄像头';
            cameraBtn.classList.add('active');
        } else {
            cameraText.textContent = '启用摄像头';
            cameraBtn.classList.remove('active');
        }
    }
    
    updateShapeSelection(shape) {
        const buttons = this.container.querySelectorAll('.shape-selector button');
        buttons.forEach(btn => {
            if (btn.dataset.shape === shape) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    resetPanelPosition() {
        const panel = this.controlsPanel;
        // Reset to initial position (bottom: 12px, left: 12px)
        panel.style.left = '12px';
        panel.style.top = 'auto';
        panel.style.right = 'auto';
        panel.style.bottom = '12px';
        panel.style.transition = 'all 0.3s ease';
        
        // Remove transition after animation completes
        setTimeout(() => {
            panel.style.transition = '';
        }, 300);
    }

    /**
     * 更新UI以反映粒子系统的当前配置
     */
    updateUIFromParticleSystem() {
        // 更新形状选择
        const currentShape = this.particleSystem.getCurrentShape();
        this.updateShapeSelection(currentShape);
        
        // 更新颜色选择器
        const colorPicker = this.container.querySelector('#color-picker');
        if (colorPicker && this.particleSystem.baseColor) {
            const hex = this.particleSystem.baseColor.getHex();
            const hexColor = `#${hex.toString(16).padStart(6, '0')}`;
            colorPicker.value = hexColor;
        }
        
        // 更新透明度滑块
        const opacitySlider = this.container.querySelector('#opacity-slider');
        const opacityValue = this.container.querySelector('#opacity-value');
        const opacity = Math.round(this.particleSystem.getOpacity() * 100);
        opacitySlider.value = opacity;
        opacityValue.textContent = opacity;
        
        // 更新粒子数量滑块
        const particleCountSlider = this.container.querySelector('#particle-count-slider');
        const particleCountValue = this.container.querySelector('#particle-count-value');
        const count = this.particleSystem.getParticleCount();
        particleCountSlider.value = count;
        particleCountValue.textContent = count;
        
        // 更新分布模式
        const distributionMode = this.particleSystem.distributionMode;
        const distributionButtons = this.container.querySelectorAll('.distribution-selector button');
        distributionButtons.forEach(btn => {
            if (btn.dataset.distribution === distributionMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    /**
     * 显示通知消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 ('success', 'error', 'info')
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        this.container.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 2000);
    }
}
