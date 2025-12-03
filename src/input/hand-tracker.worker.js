import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

let handLandmarker = null;
let lastVideoTime = -1;

self.onmessage = async (e) => {
    const { type, data } = e.data;

    if (type === 'init') {
        await initHandLandmarker();
        self.postMessage({ type: 'initialized' });
    } else if (type === 'detect') {
        if (handLandmarker) {
            const { videoBitmap, timestamp } = data;
            if (timestamp !== lastVideoTime) {
                lastVideoTime = timestamp;
                const results = handLandmarker.detectForVideo(videoBitmap, timestamp);
                self.postMessage({ type: 'results', results });
                // Bitmap needs to be closed to release memory
                videoBitmap.close();
            } else {
                videoBitmap.close();
            }
        }
    }
};

async function initHandLandmarker() {
    try {
        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
        );

        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: 'VIDEO',
            numHands: 1
        });
    } catch (error) {
        console.error("Worker: Failed to initialize MediaPipe:", error);
    }
}
