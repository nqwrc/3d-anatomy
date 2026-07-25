// Selection - Raycasting, highlighting, and selection management
import * as THREE from 'three';
import { state, setSelectedPart, notify, getStructureInfo } from '../state/store.js';
import { getMeshRegistry, highlightMesh, clearHighlight, clearAllHighlights } from './loadModel.js';
import { setView, focusOnMesh } from './camera.js';

let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let lastSelectedMesh = null;
let lastIntersectedMesh = null;

export function initSelection(viewer) {
  const { canvas, camera, scene } = viewer;

  // Mouse events
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('dblclick', onDoubleClick);
  canvas.addEventListener('pointermove', onPointerMove);

  // Touch events for mobile
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });

  return () => {
    canvas.removeEventListener('click', onClick);
    canvas.removeEventListener('dblclick', onDoubleClick);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchend', onTouchEnd);
  };
}

function getEventPosition(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const clientX = event.clientX || (event.touches && event.touches[0].clientX) || 0;
  const clientY = event.clientY || (event.touches && event.touches[0].clientY) || 0;

  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function onClick(event) {
  const viewer = state.viewer;
  if (!viewer) return;

  getEventPosition(event, viewer.canvas);
  raycaster.setFromCamera(mouse, viewer.camera);

  // Only intersect visible meshes
  const meshes = Array.from(getMeshRegistry().values()).filter(m => m.visible);
  const intersects = raycaster.intersectObjects(meshes, true);

  if (intersects.length > 0) {
    const intersected = findParentMesh(intersects[0].object);
    if (intersected && intersected.userData.partId) {
      selectPart(intersected.userData.partId, viewer);
    }
  } else {
    // Clicked on background - deselect
    deselectPart();
  }
}

function onDoubleClick(event) {
  const viewer = state.viewer;
  if (!viewer) return;

  getEventPosition(event, viewer.canvas);
  raycaster.setFromCamera(mouse, viewer.camera);

  const meshes = Array.from(getMeshRegistry().values()).filter(m => m.visible);
  const intersects = raycaster.intersectObjects(meshes, true);

  if (intersects.length > 0) {
    const intersected = findParentMesh(intersects[0].object);
    if (intersected && intersected.userData.partId) {
      focusOnMesh(intersected, viewer, true);
    }
  }
}

function onPointerMove(event) {
  const viewer = state.viewer;
  if (!viewer) return;

  getEventPosition(event, viewer.canvas);
  raycaster.setFromCamera(mouse, viewer.camera);

  const meshes = Array.from(getMeshRegistry().values()).filter(m => m.visible);
  const intersects = raycaster.intersectObjects(meshes, true);

  // Clear previous hover
  if (lastIntersectedMesh && lastIntersectedMesh !== lastSelectedMesh) {
    clearHighlight(lastIntersectedMesh.userData.partId);
  }

  if (intersects.length > 0) {
    const intersected = findParentMesh(intersects[0].object);
    if (intersected && intersected.userData.partId && intersected !== lastSelectedMesh) {
      highlightMesh(intersected.userData.partId, 0xffdf5d, 0.3);
      lastIntersectedMesh = intersected;
      viewer.canvas.style.cursor = 'pointer';
    }
  } else {
    lastIntersectedMesh = null;
    viewer.canvas.style.cursor = 'grab';
  }
}

function onTouchStart(event) {
  // Prevent default to avoid scrolling while interacting with model
  if (event.touches.length === 1) {
    event.preventDefault();
  }
}

function onTouchEnd(event) {
  if (event.changedTouches.length === 1) {
    // Treat as click
    const clickEvent = new MouseEvent('click', {
      clientX: event.changedTouches[0].clientX,
      clientY: event.changedTouches[0].clientY
    });
    viewer.canvas.dispatchEvent(clickEvent);
  }
}

function findParentMesh(object) {
  let current = object;
  while (current && current.parent) {
    if (current.isMesh && current.userData.partId) {
      return current;
    }
    current = current.parent;
  }
  return object.isMesh && object.userData.partId ? object : null;
}

export function selectPart(partId, viewer) {
  // Clear previous selection highlight
  if (lastSelectedMesh) {
    clearHighlight(lastSelectedMesh.userData.partId);
  }

  const mesh = getMeshRegistry().get(partId);
  if (!mesh) return;

  // Get structure info
  const info = getStructureInfo(partId);
  const partData = {
    id: partId,
    meshName: mesh.userData.originalName || mesh.name,
    displayName: info?.name?.it || info?.name?.en || partId,
    system: info?.system || mesh.userData.system || 'unknown',
    region: info?.region || 'unknown',
    info: info
  };

  // Highlight selected mesh
  highlightMesh(partId, 0xffdf5d, 0.8);
  lastSelectedMesh = mesh;

  // Update part state
  getMeshRegistry().forEach((m, id) => {
    const partState = state.partStates.get(id);
    if (partState) {
      partState.selected = (id === partId);
    }
  });

  // Notify state change
  setSelectedPart(partData);

  // Show info panel
  showInfoPanel(partData);

  // Show footer actions
  showFooterActions();
}

export function deselectPart() {
  if (lastSelectedMesh) {
    clearHighlight(lastSelectedMesh.userData.partId);
    lastSelectedMesh = null;
  }

  // Clear selection state
  getMeshRegistry().forEach((m, id) => {
    const partState = state.partStates.get(id);
    if (partState) {
      partState.selected = false;
    }
  });

  setSelectedPart(null);
  hideInfoPanel();
  hideFooterActions();
}

function showInfoPanel(partData) {
  const content = document.getElementById('infoContent');
  const placeholder = document.querySelector('.info-placeholder');
  const structureInfo = document.getElementById('structureInfo');

  if (placeholder) placeholder.style.display = 'none';
  if (structureInfo) structureInfo.classList.remove('hidden');

  const lang = state.language || 'it';
  const info = partData.info || {};

  const name = info.name?.[lang] || info.name?.en || partData.displayName;
  const latinName = info.latinName || '';
  const system = info.system || partData.system;
  const systemLabel = getSystemLabel(system, lang);
  const region = info.region || partData.region;
  const regionLabel = getRegionLabel(region, lang);
  const description = info.description?.[lang] || info.description?.en || '';
  const functions = info.functions || [];
  const origin = info.origin || '';
  const insertion = info.insertion || '';
  const innervation = info.innervation || '';
  const vascularization = info.vascularization || '';
  const clinicalNotes = info.clinicalNotes || '';

  structureInfo.innerHTML = `
    <div class="structure-header">
      <div class="structure-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </div>
      <div class="structure-title">
        <h3>${escapeHtml(name)}</h3>
        ${latinName ? `<span class="structure-latin">${escapeHtml(latinName)}</span>` : ''}
        <span class="structure-system">${escapeHtml(systemLabel)}</span>
      </div>
    </div>

    ${description ? `<div class="structure-description">${escapeHtml(description)}</div>` : ''}

    <div class="structure-details">
      ${functions.length > 0 ? `
        <div class="detail-group">
          <h4>${translate('functions', lang)}</h4>
          <ul>${functions.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
        </div>
      ` : ''}

      ${origin ? `
        <div class="detail-group">
          <h4>${translate('origin', lang)}</h4>
          <p>${escapeHtml(origin)}</p>
        </div>
      ` : ''}

      ${insertion ? `
        <div class="detail-group">
          <h4>${translate('insertion', lang)}</h4>
          <p>${escapeHtml(insertion)}</p>
        </div>
      ` : ''}

      ${innervation ? `
        <div class="detail-group">
          <h4>${translate('innervation', lang)}</h4>
          <p>${escapeHtml(innervation)}</p>
        </div>
      ` : ''}

      ${vascularization ? `
        <div class="detail-group">
          <h4>${translate('vascularization', lang)}</h4>
          <p>${escapeHtml(vascularization)}</p>
        </div>
      ` : ''}

      ${clinicalNotes ? `
        <div class="detail-group">
          <h4>${translate('clinical_notes', lang)}</h4>
          <p>${escapeHtml(clinicalNotes)}</p>
        </div>
      ` : ''}
    </div>
  `;
}

function hideInfoPanel() {
  const placeholder = document.querySelector('.info-placeholder');
  const structureInfo = document.getElementById('structureInfo');

  if (placeholder) placeholder.style.display = 'flex';
  if (structureInfo) structureInfo.classList.add('hidden');
}

function showFooterActions() {
  const footer = document.getElementById('footerBar');
  if (footer) footer.style.display = 'flex';
}

function hideFooterActions() {
  const footer = document.getElementById('footerBar');
  if (footer) footer.style.display = 'none';
}

function getSystemLabel(system, lang) {
  const labels = {
    it: {
      muscular: 'Sistema muscolare',
      skeletal: 'Sistema scheletrico',
      cardiovascular: 'Sistema cardiovascolare',
      respiratory: 'Sistema respiratorio',
      digestive: 'Sistema digerente',
      urinary: 'Sistema urinario',
      nervous: 'Sistema nervoso',
      joints: 'Articolazioni',
      lymphatic: 'Organi linfatici'
    },
    en: {
      muscular: 'Muscular system',
      skeletal: 'Skeletal system',
      cardiovascular: 'Cardiovascular system',
      respiratory: 'Respiratory system',
      digestive: 'Digestive system',
      urinary: 'Urinary system',
      nervous: 'Nervous system',
      joints: 'Joints',
      lymphatic: 'Lymphatic organs'
    }
  };
  return labels[lang]?.[system] || system;
}

function getRegionLabel(region, lang) {
  const labels = {
    it: {
      head: 'Capo',
      neck: 'Collo',
      thorax: 'Torace',
      abdomen: 'Addome',
      upper_limb: 'Arto superiore',
      lower_limb: 'Arto inferiore'
    },
    en: {
      head: 'Head',
      neck: 'Neck',
      thorax: 'Thorax',
      abdomen: 'Abdomen',
      upper_limb: 'Upper limb',
      lower_limb: 'Lower limb'
    }
  };
  return labels[lang]?.[region] || region;
}

function translate(key, lang) {
  const dict = {
    it: {
      functions: 'Funzioni',
      origin: 'Origine',
      insertion: 'Inserzione',
      innervation: 'Innervazione',
      vascularization: 'Vascolarizzazione',
      clinical_notes: 'Note cliniche'
    },
    en: {
      functions: 'Functions',
      origin: 'Origin',
      insertion: 'Insertion',
      innervation: 'Innervation',
      vascularization: 'Vascularization',
      clinical_notes: 'Clinical notes'
    }
  };
  return dict[lang]?.[key] || key;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function getSelectedPart() {
  return state.selectedPart;
}

export function selectPartById(partId, viewer) {
  const mesh = getMeshRegistry().get(partId);
  if (mesh) {
    selectPart(partId, viewer);
    return true;
  }
  return false;
}