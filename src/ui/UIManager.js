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

        controls.innerHTML = `
            <div class="control-group">
                <h3>Shape</h3>
                <div class="shape-selector">
                    <button data-shape="sphere" class="active">Sphere</button>
                    <button data-shape="cube">Cube</button>
                    <button data-shape="torus">Torus</button>
                    <button data-shape="random">Cloud</button>
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
        `;

        this.container.appendChild(controls);
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
