// Visibility Management - Hide, isolate, transparency, restore
import * as THREE from 'three';
import { state, setHiddenParts, setTransparentParts, setIsolatedPart, getPartState, setPartState, notify } from '../state/store.js';
import { getMeshRegistry, getMeshesBySystem, getSystemRegistry } from './loadModel.js';

export function hidePart(partId) {
  const mesh = getMeshRegistry().get(partId);
  if (!mesh) return;

  mesh.visible = false;

  const partState = getPartState(partId);
  partState.visible = false;

  setPartState(partId, { visible: false });
  notify('partHidden', partId);
}

export function showPart(partId) {
  const mesh = getMeshRegistry().get(partId);
  if (!mesh) return;

  mesh.visible = true;

  // Restore material if it was modified
  restoreMaterial(mesh);

  const partState = getPartState(partId);
  partState.visible = true;
  partState.opacity = 1;

  setPartState(partId, { visible: true, opacity: 1 });
  notify('partShown', partId);
}

export function setPartTransparency(partId, opacity) {
  const mesh = getMeshRegistry().get(partId);
  if (!mesh) return;

  opacity = THREE.MathUtils.clamp(opacity, 0, 1);

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.forEach(mat => {
    mat.transparent = opacity < 1;
    mat.opacity = opacity;
    mat.depthWrite = opacity >= 1;
    mat.needsUpdate = true;
  });

  const partState = getPartState(partId);
  partState.opacity = opacity;

  setPartState(partId, { opacity });

  if (opacity < 1) {
    state.transparentParts.add(partId);
  } else {
    state.transparentParts.delete(partId);
  }

  notify('partTransparencyChanged', { partId, opacity });
}

export function isolatePart(partId) {
  const meshRegistry = getMeshRegistry();

  // Hide all other parts
  meshRegistry.forEach((mesh, id) => {
    if (id !== partId) {
      mesh.visible = false;
      const state = getPartState(id);
      state.visible = false;
    } else {
      mesh.visible = true;
      const state = getPartState(id);
      state.visible = true;
    }
  });

  setIsolatedPart(partId);
  notify('partIsolated', partId);
}

export function restoreAllParts() {
  const meshRegistry = getMeshRegistry();

  meshRegistry.forEach((mesh, id) => {
    mesh.visible = true;
    restoreMaterial(mesh);

    const state = getPartState(id);
    state.visible = true;
    state.opacity = 1;
    state.selected = false;
  });

  state.hiddenParts.clear();
  state.transparentParts.clear();
  setIsolatedPart(null);
  setHiddenParts([]);
  setTransparentParts([]);

  notify('allPartsRestored', true);
}

export function hideSystem(systemId) {
  const meshes = getMeshesBySystem(systemId);
  meshes.forEach(mesh => {
    mesh.visible = false;
    const partId = mesh.userData.partId;
    if (partId) {
      const state = getPartState(partId);
      state.visible = false;
      state.hiddenParts.add(partId);
    }
  });

  notify('systemHidden', systemId);
}

export function showSystem(systemId) {
  const meshes = getMeshesBySystem(systemId);
  meshes.forEach(mesh => {
    mesh.visible = true;
    restoreMaterial(mesh);

    const partId = mesh.userData.partId;
    if (partId) {
      const state = getPartState(partId);
      state.visible = true;
      state.opacity = 1;
      state.hiddenParts.delete(partId);
    }
  });

  notify('systemShown', systemId);
}

export function setSystemTransparency(systemId, opacity) {
  const meshes = getMeshesBySystem(systemId);
  meshes.forEach(mesh => {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(mat => {
      mat.transparent = opacity < 1;
      mat.opacity = opacity;
      mat.depthWrite = opacity >= 1;
      mat.needsUpdate = true;
    });

    const partId = mesh.userData.partId;
    if (partId) {
      const state = getPartState(partId);
      state.opacity = opacity;
      if (opacity < 1) {
        state.transparentParts.add(partId);
      } else {
        state.transparentParts.delete(partId);
      }
    }
  });

  notify('systemTransparencyChanged', { systemId, opacity });
}

export function toggleSystemVisibility(systemId) {
  const meshes = getMeshesBySystem(systemId);
  if (meshes.length === 0) return;

  const currentlyVisible = meshes.some(m => m.visible);
  if (currentlyVisible) {
    hideSystem(systemId);
  } else {
    showSystem(systemId);
  }
}

export function getSystemVisibilityState(systemId) {
  const meshes = getMeshesBySystem(systemId);
  if (meshes.length === 0) return { visible: false, total: 0, visibleCount: 0 };

  const visibleCount = meshes.filter(m => m.visible).length;
  return {
    visible: visibleCount > 0,
    total: meshes.length,
    visibleCount
  };
}

function restoreMaterial(mesh) {
  if (!mesh.userData.originalMaterial) return;

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const originals = mesh.userData.originalMaterial;

  materials.forEach((mat, i) => {
    const orig = originals[i] || originals[0];
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

export function highlightMesh(partId, color = 0xffdf5d, intensity = 0.5) {
  const mesh = getMeshRegistry().get(partId);
  if (!mesh) return;

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

  materials.forEach(mat => {
    if (!mat.userData.originalEmissive) {
      mat.userData.originalEmissive = mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000);
      mat.userData.originalEmissiveIntensity = mat.emissiveIntensity || 1;
    }

    mat.emissive = new THREE.Color(color);
    mat.emissiveIntensity = intensity;
    mat.needsUpdate = true;
  });

  // Subtle scale for outline effect
  mesh.userData.originalScale = mesh.scale.clone();
  mesh.scale.multiplyScalar(1.01);
}

export function clearHighlight(partId) {
  const mesh = getMeshRegistry().get(partId);
  if (!mesh) return;

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

  materials.forEach(mat => {
    if (mat.userData.originalEmissive) {
      mat.emissive.copy(mat.userData.originalEmissive);
      mat.emissiveIntensity = mat.userData.originalEmissiveIntensity;
      mat.needsUpdate = true;
    }
  });

  if (mesh.userData.originalScale) {
    mesh.scale.copy(mesh.userData.originalScale);
  }
}

export function getPartVisibility(partId) {
  const mesh = getMeshRegistry().get(partId);
  if (!mesh) return { visible: false, opacity: 0 };

  const partState = getPartState(partId);
  return {
    visible: mesh.visible && (partState?.visible !== false),
    opacity: partState?.opacity ?? 1,
    selected: partState?.selected ?? false
  };
}

export function setPartVisibility(partId, visible) {
  const mesh = getMeshRegistry().get(partId);
  if (!mesh) return;

  mesh.visible = visible;
  const partState = getPartState(partId);
  partState.visible = visible;
  setPartState(partId, { visible });
}