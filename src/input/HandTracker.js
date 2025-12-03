import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export class HandTracker {
    constructor() {
        this.video = null;
        this.worker = null;
        this.lastVideoTime = -1;

        // 0 = Closed, 1 = Open
        this.gestureState = 1.0;

        this.init();
    }

    async init() {
        this.worker = new Worker(new URL('./hand-tracker.worker.js', import.meta.url), { type: 'module' });

        this.worker.onmessage = (e) => {
            const { type, results } = e.data;
            if (type === 'initialized') {
                console.log('HandTracker Worker Initialized');
                this.setupCamera();
            } else if (type === 'results') {
                this.processResults(results);
            }
        };

        this.worker.postMessage({ type: 'init' });
    }

    async setupCamera() {
        this.video = document.createElement('video');
        this.video.setAttribute('autoplay', '');
        this.video.setAttribute('playsinline', '');
        this.video.style.display = 'none';
        document.body.appendChild(this.video);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.video.srcObject = stream;
            this.video.addEventListener('loadeddata', () => {
                this.predict();
            });
        } catch (err) {
            console.error('Error accessing webcam:', err);
            alert("Camera access required for hand tracking!");
        }
    }

    async predict() {
        if (this.video.readyState >= 2 && this.video.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = this.video.currentTime;

            // Create a bitmap to send to the worker (efficient transfer)
            const videoBitmap = await createImageBitmap(this.video);

            this.worker.postMessage({
                type: 'detect',
                data: {
                    videoBitmap,
                    timestamp: performance.now()
                }
            }, [videoBitmap]); // Transfer ownership
        }
        requestAnimationFrame(() => this.predict());
    }

    processResults(data) {
        if (data) {
            // Smooth the pinch value
            this.gestureState += (data.pinch - this.gestureState) * 0.1;

            this.fingers = data.fingers;
            this.position = data.position;
        } else {
            // Default to open if no hand detected
            this.gestureState += (1.0 - this.gestureState) * 0.05;
            this.fingers = 0;
            this.position = { x: 0.5, y: 0.5 };
        }
    }

    getGestureState() {
        return this.gestureState;
    }

    getFingers() {
        return this.fingers || 0;
    }

    getPosition() {
        return this.position || { x: 0.5, y: 0.5 };
    }
}
