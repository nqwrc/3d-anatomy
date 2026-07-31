// Visibility Management - Hide, isolate, transparency, restore
import * as THREE from 'three';
import { state, setHiddenParts, setTransparentParts, setIsolatedPart, getPartState, setPartState, batchPartStates, notify } from '../state/store.js';
import { getMeshRegistry, getMeshesBySystem, ownMeshesOf, withDescendants } from './loadModel.js';

// Visibility is applied to the meshes a structure owns, never to its node:
// three.js propagates `visible` down the subtree, and 868 of the 2829
// structures sit inside another one, so touching the node would take unrelated
// structures with it.
function setStructureVisible(partId, visible) {
  ownMeshesOf(partId).forEach(mesh => { mesh.visible = visible; });

  const partState = getPartState(partId);
  partState.visible = visible;
  setPartState(partId, { visible });

  if (visible) {
    state.hiddenParts.delete(partId);
  } else {
    state.hiddenParts.add(partId);
  }
}

export function hidePart(partId) {
  if (!getMeshRegistry().has(partId)) return;

  // Hiding a structure hides what is nested inside it.
  batchPartStates(() => {
    withDescendants(partId).forEach(id => setStructureVisible(id, false));
  });

  notify('partHidden', partId);
}

export function showPart(partId) {
  if (!getMeshRegistry().has(partId)) return;

  batchPartStates(() => {
    withDescendants(partId).forEach(id => {
      setStructureVisible(id, true);
      restoreMaterial(id);
      setPartState(id, { opacity: 1 });
      state.transparentParts.delete(id);
    });
  });

  notify('partShown', partId);
}

export function setPartTransparency(partId, opacity) {
  if (!getMeshRegistry().has(partId)) return;

  opacity = THREE.MathUtils.clamp(opacity, 0, 1);

  ownMeshesOf(partId).forEach(mesh => {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(mat => {
      mat.transparent = opacity < 1;
      mat.opacity = opacity;
      mat.depthWrite = opacity >= 1;
      mat.needsUpdate = true;
    });
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
  if (!getMeshRegistry().has(partId)) return;

  const keep = new Set(withDescendants(partId));

  batchPartStates(() => {
    getMeshRegistry().forEach((node, id) => {
      setStructureVisible(id, keep.has(id));
    });
  });

  setIsolatedPart(partId);
  notify('partIsolated', partId);
}

export function restoreAllParts() {
  batchPartStates(() => {
    getMeshRegistry().forEach((node, id) => {
      setStructureVisible(id, true);
      restoreMaterial(id);

      const partState = getPartState(id);
      partState.opacity = 1;
      partState.selected = false;
      setPartState(id, { opacity: 1, selected: false });
    });
  });

  state.hiddenParts.clear();
  state.transparentParts.clear();
  setIsolatedPart(null);
  setHiddenParts([]);
  setTransparentParts([]);

  notify('allPartsRestored', true);
}

export function hideSystem(systemId) {
  batchPartStates(() => {
    getMeshesBySystem(systemId).forEach(node => {
      const partId = node.userData.partId;
      if (partId) setStructureVisible(partId, false);
    });
  });

  notify('systemHidden', systemId);
}

export function showSystem(systemId) {
  batchPartStates(() => {
    getMeshesBySystem(systemId).forEach(node => {
      const partId = node.userData.partId;
      if (!partId) return;

      setStructureVisible(partId, true);
      restoreMaterial(partId);
      setPartState(partId, { opacity: 1 });
      state.transparentParts.delete(partId);
    });
  });

  notify('systemShown', systemId);
}

export function setSystemTransparency(systemId, opacity) {
  opacity = THREE.MathUtils.clamp(opacity, 0, 1);

  batchPartStates(() => {
    getMeshesBySystem(systemId).forEach(node => {
      const partId = node.userData.partId;
      if (!partId) return;

      ownMeshesOf(partId).forEach(mesh => {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach(mat => {
          mat.transparent = opacity < 1;
          mat.opacity = opacity;
          mat.depthWrite = opacity >= 1;
          mat.needsUpdate = true;
        });
      });

      const partState = getPartState(partId);
      partState.opacity = opacity;
      setPartState(partId, { opacity });

      if (opacity < 1) {
        state.transparentParts.add(partId);
      } else {
        state.transparentParts.delete(partId);
      }
    });
  });

  notify('systemTransparencyChanged', { systemId, opacity });
}

export function toggleSystemVisibility(systemId) {
  const { total, visible } = getSystemVisibilityState(systemId);
  if (total === 0) return;

  if (visible) {
    hideSystem(systemId);
  } else {
    showSystem(systemId);
  }
}

export function getSystemVisibilityState(systemId) {
  const nodes = getMeshesBySystem(systemId);
  if (nodes.length === 0) return { visible: false, total: 0, visibleCount: 0 };

  // Reads the owned meshes, because the node itself is never toggled.
  const visibleCount = nodes.filter(node => {
    const partId = node.userData.partId;
    return partId && ownMeshesOf(partId).some(mesh => mesh.visible);
  }).length;

  return {
    visible: visibleCount > 0,
    total: nodes.length,
    visibleCount
  };
}

function restoreMaterial(partId) {
  ownMeshesOf(partId).forEach(mesh => {
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
  });
}

// Highlighting only touches `emissive`, so it can be undone without disturbing
// a transparency the user set.
export function highlightMesh(partId, color = 0xffdf5d, intensity = 0.5) {
  ownMeshesOf(partId).forEach(mesh => {
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
  });
}

export function clearHighlight(partId) {
  ownMeshesOf(partId).forEach(mesh => {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    materials.forEach(mat => {
      if (mat.userData.originalEmissive) {
        mat.emissive.copy(mat.userData.originalEmissive);
        mat.emissiveIntensity = mat.userData.originalEmissiveIntensity;
        mat.needsUpdate = true;
      }
    });
  });
}

export function clearAllHighlights() {
  getMeshRegistry().forEach((node, partId) => clearHighlight(partId));
}

export function getPartVisibility(partId) {
  if (!getMeshRegistry().has(partId)) return { visible: false, opacity: 0, selected: false };

  const partState = getPartState(partId);
  return {
    visible: ownMeshesOf(partId).some(mesh => mesh.visible),
    opacity: partState?.opacity ?? 1,
    selected: partState?.selected ?? false
  };
}

export function setPartVisibility(partId, visible) {
  if (!getMeshRegistry().has(partId)) return;
  setStructureVisible(partId, visible);
}