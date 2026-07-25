// Model Loading - GLB loading, mesh registry, material handling
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { state, setLoadingSystem, notify } from '../state/store.js';

let meshRegistry = new Map(); // Map<partId, mesh>
let systemRegistry = new Map(); // Map<systemId, mesh[]>
let currentScene = null;
let loadingManager = new THREE.LoadingManager();

export function getMeshRegistry() {
  return meshRegistry;
}

export function getSystemRegistry() {
  return systemRegistry;
}

export function getLoadedSystems() {
  return state.loadedSystems;
}

export async function loadModel(systemId, viewer, options = {}) {
  const { scene, camera, renderer } = viewer;
  currentScene = scene;

  console.log(`[loadModel] Starting load of ${systemId}.glb`);
  
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader(loadingManager);
    const modelPath = `/models/${systemId}.glb`;

    setLoadingSystem(systemId, false, 0);

    loader.load(
      modelPath,
      (gltf) => {
        console.log(`[loadModel] Successfully loaded ${systemId}.glb`);
        const model = gltf.scene;
        processModel(model, systemId, viewer);
        scene.add(model);

        state.loadedSystems.push(systemId);
        setLoadingSystem(systemId, true, 100);

        resolve({ systemId, model, meshCount: systemRegistry.get(systemId)?.length || 0 });
      },
      (xhr) => {
        if (xhr.lengthComputable) {
          const progress = (xhr.loaded / xhr.total) * 100;
          setLoadingSystem(systemId, false, progress);
        }
      },
      (error) => {
        console.error(`[loadModel] Error loading ${systemId}:`, error);
        setLoadingSystem(systemId, true, 100);
        reject(error);
      }
    );
  });
}

function processModel(model, systemId, viewer) {
  const meshes = [];

  model.traverse((child) => {
    if (child.isMesh) {
      setupMesh(child, systemId, viewer);
      meshes.push(child);

      // Register by part ID (from mesh name)
      const partId = child.name || child.userData.name || `unknown_${meshes.length}`;
      child.userData.partId = partId;
      child.userData.system = systemId;
      child.userData.originalName = child.name;

      meshRegistry.set(partId, child);
    }
  });

  systemRegistry.set(systemId, meshes);
  console.log(`Loaded ${systemId}: ${meshes.length} meshes`);

  // Log mesh names for debugging
  if (meshes.length > 0) {
    console.log(`${systemId} meshes:`, meshes.map(m => m.name).filter(n => n));
  }
}

function setupMesh(mesh, systemId, viewer) {
  // Clone material to avoid shared material issues
  if (mesh.material) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    materials.forEach((mat, i) => {
      const clonedMat = mat.clone();
      mesh.material = materials.length > 1 ? materials.map(m => m.clone()) : clonedMat;

      // Store original material properties for restoration
      if (!mesh.userData.originalMaterial) {
        mesh.userData.originalMaterial = [];
      }
      mesh.userData.originalMaterial[i] = {
        color: mat.color ? mat.color.clone() : new THREE.Color(0xffffff),
        opacity: mat.opacity !== undefined ? mat.opacity : 1,
        transparent: mat.transparent || false,
        side: mat.side || THREE.FrontSide,
        depthWrite: mat.depthWrite !== undefined ? mat.depthWrite : true,
        emissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
        emissiveIntensity: mat.emissiveIntensity || 1,
        metalness: mat.metalness !== undefined ? mat.metalness : 0,
        roughness: mat.roughness !== undefined ? mat.roughness : 1
      };
    });

    // Ensure materials are ready
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(m => m.needsUpdate = true);
    } else {
      mesh.material.needsUpdate = true;
    }
  }

  // Enable shadows if needed (disabled for performance in v1)
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  // Frustum culling
  mesh.frustumCulled = true;

  // Set render order for transparent objects
  if (mesh.material && (Array.isArray(mesh.material) ? mesh.material.some(m => m.transparent) : mesh.material.transparent)) {
    mesh.renderOrder = 1;
  }
}

export async function loadSystems(systemIds, viewer, options = {}) {
  const { sequential = false } = options;

  if (sequential) {
    for (const systemId of systemIds) {
      try {
        await loadModel(systemId, viewer);
      } catch (error) {
        console.error(`Failed to load ${systemId}:`, error);
      }
    }
  } else {
    // Parallel loading with concurrency limit
    const concurrency = 2;
    const queue = [...systemIds];
    const running = [];

    const runNext = () => {
      if (queue.length === 0) return Promise.resolve();

      const systemId = queue.shift();
      const promise = loadModel(systemId, viewer).finally(() => {
        running.splice(running.indexOf(promise), 1);
        runNext();
      });

      running.push(promise);

      if (running.length >= concurrency) {
        return Promise.race(running).then(runNext);
      }

      runNext();
      return Promise.all(running);
    };

    await runNext();
    await Promise.all(running);
  }

  // Center camera on all loaded models
  centerCamera(viewer);

  return meshRegistry;
}

function centerCamera(viewer) {
  const { scene, camera, controls } = viewer;

  const box = new THREE.Box3();
  let hasGeometry = false;

  scene.traverse(child => {
    if (child.isMesh && child.visible) {
      box.expandByObject(child);
      hasGeometry = true;
    }
  });

  if (!hasGeometry || box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // Position camera
  const distance = maxDim * 1.5;
  const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
  camera.position.copy(center).add(direction.multiplyScalar(distance));
  controls.target.copy(center);
  controls.update();

  // Store initial camera state for reset
  camera.userData.initialPosition = camera.position.clone();
  camera.userData.initialTarget = controls.target.clone();
  camera.userData.initialZoom = controls.zoom;
}

export function getMeshByPartId(partId) {
  return meshRegistry.get(partId);
}

export function getMeshesBySystem(systemId) {
  return systemRegistry.get(systemId) || [];
}

export function getAllMeshes() {
  return Array.from(meshRegistry.values());
}

export function getPartIdByMeshName(meshName) {
  for (const [partId, mesh] of meshRegistry) {
    if (mesh.name === meshName || mesh.userData.originalName === meshName) {
      return partId;
    }
  }
  return null;
}

// Material manipulation helpers
export function setMeshVisibility(partId, visible) {
  const mesh = meshRegistry.get(partId);
  if (mesh) {
    mesh.visible = visible;
    setPartState(partId, { visible });
  }
}

export function setMeshOpacity(partId, opacity) {
  const mesh = meshRegistry.get(partId);
  if (mesh && mesh.material) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(mat => {
      mat.opacity = opacity;
      mat.transparent = opacity < 1;
      mat.needsUpdate = true;
    });
    setPartState(partId, { opacity });
  }
}

export function isolatePart(partId) {
  // Hide all other parts
  meshRegistry.forEach((mesh, id) => {
    if (id !== partId) {
      mesh.visible = false;
      setPartState(id, { visible: false });
    } else {
      mesh.visible = true;
      setPartState(id, { visible: true });
    }
  });
}

export function showAllParts() {
  meshRegistry.forEach((mesh, partId) => {
    mesh.visible = true;
    setPartState(partId, { visible: true, opacity: 1 });
    restoreMeshMaterial(mesh);
  });
}

export function restoreMeshMaterial(mesh) {
  if (mesh.userData.originalMaterial && mesh.material) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((mat, i) => {
      const orig = mesh.userData.originalMaterial[i] || mesh.userData.originalMaterial[0];
      if (orig) {
        mat.color.copy(orig.color);
        mat.opacity = orig.opacity;
        mat.transparent = orig.transparent;
        mat.side = orig.side;
        mat.depthWrite = orig.depthWrite;
        if (orig.emissive) mat.emissive.copy(orig.emissive);
        mat.emissiveIntensity = orig.emissiveIntensity;
        mat.metalness = orig.metalness;
        mat.roughness = orig.roughness;
        mat.needsUpdate = true;
      }
    });
  }
}

export function highlightMesh(partId, color = 0xffdf5d, intensity = 0.5) {
  const mesh = meshRegistry.get(partId);
  if (mesh && mesh.material) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(mat => {
      mat.emissive = new THREE.Color(color);
      mat.emissiveIntensity = intensity;
      mat.needsUpdate = true;
    });
  }
}

export function clearHighlight(partId) {
  const mesh = meshRegistry.get(partId);
  if (mesh) {
    restoreMeshMaterial(mesh);
  }
}

export function clearAllHighlights() {
  meshRegistry.forEach(mesh => restoreMeshMaterial(mesh));
}

export function getModelStats() {
  let totalMeshes = 0;
  let totalTriangles = 0;

  meshRegistry.forEach(mesh => {
    totalMeshes++;
    if (mesh.geometry && mesh.geometry.index) {
      totalTriangles += mesh.geometry.index.count / 3;
    } else if (mesh.geometry && mesh.geometry.attributes.position) {
      totalTriangles += mesh.geometry.attributes.position.count / 3;
    }
  });

  return { totalMeshes, totalTriangles };
}

// Cleanup
export function dispose() {
  meshRegistry.forEach(mesh => {
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach(mat => mat.dispose());
    }
  });
  meshRegistry.clear();
  systemRegistry.clear();
  state.loadedSystems = [];
}