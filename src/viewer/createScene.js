// Three.js Viewer - Scene Creation
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

console.log('[createScene] Module loaded');

export function createScene() {
  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);

  // Renderer
  const canvas = document.getElementById('threeCanvas');
  console.log('[createScene] Canvas:', canvas, canvas ? canvas.clientWidth + 'x' + canvas.clientHeight : 'none');
  
  if (!canvas) {
    throw new Error('Canvas element #threeCanvas not found');
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  console.log('[createScene] Renderer created');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = false; // Disabled for performance

  // Camera
  // The Z-Anatomy models are built to real scale: a body is roughly 1.7 units
  // (metres) tall, so near/far and the camera distance are in the same order.
  const camera = new THREE.PerspectiveCamera(
    50, // FOV
    canvas.clientWidth / canvas.clientHeight,
    0.01, // near
    100 // far
  );
  camera.position.set(0, 0, 3);

  // Controls
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.enableRotate = true;
  controls.autoRotate = false;
  controls.minDistance = 0.02;
  controls.maxDistance = 20;
  controls.maxPolarAngle = Math.PI * 0.95; // Prevent camera flip
  controls.minPolarAngle = Math.PI * 0.05;
  controls.target.set(0, 0, 0);

  // Touch controls for mobile
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN
  };

  // Lights
  const lights = createLights(scene);

  // Handle resize
  function onResize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  window.addEventListener('resize', onResize);

  // Animation loop
  let animationId = null;
  let lastRenderTime = 0;
  const minFrameInterval = 1000 / 60; // 60fps cap
  let frameCount = 0;
  let lastFpsUpdate = 0;

  // Per-frame subscribers, used by overlays that must track a 3D point on
  // screen (the selection callout).
  const frameCallbacks = new Set();

  function onFrame(callback) {
    frameCallbacks.add(callback);
    return () => frameCallbacks.delete(callback);
  }

  function animate(time) {
    animationId = requestAnimationFrame(animate);

    // Throttle to 60fps
    if (time - lastRenderTime < minFrameInterval) return;
    lastRenderTime = time;

    // Heartbeat to detect actual rendering
    frameCount++;
    if (!lastFpsUpdate) lastFpsUpdate = time;
    if (time - lastFpsUpdate > 1000) {
      console.log(`[viewer] render heartbeat ~${frameCount}fps`);
      frameCount = 0;
      lastFpsUpdate = time;
    }

    controls.update();
    renderer.render(scene, camera);
    frameCallbacks.forEach(cb => cb());
  }

  function startRenderLoop() {
    if (!animationId) {
      animate(0);
    }
  }

  function stopRenderLoop() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  // Render on demand (for performance)
  function render() {
    controls.update();
    renderer.render(scene, camera);
  }

  // Cleanup
  function dispose() {
    stopRenderLoop();
    window.removeEventListener('resize', onResize);
    controls.dispose();
    renderer.dispose();
    scene.clear();
  }

  return {
    scene,
    camera,
    renderer,
    controls,
    lights,
    canvas,
    startRenderLoop,
    stopRenderLoop,
    render,
    onFrame,
    dispose,
    onResize
  };
}

function createLights(scene) {
  const lights = {};

  // Ambient light - soft overall illumination
  lights.ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(lights.ambient);

  // Main directional light - key light
  lights.key = new THREE.DirectionalLight(0xffffff, 1.0);
  lights.key.position.set(50, 100, 50);
  scene.add(lights.key);

  // Fill light - softer, from opposite side
  lights.fill = new THREE.DirectionalLight(0x88aaff, 0.4);
  lights.fill.position.set(-50, 50, -50);
  scene.add(lights.fill);

  // Rim light - defines edges
  lights.rim = new THREE.DirectionalLight(0xffffee, 0.3);
  lights.rim.position.set(0, -50, -100);
  scene.add(lights.rim);

  // Hemisphere light for subtle ambient variation
  lights.hemi = new THREE.HemisphereLight(0x88ccff, 0x332211, 0.3);
  scene.add(lights.hemi);

  return lights;
}

export function updateLightsForSystem(lights, system) {
  // Adjust lighting based on visible system
  const configs = {
    muscular: { key: 1.0, fill: 0.4, ambient: 0.5 },
    skeletal: { key: 1.2, fill: 0.5, ambient: 0.6 },
    nervous: { key: 0.8, fill: 0.6, ambient: 0.5 },
    default: { key: 1.0, fill: 0.4, ambient: 0.6 }
  };

  const config = configs[system] || configs.default;
  if (lights.key) lights.key.intensity = config.key;
  if (lights.fill) lights.fill.intensity = config.fill;
  if (lights.ambient) lights.ambient.intensity = config.ambient;
}

export function setSceneBackground(scene, color) {
  scene.background = new THREE.Color(color);
}