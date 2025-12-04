import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export class HandTracker {
    constructor() {
        this.video = null;
        this.handLandmarker = null;
        this.lastVideoTime = -1;
        this.runningMode = 'VIDEO';
        this.stream = null;
        this.isTracking = false;
        this.predicting = false;

        // 0 = Closed, 1 = Open
        this.gestureState = 1.0;
        
        // Rotation values: -1 to 1
        this.rotationZ = 0.0; // Left (-1) to Right (+1)
        this.rotationX = 0.0; // Backward (-1) to Forward (+1)

        // Gesture toggle state
        this.gestureToggleCooldown = 0;
        this.lastToggleTime = 0;
        this.toggleCallback = null;

        // 帧率优化：自适应帧率控制
        this.frameSkipCounter = 0;
        this.frameSkipRate = 0; // 0 = 每帧都检测, 1 = 每2帧检测一次, 2 = 每3帧检测一次
        this.fpsHistory = [];
        this.fpsHistorySize = 30; // 记录最近30帧的FPS
        this.lastFrameTime = performance.now();
        this.targetFPS = 30; // 目标FPS
        this.adaptiveUpdateInterval = 60; // 每60帧更新一次自适应参数
        this.frameCounter = 0;

        // Don't auto-init, wait for user to enable camera
    }

    setToggleCallback(callback) {
        this.toggleCallback = callback;
    }

    async init() {
        await this.initHandLandmarker();
        // Camera setup will be done when user enables it
    }

    async enableCamera() {
        if (this.isTracking) {
            return; // Already enabled
        }
        
        if (!this.handLandmarker) {
            await this.initHandLandmarker();
        }
        
        await this.setupCamera();
        this.isTracking = true;
    }

    disableCamera() {
        if (!this.isTracking) {
            return; // Already disabled
        }
        
        this.isTracking = false;
        this.predicting = false;
        
        // Stop video stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        // Remove video element
        if (this.video) {
            if (this.video.srcObject) {
                this.video.srcObject = null;
            }
            if (this.video.parentNode) {
                this.video.parentNode.removeChild(this.video);
            }
            this.video = null;
        }
        
        // Reset gesture state
        this.gestureState = 1.0;
        this.rotationZ = 0.0;
        this.rotationX = 0.0;
        this.fingers = 0;
        this.position = { x: 0.5, y: 0.5 };
    }

    isCameraEnabled() {
        return this.isTracking;
    }

    async initHandLandmarker() {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
            );

            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: 'VIDEO',
                numHands: 1
            });
            console.log('HandTracker Initialized');
        } catch (error) {
            console.error("Failed to initialize MediaPipe:", error);
        }
    }

    async setupCamera() {
        this.video = document.createElement('video');
        this.video.setAttribute('autoplay', '');
        this.video.setAttribute('playsinline', '');
        this.video.style.display = 'none';
        document.body.appendChild(this.video);

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.video.srcObject = this.stream;
            this.video.addEventListener('loadeddata', () => {
                if (this.isTracking) {
                    this.predict();
                }
            });
        } catch (err) {
            console.error('Error accessing webcam:', err);
            this.isTracking = false;
            throw err; // Re-throw so UI can handle it
        }
    }

    async predict() {
        if (!this.isTracking || this.predicting) {
            return;
        }
        
        // 帧率优化：计算当前FPS并更新自适应参数
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        const currentFPS = deltaTime > 0 ? 1000 / deltaTime : 60;
        this.lastFrameTime = currentTime;
        
        // 更新FPS历史记录
        this.fpsHistory.push(currentFPS);
        if (this.fpsHistory.length > this.fpsHistorySize) {
            this.fpsHistory.shift();
        }
        
        // 每N帧更新一次自适应参数
        this.frameCounter++;
        if (this.frameCounter >= this.adaptiveUpdateInterval) {
            this.updateAdaptiveFrameRate();
            this.frameCounter = 0;
        }
        
        // 帧跳过机制：根据frameSkipRate决定是否跳过当前帧
        if (this.frameSkipCounter < this.frameSkipRate) {
            this.frameSkipCounter++;
            this.predicting = false;
            if (this.isTracking) {
                requestAnimationFrame(() => this.predict());
            }
            return;
        }
        
        // 重置跳过计数器
        this.frameSkipCounter = 0;
        this.predicting = true;
        
        if (this.video && this.video.readyState >= 2 && this.handLandmarker) {
            if (this.video.currentTime !== this.lastVideoTime) {
                this.lastVideoTime = this.video.currentTime;
                
                const results = this.handLandmarker.detectForVideo(this.video, currentTime);
                
                // Process results
                let processedData = null;
                if (results.landmarks && results.landmarks.length > 0) {
                    const landmarks = results.landmarks[0];
                    processedData = this.analyzeHand(landmarks);
                }
                
                this.processResults(processedData);
            }
        }
        
        this.predicting = false;
        
        if (this.isTracking) {
            requestAnimationFrame(() => this.predict());
        }
    }

    // 自适应帧率更新：根据性能动态调整检测频率
    updateAdaptiveFrameRate() {
        if (this.fpsHistory.length < 10) {
            return; // 数据不足，不调整
        }
        
        // 计算平均FPS
        const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
        
        // 根据FPS调整帧跳过率
        // 如果FPS低于目标值，增加跳过率以降低检测频率
        if (avgFPS < this.targetFPS * 0.8) {
            // 性能较差，增加跳过率（最多每3帧检测一次）
            this.frameSkipRate = Math.min(2, this.frameSkipRate + 1);
        } else if (avgFPS > this.targetFPS * 1.2) {
            // 性能良好，减少跳过率（尝试每帧都检测）
            this.frameSkipRate = Math.max(0, this.frameSkipRate - 1);
        }
        
        // 调试输出（可选）
        if (Math.random() < 0.01) {
            console.log(`[HandTracker] Adaptive FPS: ${avgFPS.toFixed(1)}, Skip Rate: ${this.frameSkipRate}`);
        }
    }

    analyzeHand(landmarks) {
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
        let fingers = 0;

        // Index
        if (landmarks[8].y < landmarks[6].y) fingers++;
        // Middle
        if (landmarks[12].y < landmarks[10].y) fingers++;
        // Ring
        if (landmarks[16].y < landmarks[14].y) fingers++;
        // Pinky
        if (landmarks[20].y < landmarks[18].y) fingers++;

        // 4. Hand Rotation Detection
        // Left/Right Rotation (Roll): Calculate hand tilt angle
        const wrist = landmarks[0];
        const middleMCP = landmarks[9];
        const indexMCP = landmarks[5];
        
        // Calculate hand direction vector (from wrist to middle of hand)
        const handVectorX = middleMCP.x - wrist.x;
        const handVectorY = middleMCP.y - wrist.y;
        
        // Calculate angle of hand orientation
        let handAngle = Math.atan2(handVectorY, handVectorX);
        handAngle -= Math.PI / 2;
        
        // Convert to rotation value: -1 (left tilt) to 1 (right tilt)
        let rotationZ = handAngle / (Math.PI / 3);
        rotationZ = Math.max(-1, Math.min(1, rotationZ));
        
        // Alternative: Use index finger direction for more stable detection
        const indexVectorX = indexMCP.x - wrist.x;
        const indexVectorY = indexMCP.y - wrist.y;
        let indexAngle = Math.atan2(indexVectorY, indexVectorX) - Math.PI / 2;
        let rotationZAlt = indexAngle / (Math.PI / 3);
        rotationZAlt = Math.max(-1, Math.min(1, rotationZAlt));
        
        // Average both for stability
        rotationZ = (rotationZ + rotationZAlt) / 2;

        // Forward/Backward Tilt (Pitch): Use Z depth difference
        const avgFingerZ = (
            landmarks[8].z +  // Index tip
            landmarks[12].z + // Middle tip
            landmarks[16].z + // Ring tip
            landmarks[20].z   // Pinky tip
        ) / 4;
        const wristZ = wrist.z;
        let rotationX = (wristZ - avgFingerZ) * 3;
        rotationX = Math.max(-1, Math.min(1, rotationX));

        return {
            pinch: pinch,
            position: center,
            fingers: fingers,
            rotationZ: rotationZ,
            rotationX: rotationX
        };
    }

    processResults(data) {
        const currentTime = Date.now();
        
        if (data) {
            // Smooth the pinch value with faster response
            this.gestureState += (data.pinch - this.gestureState) * 0.2;

            this.fingers = data.fingers;
            this.position = data.position;
            
            // Smooth rotation values with faster response
            if (data.rotationZ !== undefined) {
                this.rotationZ += (data.rotationZ - this.rotationZ) * 0.25;
            }
            if (data.rotationX !== undefined) {
                this.rotationX += (data.rotationX - this.rotationX) * 0.25;
            }
            
            // Gesture toggle: Closed fist (all fingers down) for 1 second toggles camera
            // Check if all 4 fingers are closed (fingers === 0) and hand is closed (pinch < 0.3)
            if (data.fingers === 0 && data.pinch < 0.3) {
                this.gestureToggleCooldown += 16; // Approximate frame time
                
                // If held for 1 second (1000ms) and callback exists
                if (this.gestureToggleCooldown >= 1000 && this.toggleCallback && 
                    currentTime - this.lastToggleTime > 2000) { // 2 second cooldown
                    this.toggleCallback();
                    this.lastToggleTime = currentTime;
                    this.gestureToggleCooldown = 0;
                }
            } else {
                // Reset cooldown if gesture is released
                this.gestureToggleCooldown = 0;
            }
            
            // Debug output (can be removed later)
            if (Math.random() < 0.01) { // Log occasionally to avoid spam
                console.log('Hand detected:', {
                    pinch: this.gestureState.toFixed(2),
                    fingers: this.fingers,
                    position: { x: this.position.x.toFixed(2), y: this.position.y.toFixed(2) },
                    rotationZ: this.rotationZ.toFixed(2),
                    rotationX: this.rotationX.toFixed(2)
                });
            }
        } else {
            // Default to open if no hand detected
            this.gestureState += (1.0 - this.gestureState) * 0.05;
            this.fingers = 0;
            this.position = { x: 0.5, y: 0.5 };
            // Smoothly return rotation to center
            this.rotationZ += (0 - this.rotationZ) * 0.1;
            this.rotationX += (0 - this.rotationX) * 0.1;
            // Reset gesture toggle cooldown
            this.gestureToggleCooldown = 0;
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

    getRotationZ() {
        return this.rotationZ || 0.0;
    }

    getRotationX() {
        return this.rotationX || 0.0;
    }
}
