import './style.css';
import { createScene } from './viewer/createScene.js';
import { loadSystems } from './viewer/loadModel.js';
import { initSelection } from './viewer/selection.js';
import { initUI } from './ui/sidebar.js';
import { setViewer, setPartsData, setSystemsData, setRegionsData, setTranslations, setSearchIndex } from './state/store.js';
import { samplePartsData } from './data/sampleParts.js';
import { sampleSystemsData } from './data/sampleSystems.js';
import { sampleRegionsData } from './data/sampleRegions.js';
import { translationsIt, translationsEn } from './data/translations.js';

setPartsData(samplePartsData);
setSystemsData(sampleSystemsData);
setRegionsData(sampleRegionsData);
setTranslations({ it: translationsIt, en: translationsEn });
setSearchIndex(buildSearchIndex(samplePartsData));

function buildSearchIndex(parts) {
  const index = [];
  Object.entries(parts).forEach(([partId, info]) => {
    const terms = [partId.toLowerCase()];
    if (info.name?.it) terms.push(info.name.it.toLowerCase());
    if (info.name?.en) terms.push(info.name.en.toLowerCase());
    if (info.latinName) terms.push(info.latinName.toLowerCase());
    index.push({ partId, name: info.name?.it || info.name?.en || partId, system: info.system || 'unknown', terms: [...new Set(terms)] });
  });
  return index;
}

let viewer;
try {
  console.log('[main] Creating scene...');
  viewer = createScene();
  console.log('[main] Scene created:', !!viewer);
  setViewer(viewer);
  window.viewer = viewer;
  viewer.canvas.__viewer = viewer;
  viewer.startRenderLoop();
  console.log('[main] Render loop started');
} catch (err) {
  console.error('Scene creation error:', err);
}

async function init() {
  console.log('[main] init() called');
  const loadingOverlay = document.getElementById('loadingOverlay');

  try {
    if (viewer) {
      console.log('[main] Loading muscular system...');
      await loadSystems(['muscular'], viewer);
      console.log('[main] Muscular system loaded');
    }
  } catch (error) {
    console.error('[main] Initialization error:', error);
  } finally {
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
      setTimeout(() => { loadingOverlay.style.display = 'none'; }, 300);
    }
    if (viewer) {
      await initUI(viewer);
      initSelection(viewer);
    }
    console.log('[main] Z-Anatomy initialization complete');
  }
}

console.log('[main] Calling init()...');
init();

document.addEventListener('visibilitychange', () => {
  if (!viewer) return;
  if (document.hidden) { viewer.stopRenderLoop(); } else { viewer.startRenderLoop(); }
});

window.ZAnatomy = { viewer, loadSystems };
