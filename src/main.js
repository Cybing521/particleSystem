import * as THREE from 'three';
import { ParticleSystem } from './scene/ParticleSystem.js';
import { HandTracker } from './input/HandTracker.js';
import { UIManager } from './ui/UIManager.js';
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

// UI Manager
const uiManager = new UIManager(particleSystem, handTracker);

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
  const gestureState = handTracker.getGestureState();
  const fingers = handTracker.getFingers();
  const position = handTracker.getPosition();
  const rotationZ = handTracker.getRotationZ();
  const rotationX = handTracker.getRotationX();

  // Debug: Log gesture data periodically
  frameCount++;
  if (frameCount % 60 === 0) { // Every 60 frames (~1 second at 60fps)
    console.log('[Main] Gesture data to ParticleSystem:', {
      gestureState: gestureState.toFixed(2),
      fingers: fingers,
      position: { x: position.x.toFixed(2), y: position.y.toFixed(2) },
      rotationZ: rotationZ.toFixed(2),
      rotationX: rotationX.toFixed(2),
      isTracking: handTracker.isCameraEnabled()
    });
  }

  particleSystem.update(elapsedTime, gestureState, fingers, position, rotationZ, rotationX);

  renderer.render(scene, camera);
}

console.log('[Main] Starting animation loop...');
animate();
