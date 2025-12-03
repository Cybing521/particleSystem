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

    processResults(results) {
        if (results && results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];

            // Thumb tip (4) and Index tip (8)
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];

            // Calculate distance
            const distance = Math.sqrt(
                Math.pow(thumbTip.x - indexTip.x, 2) +
                Math.pow(thumbTip.y - indexTip.y, 2) +
                Math.pow(thumbTip.z - indexTip.z, 2)
            );

            // Normalize distance
            const min = 0.03;
            const max = 0.15;
            let normalized = (distance - min) / (max - min);
            normalized = Math.max(0, Math.min(1, normalized));

            // Smooth the value
            this.gestureState += (normalized - this.gestureState) * 0.1;
        } else {
            // Default to open if no hand detected
            this.gestureState += (1.0 - this.gestureState) * 0.05;
        }
    }

    getGestureState() {
        return this.gestureState;
    }
}
