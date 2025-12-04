export class UIManager {
    constructor(particleSystem, handTracker) {
        this.particleSystem = particleSystem;
        this.handTracker = handTracker;
        this.container = document.getElementById('ui-container');

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
                <h2 class="panel-title">Controls</h2>
                <button id="collapse-btn" class="collapse-btn" title="Collapse/Expand">−</button>
            </div>
            <div class="panel-content">
                <div class="control-group">
                    <h3>Shape</h3>
                    <div class="shape-selector">
                        <button data-shape="sphere" class="active">Sphere</button>
                        <button data-shape="torus">Torus</button>
                    </div>
                </div>
                
                <div class="control-group">
                    <h3>Color</h3>
                    <div class="color-picker-wrapper">
                        <input type="color" id="color-picker" value="#222222">
                    </div>
                </div>

                <div class="control-group">
                    <h3>Custom Model</h3>
                    <div class="file-input-wrapper">
                        <label for="model-upload" class="custom-file-upload">
                            Upload .glb
                        </label>
                        <input type="file" id="model-upload" accept=".glb,.gltf">
                    </div>
                </div>

                <div class="control-group">
                    <button id="camera-toggle-btn" class="camera-btn">
                        <span class="camera-icon">📷</span>
                        <span class="camera-text">Enable Camera</span>
                    </button>
                </div>

                <div class="control-group">
                    <button id="fullscreen-btn">Fullscreen</button>
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
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        const header = panel.querySelector('.panel-header');
        header.style.cursor = 'move';
        header.style.userSelect = 'none';

        // Calculate drag boundaries (95% of screen centered)
        const getBoundaries = () => {
            const margin = 0.025; // 2.5% margin on each side = 95% total
            const minX = window.innerWidth * margin;
            const maxX = window.innerWidth * (1 - margin) - panel.offsetWidth;
            const minY = window.innerHeight * margin;
            const maxY = window.innerHeight * (1 - margin) - panel.offsetHeight;
            return { minX, maxX, minY, maxY };
        };

        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);

        function dragStart(e) {
            if (e.target.closest('button')) return; // Don't drag when clicking buttons
            
            const rect = panel.getBoundingClientRect();
            xOffset = rect.left;
            yOffset = rect.top;
            
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (e.target === header || header.contains(e.target)) {
                isDragging = true;
                panel.style.transition = 'none'; // Disable transition while dragging
            }
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                const boundaries = getBoundaries();
                
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                // Constrain to boundaries
                currentX = Math.max(boundaries.minX, Math.min(boundaries.maxX, currentX));
                currentY = Math.max(boundaries.minY, Math.min(boundaries.maxY, currentY));

                panel.style.left = currentX + 'px';
                panel.style.top = currentY + 'px';
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
            }
        }

        function dragEnd(e) {
            if (isDragging) {
                panel.style.transition = ''; // Re-enable transition
                isDragging = false;
            }
        }
        
        // Update boundaries on window resize
        window.addEventListener('resize', () => {
            if (!isDragging) {
                const boundaries = getBoundaries();
                const rect = panel.getBoundingClientRect();
                let x = rect.left;
                let y = rect.top;
                
                x = Math.max(boundaries.minX, Math.min(boundaries.maxX, x));
                y = Math.max(boundaries.minY, Math.min(boundaries.maxY, y));
                
                panel.style.left = x + 'px';
                panel.style.top = y + 'px';
            }
        });
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
        colorPicker.addEventListener('input', (e) => {
            this.particleSystem.setColor(e.target.value);
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
                    await this.handTracker.enableCamera();
                } catch (err) {
                    alert('无法访问摄像头。请确保已授予摄像头权限。');
                    console.error('Camera error:', err);
                }
            }
            this.updateCameraButton();
        };
        
        // Mouse click toggle
        cameraBtn.addEventListener('click', toggleCamera);
        
        // Gesture toggle: Set callback for hand tracker
        this.handTracker.setToggleCallback(toggleCamera);

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
    }

    updateCameraButton() {
        const cameraBtn = this.container.querySelector('#camera-toggle-btn');
        const cameraText = cameraBtn.querySelector('.camera-text');
        const cameraIcon = cameraBtn.querySelector('.camera-icon');
        
        if (this.handTracker.isCameraEnabled()) {
            cameraText.textContent = 'Disable Camera';
            cameraIcon.textContent = '📷';
            cameraBtn.classList.add('active');
        } else {
            cameraText.textContent = 'Enable Camera';
            cameraIcon.textContent = '📷';
            cameraBtn.classList.remove('active');
        }
    }
}
