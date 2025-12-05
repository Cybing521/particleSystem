import * as THREE from 'three';
import { ParticleSystem } from './scene/ParticleSystem.js';
import { HandTracker } from './input/HandTracker.js';
import { GestureService } from './services/GestureService.js';
import { UIManager } from './ui/UIManager.js';
import { DataVisualization } from './ui/DataVisualization.js';
import './style.css';

/**
 * 检测是否为移动设备
 * @returns {boolean} 如果是移动设备返回 true
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) ||
           ('ontouchstart' in window || navigator.maxTouchPoints > 0);
}

const app = document.querySelector('#app');

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
// Add some white fog for depth and "breathing" atmosphere
scene.fog = new THREE.FogExp2(0xffffff, 0.02);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// 移动端性能优化：降低像素比和抗锯齿
const isMobile = isMobileDevice();
const renderer = new THREE.WebGLRenderer({ 
    antialias: !isMobile, // 移动端关闭抗锯齿以提升性能
    alpha: true 
});
renderer.setSize(window.innerWidth, window.innerHeight);
// 移动端限制像素比以提升性能
renderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2));
app.appendChild(renderer.domElement);

// Particle System - 移动端使用更少的初始粒子数
const particleSystem = new ParticleSystem(scene);
if (isMobile) {
    // 移动端降低初始粒子数量
    particleSystem.setParticleCount(2000);
    console.log('[Main] Mobile device detected, using reduced particle count');
}

// Hand Tracker
const handTracker = new HandTracker();

// Gesture Service (模块化服务)
const gestureService = new GestureService(handTracker);

// Error handling
gestureService.onError((errorInfo) => {
    console.error('[Main] Gesture service error:', errorInfo);
    // 可以在这里显示用户友好的错误提示
});

// Initialize gesture service
gestureService.initialize().then(success => {
    if (success) {
        console.log('[Main] Gesture service initialized');
    } else {
        console.warn('[Main] Gesture service initialization failed');
    }
});

// UI Manager
const uiManager = new UIManager(particleSystem, handTracker, gestureService);

// Set gesture control service reference in particle system
particleSystem.setGestureControlService(uiManager.gestureControlService);

// Data Visualization
const dataVisualization = new DataVisualization(handTracker, particleSystem);

// Set up callbacks for UI synchronization
handTracker.setFingerChangeCallback((fingers) => {
    // When finger count changes, update shape if needed
    // Check if shape gesture is enabled before switching
    if (uiManager.gestureControlService.isGestureEnabled('shape')) {
        if (fingers === 1) {
            particleSystem.setShape('sphere');
        } else if (fingers === 2) {
            particleSystem.setShape('heart');
        } else if (fingers === 3) {
            particleSystem.setShape('torus');
        }
    }
});

particleSystem.setShapeChangeCallback((shape) => {
    // When shape changes, update UI
    uiManager.updateShapeSelection(shape);
});

// Resize Handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 移动端优化：防止双击缩放
if (isMobile) {
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);

  // 移动端优化：防止滚动和缩放
  document.addEventListener('touchmove', (event) => {
    // 允许在 UI 元素上滚动
    if (event.target.closest('.modal-content, .panel-content')) {
      return;
    }
    // 防止在画布上滚动
    event.preventDefault();
  }, { passive: false });
}

// Animation Loop
const clock = new THREE.Clock();
let frameCount = 0;

function animate() {
  requestAnimationFrame(animate);

  const elapsedTime = clock.getElapsedTime();
  
  // Get gesture data through service (模块化)
  const gestureData = gestureService.getGestureData();
  
  let leftHand, rightHand, gestureState, fingers, position, rotationZ, rotationX;
  
  if (!gestureData) {
    // Fallback to direct handTracker access if service unavailable
    leftHand = handTracker.getLeftHand();
    rightHand = handTracker.getRightHand();
    gestureState = handTracker.getGestureState();
    fingers = handTracker.getFingers();
    position = handTracker.getPosition();
    rotationZ = handTracker.getRotationZ();
    rotationX = handTracker.getRotationX();
  } else {
    // Use service data
    leftHand = gestureData.leftHand;
    rightHand = gestureData.rightHand;
    gestureState = gestureData.gestureState;
    fingers = gestureData.fingers;
    position = gestureData.position;
    rotationZ = gestureData.rotationZ;
    rotationX = gestureData.rotationX;
  }

  // Debug: Log gesture data periodically
  frameCount++;
  if (frameCount % 60 === 0) { // Every 60 frames (~1 second at 60fps)
    console.log('[Main] Dual hand data to ParticleSystem:', {
      leftHand: {
        position: { x: leftHand.position.x.toFixed(2), y: leftHand.position.y.toFixed(2) },
        rotationZ: leftHand.rotationZ.toFixed(2),
        rotationX: leftHand.rotationX.toFixed(2)
      },
      rightHand: {
        gestureState: rightHand.gestureState.toFixed(2),
        fingers: rightHand.fingers
      },
      isTracking: handTracker.isCameraEnabled()
    });
  }

  // Pass dual hand data to particle system
  particleSystem.update(elapsedTime, leftHand, rightHand, gestureState, fingers, position, rotationZ, rotationX);

  renderer.render(scene, camera);
}

console.log('[Main] Starting animation loop...');
animate();
