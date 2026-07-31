// Model Loading - GLB loading, mesh registry, material handling
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { state, setLoadingSystem } from '../state/store.js';
import { asset } from '../utils/paths.js';

// The Z-Anatomy models are exported with Draco compression, so the decoder
// (copied into public/draco) is required to read them.
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(asset('draco/'));

let meshRegistry = new Map(); // Map<partId, node>
let structures = new Map(); // Map<partId, { node, systemId, parentId, childIds, ownMeshes }>
let systemRegistry = new Map(); // Map<systemId, node[]>
let modelRoots = new Map(); // Map<systemId, gltf.scene>
let loadingManager = new THREE.LoadingManager();

export function getMeshRegistry() {
  return meshRegistry;
}

export function getSystemRegistry() {
  return systemRegistry;
}

export function getStructure(partId) {
  return structures.get(partId);
}

// Roots of the loaded models. Raycasting against these instead of against the
// registry avoids re-testing shared subtrees once per nested structure.
export function getPickTargets() {
  return Array.from(modelRoots.values());
}

// The meshes a structure owns directly, i.e. excluding those belonging to a
// nested structure. 868 of the 2829 structures are descendants of another one,
// so "every mesh under this node" is not the same thing as "this structure".
export function ownMeshesOf(partId) {
  const entry = structures.get(partId);
  return entry ? entry.ownMeshes : [];
}

// A structure plus everything nested inside it, in document order.
export function withDescendants(partId) {
  const out = [];
  const walk = id => {
    const entry = structures.get(id);
    if (!entry) return;
    out.push(id);
    entry.childIds.forEach(walk);
  };
  walk(partId);
  return out;
}

export function getLoadedSystems() {
  return state.loadedSystems;
}

export async function loadModel(systemId, viewer, options = {}) {
  const { scene } = viewer;

  console.log(`[loadModel] Starting load of ${systemId}.glb`);
  
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader(loadingManager);
    loader.setDRACOLoader(dracoLoader);
    const modelPath = asset(`models/${systemId}.glb`);

    setLoadingSystem(systemId, false, 0);

    loader.load(
      modelPath,
      (gltf) => {
        console.log(`[loadModel] Successfully loaded ${systemId}.glb`);
        const model = gltf.scene;
        processModel(model, systemId, viewer);
        scene.add(model);
        modelRoots.set(systemId, model);

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
  const nodes = [];

  // The glTF carries the untouched Z-Anatomy name in `za_name`, because the
  // exporter rewrites object names (spaces, dots) and paired structures would
  // otherwise collapse onto the same name.
  model.traverse((child) => {
    const partId = child.userData?.za_name;
    if (!partId) return;

    child.userData.partId = partId;
    child.userData.system = systemId;
    child.userData.originalName = partId;

    // The glTF graph is nested: a structure can be the parent of another one.
    // Record that relation instead of flattening it, because three.js applies
    // `visible` down the whole subtree and hiding a parent would take its
    // children with it.
    const parentId = findAncestorPartId(child.parent);

    nodes.push(child);
    meshRegistry.set(partId, child);
    structures.set(partId, {
      node: child,
      systemId,
      parentId,
      childIds: [],
      ownMeshes: []
    });

    if (parentId) {
      const parent = structures.get(parentId);
      if (parent) parent.childIds.push(partId);
    }
  });

  // A nested structure is often a child of a node that is itself a mesh, so
  // hiding the parent would hide the child with it. Detach every nested
  // structure to the model root (attach preserves the world transform): the
  // anatomical nesting stays recorded above, but visibility becomes
  // independent per structure.
  model.updateMatrixWorld(true);
  nodes.forEach(node => {
    if (structures.get(node.userData.partId).parentId) {
      model.attach(node);
    }
  });

  // Assign every mesh to the closest structure above it, so a parent structure
  // never claims the geometry of a nested one.
  model.traverse((child) => {
    if (!child.isMesh) return;

    setupMesh(child, systemId, viewer);

    const ownerId = findAncestorPartId(child);
    const owner = ownerId && structures.get(ownerId);
    if (owner) owner.ownMeshes.push(child);
  });

  systemRegistry.set(systemId, nodes);
  console.log(`Loaded ${systemId}: ${nodes.length} structures`);
}

// Walks up from `node` (inclusive) to the closest node carrying a partId.
function findAncestorPartId(node) {
  let current = node;
  while (current) {
    if (current.userData?.partId) return current.userData.partId;
    current = current.parent;
  }
  return null;
}

function setupMesh(mesh, systemId, viewer) {
  // Idempotent: a mesh must not have its material snapshot taken twice.
  if (mesh.userData.originalMaterial) return;

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

export function getMeshesBySystem(systemId) {
  return systemRegistry.get(systemId) || [];
}

// Walks the structures rather than the nodes, so meshes shared with a nested
// structure are not counted twice.
export function getAllMeshes() {
  return Array.from(structures.values()).flatMap(entry => entry.ownMeshes);
}

// Visibility, transparency and highlighting all live in viewer/visibility.js,
// which is the single owner of material state.

export function getModelStats() {
  let totalMeshes = 0;
  let totalTriangles = 0;

  getAllMeshes().forEach(mesh => {
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
  getAllMeshes().forEach(mesh => {
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach(mat => mat.dispose());
    }
  });
  meshRegistry.clear();
  structures.clear();
  systemRegistry.clear();
  modelRoots.clear();
  state.loadedSystems = [];
}