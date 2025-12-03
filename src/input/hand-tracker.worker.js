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

                // Process results in worker to save main thread
                let processedData = null;
                if (results.landmarks && results.landmarks.length > 0) {
                    const landmarks = results.landmarks[0];
                    processedData = analyzeHand(landmarks);
                }

                self.postMessage({ type: 'results', results: processedData });
                videoBitmap.close();
            } else {
                videoBitmap.close();
            }
        }
    }
};

function analyzeHand(landmarks) {
    // 1. Pinch Detection (Thumb tip 4 - Index tip 8)
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const pinchDist = Math.sqrt(
        Math.pow(thumbTip.x - indexTip.x, 2) +
        Math.pow(thumbTip.y - indexTip.y, 2) +
        Math.pow(thumbTip.z - indexTip.z, 2)
    );

    // Normalize pinch (0.03 to 0.15)
    let pinch = (pinchDist - 0.03) / (0.15 - 0.03);
    pinch = Math.max(0, Math.min(1, pinch));

    // 2. Hand Centroid (Position)
    // Use Wrist(0) and Middle Knuckle(9) average for stable center
    const center = {
        x: (landmarks[0].x + landmarks[9].x) / 2,
        y: (landmarks[0].y + landmarks[9].y) / 2
    };

    // 3. Finger Counting
    // Tips: 8, 12, 16, 20. PIP joints: 6, 10, 14, 18.
    // Finger is open if Tip.y < PIP.y (assuming hand is upright)
    // Note: MediaPipe Y coordinates: 0 is top, 1 is bottom. So Tip < PIP means Tip is higher.
    let fingers = 0;

    // Index
    if (landmarks[8].y < landmarks[6].y) fingers++;
    // Middle
    if (landmarks[12].y < landmarks[10].y) fingers++;
    // Ring
    if (landmarks[16].y < landmarks[14].y) fingers++;
    // Pinky
    if (landmarks[20].y < landmarks[18].y) fingers++;

    // Thumb is tricky, check x distance relative to wrist
    // Simple check: if thumb tip is far from index knuckle
    // For now, let's stick to 4 fingers + thumb logic if needed, or just 4 fingers.
    // Let's add thumb if it's extended away.
    // A simple heuristic for thumb: compare Tip x to IP x (3)
    // Depending on hand side (left/right), this flips. 
    // For simplicity, we'll just count the 4 main fingers for shape switching.

    return {
        pinch: pinch,
        position: center,
        fingers: fingers
    };
}

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
