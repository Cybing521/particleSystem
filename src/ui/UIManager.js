export class UIManager {
    constructor(particleSystem) {
        this.particleSystem = particleSystem;
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
}
