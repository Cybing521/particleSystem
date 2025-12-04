import * as THREE from 'three';
import { ParticleSystem } from './scene/ParticleSystem.js';
import { HandTracker } from './input/HandTracker.js';
import { GestureService } from './services/GestureService.js';
import { UIManager } from './ui/UIManager.js';
import { DataVisualization } from './ui/DataVisualization.js';
import './style.css';

const app = document.querySelector('#app');

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
// Add some white fog for depth and "breathing" atmosphere
scene.fog = new THREE.FogExp2(0xffffff, 0.02);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
app.appendChild(renderer.domElement);

// Particle System
const particleSystem = new ParticleSystem(scene);

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

// Data Visualization
const dataVisualization = new DataVisualization(handTracker, particleSystem);

// Set up callbacks for UI synchronization
handTracker.setFingerChangeCallback((fingers) => {
    // When finger count changes, update shape if needed
    if (fingers === 1) {
        particleSystem.setShape('sphere');
    } else if (fingers === 2) {
        particleSystem.setShape('heart');
    } else if (fingers === 3) {
        particleSystem.setShape('torus');
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
