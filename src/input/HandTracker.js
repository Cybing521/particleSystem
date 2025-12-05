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

        // Left hand data (controls position and rotation)
        this.leftHand = {
            gestureState: 1.0,
            position: { x: 0.5, y: 0.5 },
            rotationZ: 0.0, // Left (-1) to Right (+1)
            rotationX: 0.0  // Backward (-1) to Forward (+1)
        };
        
        // Right hand data (controls shape and scale)
        this.rightHand = {
            gestureState: 1.0,
            fingers: 0,
            position: { x: 0.5, y: 0.5 }
        };
        
        // Finger detection state machine for stability
        this.fingerStateHistory = [];
        this.fingerStateHistorySize = 10; // Keep last 10 frames
        this.fingerStateThreshold = 7; // Need 7/10 frames to confirm change
        this.currentStableFingers = 0;
        this.fingerChangeCallback = null;

        // Legacy single hand support (for backward compatibility)
        this.gestureState = 1.0;
        this.rotationZ = 0.0;
        this.rotationX = 0.0;
        this.fingers = 0;
        this.position = { x: 0.5, y: 0.5 };

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
        
        // Calibration settings
        this.calibrationSettings = null;
    }
    
    /**
     * 设置校准参数
     */
    setCalibrationSettings(settings) {
        this.calibrationSettings = settings;
    }

    setToggleCallback(callback) {
        this.toggleCallback = callback;
    }
    
    setFingerChangeCallback(callback) {
        this.fingerChangeCallback = callback;
    }

    async init() {
        await this.initHandLandmarker();
        // Camera setup will be done when user enables it
    }

    async enableCamera() {
        if (this.isTracking) {
            console.log('[HandTracker] Camera already enabled');
            return; // Already enabled
        }
        
        console.log('[HandTracker] Enabling camera...');
        if (!this.handLandmarker) {
            console.log('[HandTracker] Initializing HandLandmarker...');
            await this.initHandLandmarker();
        }
        
        await this.setupCamera();
        this.isTracking = true;
        console.log('[HandTracker] Camera enabled, starting detection...');
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
        this.leftHand = {
            gestureState: 1.0,
            position: { x: 0.5, y: 0.5 },
            rotationZ: 0.0,
            rotationX: 0.0
        };
        this.rightHand = {
            gestureState: 1.0,
            fingers: 0,
            position: { x: 0.5, y: 0.5 }
        };
        // Legacy support
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
        const modelPath = `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`;
        const maxRetries = 3;
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[HandTracker] Initializing HandLandmarker (attempt ${attempt}/${maxRetries})...`);
                
                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
                );

                // Initialize Hand Landmarker (Full Model for high precision, support both hands)
                this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: modelPath,
                        delegate: "GPU"
                    },
                    runningMode: 'VIDEO',
                    numHands: 2, // Enable dual hand detection
                    minHandDetectionConfidence: 0.5,
                    minHandPresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });
                
                console.log('[HandTracker] Successfully initialized with MediaPipe Hand Landmarker (Full Model)');
                return; // 成功初始化，退出函数
            } catch (error) {
                lastError = error;
                const errorMsg = error.message || String(error);
                console.warn(`[HandTracker] Initialization attempt ${attempt} failed:`, errorMsg);
                
                // 检查是否是网络错误
                const isNetworkError = errorMsg.includes('Failed to fetch') || 
                                      errorMsg.includes('ERR_CONNECTION') ||
                                      errorMsg.includes('NetworkError') ||
                                      errorMsg.includes('network');
                
                if (isNetworkError && attempt < maxRetries) {
                    const delay = attempt * 1000; // 递增延迟：1s, 2s, 3s
                    console.log(`[HandTracker] Network error detected. Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                } else if (attempt < maxRetries) {
                    // 其他错误也重试
                    const delay = 500;
                    console.log(`[HandTracker] Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
            }
        }
        
        // 所有重试都失败了
        const errorMessage = lastError?.message || String(lastError) || 'Unknown error';
        const isNetworkError = errorMessage.includes('Failed to fetch') || 
                              errorMessage.includes('ERR_CONNECTION') ||
                              errorMessage.includes('NetworkError');
        
        let userFriendlyMessage = '无法初始化手势识别模型。';
        if (isNetworkError) {
            userFriendlyMessage += '\n\n可能的原因：\n' +
                '1. 网络连接问题：无法访问 Google Storage\n' +
                '2. 防火墙或代理设置阻止了连接\n' +
                '3. 请检查网络连接后重试\n\n' +
                '如果问题持续，请检查浏览器控制台获取更多信息。';
        } else {
            userFriendlyMessage += `\n\n错误详情：${errorMessage}`;
        }
        
        console.error('[HandTracker] Failed to initialize MediaPipe Hand Landmarker after all retries:', lastError);
        throw new Error(userFriendlyMessage);
    }

    async setupCamera() {
        this.video = document.createElement('video');
        this.video.setAttribute('autoplay', '');
        this.video.setAttribute('playsinline', '');
        this.video.style.display = 'none';
        document.body.appendChild(this.video);

        try {
            console.log('[HandTracker] Requesting camera access...');
            this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
            console.log('[HandTracker] Camera access granted');
            this.video.srcObject = this.stream;
            this.video.addEventListener('loadeddata', () => {
                console.log('[HandTracker] Video loaded, dimensions:', this.video.videoWidth, 'x', this.video.videoHeight);
                if (this.isTracking) {
                    console.log('[HandTracker] Starting prediction loop...');
                    this.predict();
                }
            });
            this.video.addEventListener('error', (err) => {
                console.error('[HandTracker] Video error:', err);
            });
        } catch (err) {
            console.error('[HandTracker] Error accessing webcam:', err);
            this.isTracking = false;
            throw err; // Re-throw so UI can handle it
        }
    }

    async predict() {
        if (!this.isTracking) {
            return;
        }
        
        if (this.predicting) {
            // Skip if already processing
            if (this.isTracking) {
                requestAnimationFrame(() => this.predict());
            }
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
        
        // Debug: Check video and handLandmarker state
        if (!this.video) {
            console.warn('[HandTracker] Video element not found');
            this.predicting = false;
            if (this.isTracking) {
                requestAnimationFrame(() => this.predict());
            }
            return;
        }
        
        if (this.video.readyState < 2) {
            // Video not ready yet
            this.predicting = false;
            if (this.isTracking) {
                requestAnimationFrame(() => this.predict());
            }
            return;
        }
        
        if (!this.handLandmarker) {
            console.warn('[HandTracker] HandLandmarker not initialized');
            this.predicting = false;
            if (this.isTracking) {
                requestAnimationFrame(() => this.predict());
            }
            return;
        }
        
        if (this.video.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = this.video.currentTime;
            
            try {
                // Run hand detection
                const handResults = this.handLandmarker.detectForVideo(this.video, currentTime);
                
                // Debug: Log detection results periodically
                if (Math.random() < 0.05) { // 5% chance to log
                    console.log('[HandTracker] Detection results:', {
                        hasResults: !!handResults,
                        landmarksCount: handResults?.landmarks?.length || 0,
                        videoTime: this.video.currentTime,
                        readyState: this.video.readyState
                    });
                }
                
                // Process hand results - support dual hands
                const landmarks = handResults.landmarks || [];
                const handedness = handResults.handedness || [];
                
                let leftHandData = null;
                let rightHandData = null;
                
                if (landmarks.length > 0) {
                    if (landmarks.length === 2) {
                        // Two hands detected - identify left and right using handedness
                        const identified = this.identifyHands(landmarks, handedness);
                        if (identified.left) {
                            leftHandData = this.analyzeHand(identified.left, 'left');
                        }
                        if (identified.right) {
                            rightHandData = this.analyzeHand(identified.right, 'right');
                        }
                        
                        // Debug: Log dual hand data periodically
                        if (leftHandData && rightHandData && Math.random() < 0.05) {
                            console.log('[HandTracker] Dual hands detected:', {
                                left: {
                                    position: { x: leftHandData.position.x.toFixed(2), y: leftHandData.position.y.toFixed(2) },
                                    rotationZ: leftHandData.rotationZ.toFixed(2)
                                },
                                right: {
                                    fingers: rightHandData.fingers,
                                    gestureState: rightHandData.pinch.toFixed(2)
                                }
                            });
                        }
                    } else if (landmarks.length === 1) {
                        // Single hand detected - keep functional split based on handedness
                        const handLabel = this.getHandLabel(handedness[0]) || null;
                        const handData = this.analyzeHand(landmarks[0], handLabel || 'unknown');
                        
                        if (handLabel === 'left') {
                            leftHandData = {
                                position: handData.position,
                                rotationZ: handData.rotationZ,
                                rotationX: handData.rotationX
                            };
                        } else {
                            // Treat unknown or explicit right as right-hand input (shape/scale)
                            rightHandData = {
                                pinch: handData.pinch,
                                fingers: handData.fingers,
                                position: handData.position
                            };
                        }
                    }
                }
                
                this.processDualHandResults(leftHandData, rightHandData);
            } catch (error) {
                console.error('[HandTracker] Detection error:', error);
                this.processResults(null);
            }
        }
        
        this.predicting = false;
        
        if (this.isTracking) {
            requestAnimationFrame(() => this.predict());
        }
    }

    getHandLabel(handednessEntry) {
        if (!handednessEntry || !handednessEntry.length) return null;
        const category = handednessEntry[0]?.categoryName || handednessEntry[0]?.displayName;
        if (!category) return null;
        const normalized = category.toLowerCase();
        if (normalized.includes('left')) return 'left';
        if (normalized.includes('right')) return 'right';
        return null;
    }

    identifyHands(landmarksArray, handedness = []) {
        const result = { left: null, right: null };

        // 1) Prefer MediaPipe handedness classification
        if (Array.isArray(handedness) && handedness.length === landmarksArray.length) {
            handedness.forEach((entry, idx) => {
                const label = this.getHandLabel(entry);
                if (label === 'left' && !result.left) {
                    result.left = landmarksArray[idx];
                } else if (label === 'right' && !result.right) {
                    result.right = landmarksArray[idx];
                }
            });
        }

        // If both hands already classified, return early
        if (result.left && result.right) {
            return result;
        }

        // 2) Fallback: spatial heuristic (mirrored preview does not affect handedness output)
        if (landmarksArray.length === 2) {
            const center1 = {
                x: (landmarksArray[0][0].x + landmarksArray[0][9].x) / 2,
                y: (landmarksArray[0][0].y + landmarksArray[0][9].y) / 2
            };
            const center2 = {
                x: (landmarksArray[1][0].x + landmarksArray[1][9].x) / 2,
                y: (landmarksArray[1][0].y + landmarksArray[1][9].y) / 2
            };

            if (!result.left && !result.right) {
                if (center1.x < center2.x) {
                    result.left = landmarksArray[0];
                    result.right = landmarksArray[1];
                } else {
                    result.left = landmarksArray[1];
                    result.right = landmarksArray[0];
                }
            } else if (!result.left) {
                result.left = result.right === landmarksArray[0] ? landmarksArray[1] : landmarksArray[0];
            } else if (!result.right) {
                result.right = result.left === landmarksArray[0] ? landmarksArray[1] : landmarksArray[0];
            }
        } else if (landmarksArray.length === 1) {
            // Single hand fallback: if we still cannot classify, treat it as right-hand (shape/scale) to avoid unwanted rotation
            if (!result.left && !result.right) {
                result.right = landmarksArray[0];
            }
        }

        return result;
    }

    analyzeHand(landmarks, handType = 'unknown') {
        // 1. Pinch Detection (Thumb tip 4 - Index tip 8)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const pinchDist = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) +
            Math.pow(thumbTip.y - indexTip.y, 2) +
            Math.pow(thumbTip.z - indexTip.z, 2)
        );

        // Normalize pinch with calibration settings (降低灵敏度：增加pinchSensitivity默认值)
        const pinchMin = this.calibrationSettings?.pinchMinDistance || 0.03;
        const pinchMax = this.calibrationSettings?.pinchMaxDistance || 0.15;
        const pinchSensitivity = this.calibrationSettings?.pinchSensitivity || 1.5; // 从1.0增加到1.5，降低灵敏度
        
        let pinch = (pinchDist - pinchMin) / (pinchMax - pinchMin);
        pinch = Math.max(0, Math.min(1, pinch));
        // Apply sensitivity (更高的sensitivity值会降低响应速度)
        pinch = Math.pow(pinch, 1.0 / pinchSensitivity);

        // 2. Hand Centroid (Position)
        // Use Wrist(0) and Middle Knuckle(9) average for stable center
        const center = {
            x: (landmarks[0].x + landmarks[9].x) / 2,
            y: (landmarks[0].y + landmarks[9].y) / 2
        };

        // 3. Finger Counting (Improved detection with better thresholds)
        // Tips: 8, 12, 16, 20. PIP joints: 6, 10, 14, 18.
        // Finger is open if Tip.y < PIP.y (assuming hand is upright)
        // Use a threshold to make detection more stable (降低灵敏度：增加阈值)
        const fingerThreshold = (this.calibrationSettings?.fingerThreshold || 0.03) * 
                                (this.calibrationSettings?.fingerSensitivity || 1.3); // 从0.02增加到0.03，sensitivity从1.0增加到1.3
        let fingers = 0;

        // Index - check if tip is significantly above PIP joint
        if (landmarks[8].y < landmarks[6].y - fingerThreshold) fingers++;
        // Middle
        if (landmarks[12].y < landmarks[10].y - fingerThreshold) fingers++;
        // Ring
        if (landmarks[16].y < landmarks[14].y - fingerThreshold) fingers++;
        // Pinky
        if (landmarks[20].y < landmarks[18].y - fingerThreshold) fingers++;

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

    processDualHandResults(leftHandData, rightHandData) {
        const currentTime = Date.now();
        
        // Process left hand data (position and rotation)
        if (leftHandData) {
            // Left hand: position and rotation (降低灵敏度：从0.2/0.25降到0.1/0.12)
            this.leftHand.position.x += (leftHandData.position.x - this.leftHand.position.x) * 0.1;
            this.leftHand.position.y += (leftHandData.position.y - this.leftHand.position.y) * 0.1;
            
            if (leftHandData.rotationZ !== undefined) {
                this.leftHand.rotationZ += (leftHandData.rotationZ - this.leftHand.rotationZ) * 0.12;
            }
            if (leftHandData.rotationX !== undefined) {
                this.leftHand.rotationX += (leftHandData.rotationX - this.leftHand.rotationX) * 0.12;
            }
        } else {
            // Smoothly return to center if no left hand
            this.leftHand.position.x += (0.5 - this.leftHand.position.x) * 0.1;
            this.leftHand.position.y += (0.5 - this.leftHand.position.y) * 0.1;
            this.leftHand.rotationZ += (0 - this.leftHand.rotationZ) * 0.1;
            this.leftHand.rotationX += (0 - this.leftHand.rotationX) * 0.1;
        }
        
        // Process right hand data (shape and scale)
        if (rightHandData) {
            // Right hand: gesture state (pinch) and fingers (降低灵敏度：从0.2降到0.1)
            this.rightHand.gestureState += (rightHandData.pinch - this.rightHand.gestureState) * 0.1;
            
            // Use state machine for finger detection to avoid jitter
            this.fingerStateHistory.push(rightHandData.fingers);
            if (this.fingerStateHistory.length > this.fingerStateHistorySize) {
                this.fingerStateHistory.shift();
            }
            
            // Count occurrences of each finger count in recent history
            const fingerCounts = {};
            this.fingerStateHistory.forEach(count => {
                fingerCounts[count] = (fingerCounts[count] || 0) + 1;
            });
            
            // Find the most common finger count
            let mostCommonFingers = this.currentStableFingers;
            let maxCount = 0;
            for (const [count, occurrences] of Object.entries(fingerCounts)) {
                if (occurrences > maxCount && occurrences >= this.fingerStateThreshold) {
                    maxCount = occurrences;
                    mostCommonFingers = parseInt(count);
                }
            }
            
            // Only update if we have a stable detection
            if (mostCommonFingers !== this.currentStableFingers && maxCount >= this.fingerStateThreshold) {
                const oldFingers = this.currentStableFingers;
                this.currentStableFingers = mostCommonFingers;
                this.rightHand.fingers = mostCommonFingers;
                
                // Notify callback if finger count changed
                if (this.fingerChangeCallback && oldFingers !== mostCommonFingers) {
                    this.fingerChangeCallback(mostCommonFingers);
                }
            } else {
                // Keep current stable value
                this.rightHand.fingers = this.currentStableFingers;
            }
            
            // Gesture toggle: Right hand closed fist for 1 second toggles camera
            // DISABLED: 暂时禁用握拳关闭摄像机功能
            // if (rightHandData.fingers === 0 && rightHandData.pinch < 0.3) {
            //     this.gestureToggleCooldown += 16;
            //     if (this.gestureToggleCooldown >= 1000 && this.toggleCallback && 
            //         currentTime - this.lastToggleTime > 2000) {
            //         console.log('[HandTracker] Gesture toggle triggered!');
            //         this.toggleCallback();
            //         this.lastToggleTime = currentTime;
            //         this.gestureToggleCooldown = 0;
            //     }
            // } else {
            //     this.gestureToggleCooldown = 0;
            // }
            this.gestureToggleCooldown = 0; // Reset cooldown
        } else {
            // Default to open if no right hand detected
            this.rightHand.gestureState += (1.0 - this.rightHand.gestureState) * 0.05;
            // Reset finger state history when no hand detected
            this.fingerStateHistory = [];
            this.currentStableFingers = 0;
            this.rightHand.fingers = 0;
            this.gestureToggleCooldown = 0;
        }
        
        // Legacy single hand support (use right hand if available, otherwise left hand)
        if (rightHandData) {
            this.gestureState = this.rightHand.gestureState;
            this.fingers = this.rightHand.fingers;
            this.position = rightHandData.position;
        } else if (leftHandData) {
            this.gestureState = 1.0; // Default open for left hand
            this.fingers = 0;
            this.position = this.leftHand.position;
            this.rotationZ = this.leftHand.rotationZ;
            this.rotationX = this.leftHand.rotationX;
        } else {
            // No hands detected
            this.gestureState += (1.0 - this.gestureState) * 0.05;
            this.fingers = 0;
            this.position = { x: 0.5, y: 0.5 };
            this.rotationZ += (0 - this.rotationZ) * 0.1;
            this.rotationX += (0 - this.rotationX) * 0.1;
        }
    }

    processResults(data) {
        // Legacy method for backward compatibility
        // Convert single hand data to dual hand format
        if (data) {
            this.processDualHandResults(null, data);
        } else {
            this.processDualHandResults(null, null);
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

    // Dual hand data getters
    getLeftHandData() {
        return {
            position: this.leftHand.position || { x: 0.5, y: 0.5 },
            rotationZ: this.leftHand.rotationZ || 0.0,
            rotationX: this.leftHand.rotationX || 0.0
        };
    }

    getRightHandData() {
        return {
            gestureState: this.rightHand.gestureState || 1.0,
            fingers: this.rightHand.fingers || 0,
            position: this.rightHand.position || { x: 0.5, y: 0.5 }
        };
    }

    // Alias methods for convenience (matching main.js usage)
    getLeftHand() {
        return this.getLeftHandData();
    }

    getRightHand() {
        return this.getRightHandData();
    }
}
