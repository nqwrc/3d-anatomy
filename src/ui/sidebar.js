// Sidebar UI - Systems panel with collapsible groups
import { state, subscribe, getSystemParts, getStructureInfo, setLanguage, translate } from '../state/store.js';
import { getMeshRegistry, loadModel, unloadSystem } from '../viewer/loadModel.js';
import { SYSTEM_IDS } from '../data/anatomy.js';
import { hideSystem, showSystem, hidePart, showPart, isolatePart, setPartTransparency, restoreAllParts, getSystemVisibilityState } from '../viewer/visibility.js';
import { selectPartById, deselectPart } from '../viewer/selection.js';
import { setView, resetView } from '../viewer/camera.js';
import { loadAllData, searchStructures } from '../utils/dataLoader.js';
import { initDepthSlider, resetDepthSlider } from './depthSlider.js';
import { PRESETS, applyPreset } from '../data/presets.js';

// Systems as they are organised in the Z-Anatomy source file. Respiratory,
// digestive and urinary structures all live in the single "visceral" model.
const SYSTEM_LABELS = {
  it: {
    skeletal: 'Sistema scheletrico',
    muscular: 'Sistema muscolare',
    joints: 'Articolazioni',
    cardiovascular: 'Sistema cardiovascolare',
    lymphatic: 'Organi linfatici',
    nervous: 'Sistema nervoso e organi di senso',
    visceral: 'Sistemi viscerali'
  },
  en: {
    skeletal: 'Skeletal system',
    muscular: 'Muscular system',
    joints: 'Joints',
    cardiovascular: 'Cardiovascular system',
    lymphatic: 'Lymphoid organs',
    nervous: 'Nervous system & sense organs',
    visceral: 'Visceral systems'
  }
};

const SYSTEM_ICONS = {
  skeletal: '🦴',
  muscular: '💪',
  joints: '🦵',
  cardiovascular: '❤️',
  lymphatic: '🫧',
  nervous: '🧠',
  visceral: '🫁'
};

export function systemLabel(systemId, lang = state.language || 'it') {
  return SYSTEM_LABELS[lang]?.[systemId] || SYSTEM_LABELS.it[systemId] || systemId;
}

export function initSystemsSidebar() {
  const container = document.getElementById('systemsList');
  if (!container) return;

  const lang = state.language || 'en';

  const presets = `
    <div class="preset-row">
      ${PRESETS.map(preset => `
        <button type="button" class="preset-chip" data-preset="${preset.id}">
          ${escapeHtml(preset.label[lang] || preset.label.en)}
        </button>
      `).join('')}
    </div>
  `;

  container.innerHTML = presets + SYSTEM_IDS.map(systemId => {
    const parts = getSystemParts(systemId);
    const count = parts.length;
    const icon = SYSTEM_ICONS[systemId] || '🔬';
    const label = systemLabel(systemId, lang);

    // Determine initial visibility state
    const visibility = getSystemVisibilityState(systemId);
    const isVisible = visibility.visible;
    const checkboxState = isVisible ? 'checked' : '';

    return `
      <div class="system-group" data-system="${systemId}">
        <label class="system-group-label">
          <input type="checkbox" ${checkboxState} data-system-checkbox="${systemId}">
          <span class="system-icon">${icon}</span>
          <span class="system-name">${label}</span>
          <span class="system-count">${count}</span>
        </label>
        <div class="system-group-content" style="display: ${isVisible ? 'block' : 'none'};"></div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-preset]').forEach(chip => {
    chip.addEventListener('click', () => {
      const preset = PRESETS.find(p => p.id === chip.dataset.preset);
      if (preset) applyPreset(preset);
    });
  });

  // Add event listeners for system toggles
  container.querySelectorAll('[data-system-checkbox]').forEach(checkbox => {
    checkbox.addEventListener('change', async (e) => {
      const systemId = e.target.dataset.systemCheckbox;
      const group = e.target.closest('.system-group');
      const content = group.querySelector('.system-group-content');

      // A manual toggle invalidates the depth slider's picture of the scene.
      resetDepthSlider();

      if (!e.target.checked) {
        hideSystem(systemId);
        content.style.display = 'none';
        scheduleUnload(systemId, content);
        return;
      }

      cancelUnload(systemId);

      // Models are fetched on first activation, not upfront.
      await ensureSystemLoaded(systemId, group);
      showSystem(systemId);
      content.style.display = 'block';

      // Building the list here covers every activation path: clicking the
      // checkbox, clicking the row, or keyboard activation.
      if (content.children.length === 0) {
        populateSystemStructures(systemId, content);
      }
    });
  });
}

// Selecting a structure from search must work even when its system has never
// been downloaded: 2552 of the 2829 structures are in that state on a fresh
// page, and every one of them used to be a dead click.
export async function selectStructureAnywhere(partId) {
  const info = getStructureInfo(partId);
  const systemId = info?.system;

  if (systemId && !state.loadedSystems.includes(systemId)) {
    const group = document.querySelector(`.system-group[data-system="${systemId}"]`);
    await ensureSystemLoaded(systemId, group);

    if (group) {
      const checkbox = group.querySelector('[data-system-checkbox]');
      const content = group.querySelector('.system-group-content');
      if (checkbox) checkbox.checked = true;
      if (content) {
        content.style.display = 'block';
        if (content.children.length === 0) populateSystemStructures(systemId, content);
      }
    }
    showSystem(systemId);
  }

  selectPartById(partId, state.viewer);
}

// Hiding a system is instant, but its buffers are only released if it stays
// off: toggling twice in a row should not pay for a reload.
const UNLOAD_GRACE_MS = 30000;
const pendingUnloads = new Map();

function scheduleUnload(systemId, content) {
  cancelUnload(systemId);
  pendingUnloads.set(systemId, setTimeout(() => {
    pendingUnloads.delete(systemId);
    if (unloadSystem(systemId) && content) content.innerHTML = '';
  }, UNLOAD_GRACE_MS));
}

function cancelUnload(systemId) {
  const timer = pendingUnloads.get(systemId);
  if (timer) {
    clearTimeout(timer);
    pendingUnloads.delete(systemId);
  }
}

const pendingSystemLoads = new Map();

async function ensureSystemLoaded(systemId, group) {
  if (state.loadedSystems.includes(systemId)) return;

  if (!pendingSystemLoads.has(systemId)) {
    const label = group?.querySelector('.system-group-label');
    const counter = label?.querySelector('.system-count');
    const originalCount = counter?.textContent;
    label?.classList.add('loading');

    // The bytes were already being measured and thrown away; show them.
    const unsubscribe = subscribe('loading', info => {
      if (!counter || info.system !== systemId || info.loaded) return;
      counter.textContent = info.total
        ? `${Math.round(info.loaded / 1048576 * 10) / 10}/${Math.round(info.total / 1048576 * 10) / 10} MB`
        : `${Math.round(info.loaded / 1048576 * 10) / 10} MB`;
    });

    const promise = loadModel(systemId, state.viewer)
      .catch(error => {
        console.error(`[sidebar] Failed to load ${systemId}:`, error);
        label?.classList.add('failed');
        if (counter) counter.textContent = translate('retry');
      })
      .finally(() => {
        unsubscribe?.();
        label?.classList.remove('loading');
        if (counter && originalCount && !label?.classList.contains('failed')) {
          counter.textContent = originalCount;
        }
        pendingSystemLoads.delete(systemId);
      });

    pendingSystemLoads.set(systemId, promise);
  }

  await pendingSystemLoads.get(systemId);
}

const ROWS_PER_CHUNK = 60;

// One row per structure rather than per mesh: the left and right copies of the
// same structure share a row and are picked with a side chip.
function groupSystemStructures(systemId, lang) {
  const groups = new Map();

  getSystemParts(systemId).forEach(partId => {
    const info = getStructureInfo(partId) || {};
    const base = info.baseName || partId;

    let group = groups.get(base);
    if (!group) {
      group = {
        base,
        label: (info.name?.[lang] || info.name?.en || base).replace(/\s*\((sinistro|destro|left|right)\)$/i, ''),
        parts: [],
        sides: {}
      };
      groups.set(base, group);
    }

    group.parts.push(partId);
    group.sides[info.side || 'none'] = partId;
  });

  return [...groups.values()];
}

function rowMarkup(group) {
  const primary = group.sides.none || group.sides.right || group.sides.left;
  const visible = group.parts.some(id => state.partStates.get(id)?.visible !== false);
  const selected = group.parts.some(id => state.partStates.get(id)?.selected === true);

  const sides = ['left', 'right']
    .filter(side => group.sides[side])
    .map(side => `<button type="button" class="structure-side" data-select="${escapeHtml(group.sides[side])}" title="${side === 'left' ? 'Sinistro' : 'Destro'}">${side === 'left' ? 'S' : 'D'}</button>`)
    .join('');

  const label = escapeHtml(group.label);

  return `
    <div class="structure-item ${selected ? 'selected' : ''}" data-part="${escapeHtml(primary)}" data-parts="${escapeHtml(group.parts.join('|'))}">
      <input type="checkbox" ${visible ? 'checked' : ''} data-part-checkbox="${escapeHtml(primary)}">
      <span class="structure-name" title="${label}">${label}</span>
      <span class="structure-sides">${sides}</span>
      <div class="structure-actions">
        <button class="action-btn isolate" data-action="isolate" title="Isola" aria-label="Isola">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="action-btn hide" data-action="hide" title="Nascondi" aria-label="Nascondi">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M2 2l20 20"/></svg>
        </button>
        <button class="action-btn transparent" data-action="transparent" title="Trasparenza" aria-label="Trasparenza">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20"/></svg>
        </button>
      </div>
    </div>
  `;
}

function populateSystemStructures(systemId, container) {
  const lang = state.language || 'it';
  const groups = groupSystemStructures(systemId, lang);

  // A 669-structure system used to build ~10 000 nodes and ~2700 listeners in
  // one go. Rows arrive in chunks as the panel is scrolled, behind a single
  // delegated listener.
  let rendered = 0;
  container.innerHTML = '';

  const sentinel = document.createElement('div');
  sentinel.className = 'structure-sentinel';

  const renderChunk = () => {
    const slice = groups.slice(rendered, rendered + ROWS_PER_CHUNK);
    if (!slice.length) return;

    sentinel.insertAdjacentHTML('beforebegin', slice.map(rowMarkup).join(''));
    rendered += slice.length;

    if (rendered >= groups.length) {
      observer.disconnect();
      sentinel.remove();
    }
  };

  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) renderChunk();
  }, { root: container.closest('.sidebar-content'), rootMargin: '200px' });

  container.appendChild(sentinel);
  renderChunk();
  observer.observe(sentinel);

  container.addEventListener('click', onStructureListClick);
  container.addEventListener('change', onStructureListChange);
}

function partsOf(item) {
  return (item.dataset.parts || item.dataset.part || '').split('|').filter(Boolean);
}

function onStructureListChange(event) {
  const checkbox = event.target.closest('[data-part-checkbox]');
  if (!checkbox) return;

  const item = checkbox.closest('.structure-item');
  partsOf(item).forEach(partId => {
    if (checkbox.checked) showPart(partId); else hidePart(partId);
  });
}

function onStructureListClick(event) {
  const item = event.target.closest('.structure-item');
  if (!item) return;

  const side = event.target.closest('[data-select]');
  if (side) {
    event.stopPropagation();
    selectPartById(side.dataset.select, state.viewer);
    return;
  }

  const action = event.target.closest('[data-action]')?.dataset.action;
  const parts = partsOf(item);
  const primary = item.dataset.part;

  if (action === 'isolate') {
    event.stopPropagation();
    isolatePart(primary);
    return;
  }

  if (action === 'hide') {
    event.stopPropagation();
    parts.forEach(hidePart);
    deselectPart();
    return;
  }

  if (action === 'transparent') {
    event.stopPropagation();
    const opacity = getPartVisibility(primary).opacity < 1 ? 1 : 0.3;
    parts.forEach(partId => setPartTransparency(partId, opacity));
    return;
  }

  if (event.target.type === 'checkbox') return;
  selectPartById(primary, state.viewer);
}

function getPartVisibility(partId) {
  const meshRegistry = getMeshRegistry();
  const mesh = meshRegistry.get(partId);
  if (!mesh) return { visible: false, opacity: 1 };

  const partState = state.partStates.get(partId);
  return {
    visible: mesh.visible && (partState?.visible !== false),
    opacity: partState?.opacity ?? 1
  };
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize toolbar buttons
export function initToolbar(viewer) {
  // Isolate / hide / transparency are on the callout and the action bar; the
  // toolbar only carries camera presets.
  const buttons = {
    resetBtn: () => resetView(viewer),
    frontViewBtn: () => setView('front', viewer),
    sideViewBtn: () => setView('right', viewer),
    backViewBtn: () => setView('back', viewer),
    topViewBtn: () => setView('top', viewer)
  };

  Object.entries(buttons).forEach(([id, handler]) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', handler);
  });
}

function isolateSelected() {
  if (state.selectedPart) {
    isolatePart(state.selectedPart.id);
  }
}

function hideSelected() {
  if (state.selectedPart) {
    hidePart(state.selectedPart.id);
    deselectPart();
  }
}

function toggleTransparencySelected() {
  if (state.selectedPart) {
    const visibility = getPartVisibility(state.selectedPart.id);
    setPartTransparency(state.selectedPart.id, visibility.opacity < 1 ? 1 : 0.3);
  }
}

// Footer actions
export function initFooterActions(viewer) {
  const buttons = {
    footerIsolateBtn: () => isolateSelected(),
    footerHideBtn: () => hideSelected(),
    footerTransparentBtn: () => toggleTransparencySelected(),
    // Restoring visibility must not throw away the angle the user just chose;
    // the camera has its own Reset in the toolbar.
    footerShowAllBtn: () => { restoreAllParts(); deselectPart(); }
  };

  Object.entries(buttons).forEach(([id, handler]) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', handler);
  });
}

// Help modal
export function initHelpModal() {
  const modal = document.getElementById('helpModal');
  const openBtn = document.getElementById('helpBtn');
  const closeBtn = document.getElementById('helpClose');
  const overlay = modal?.querySelector('.modal-overlay');

  if (openBtn) openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
  if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  if (overlay) overlay.addEventListener('click', () => modal.classList.add('hidden'));

  // ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
    }
  });
}

// Language selector
export function initLanguageSelector() {
  const select = document.getElementById('langSelect');
  if (select) {
    select.value = state.language || 'it';
    select.addEventListener('change', (e) => {
      setLanguage(e.target.value);
    });
  }
}

// Search functionality
export function initSearch() {
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');

  if (!input || !results) return;

  input.addEventListener('input', debounce((e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query.length < 2) {
      results.innerHTML = '';
      results.classList.remove('show');
      return;
    }

    const matches = searchStructures(query);
    if (matches.length > 0) {
      const lang = state.language || 'it';

      results.innerHTML = matches.map(row => {
        // Paired structures are one row with a side chip each, instead of two
        // near-identical rows.
        const sides = ['left', 'right']
          .filter(side => row.sides[side])
          .map(side => `<button type="button" class="result-side" data-part="${escapeHtml(row.sides[side])}">${side === 'left' ? 'S' : 'D'}</button>`)
          .join('');

        const target = row.sides.none || row.sides.right || row.sides.left;
        const pending = state.loadedSystems.includes(row.system) ? '' : ' is-pending';

        return `
          <div class="search-result-item${pending}" data-part="${escapeHtml(target)}">
            <span class="result-name">${escapeHtml(row.label)}</span>
            <span class="result-sides">${sides}</span>
            <span class="result-system">${escapeHtml(systemLabel(row.system, lang))}</span>
          </div>
        `;
      }).join('');

      results.classList.add('show');

      const choose = async (partId) => {
        input.value = '';
        results.innerHTML = '';
        results.classList.remove('show');
        input.blur();
        await selectStructureAnywhere(partId);
      };

      results.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', (clickEvent) => {
          const side = clickEvent.target.closest('.result-side');
          choose(side ? side.dataset.part : item.dataset.part);
        });
      });
    } else {
      results.innerHTML = `<div class="search-result-item is-empty">${translate('no_results')}</div>`;
      results.classList.add('show');
    }
  }, 150));

  // Close results on click outside
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.remove('show');
    }
  });

  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      results.classList.remove('show');
      input.blur();
    }
  });
}

function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// State change handlers
subscribe('selectedPart', onSelectionChange);
subscribe('language', onLanguageChange);
subscribe('partStates', onPartStatesChange);

function onSelectionChange(part) {
  // Update sidebar highlights
  document.querySelectorAll('.structure-item.selected').forEach(el => {
    el.classList.remove('selected');
  });

  if (part) {
    const item = document.querySelector(`.structure-item[data-part="${part.id}"]`);
    if (item) item.classList.add('selected');

    updateFooterButtons(part);
  } else {
    document.getElementById('footerBar')?.style.setProperty('display', 'none');
  }
}

function onLanguageChange(lang) {
  // Update UI text
  updateUIText(lang);

  // Re-render sidebar
  initSystemsSidebar();

  // Re-render info panel if part selected
  if (state.selectedPart) {
    selectPartById(state.selectedPart.id, state.viewer);
  }
}

function onPartStatesChange(partStates) {
  // Update checkboxes in sidebar
  partStates.forEach((partState, partId) => {
    const checkbox = document.querySelector(`[data-part-checkbox="${partId}"]`);
    if (checkbox) {
      checkbox.checked = partState.visible !== false;
    }

    const item = document.querySelector(`.structure-item[data-part="${partId}"]`);
    if (item) {
      item.classList.toggle('hidden', partState.visible === false);
      item.style.opacity = partState.opacity < 1 ? '0.5' : '1';
    }
  });
}

function updateFooterButtons(part) {
  const footer = document.getElementById('footerBar');
  if (!footer) return;

  footer.style.display = 'flex';

  const isolateBtn = document.getElementById('footerIsolateBtn');
  const hideBtn = document.getElementById('footerHideBtn');
  const transparentBtn = document.getElementById('footerTransparentBtn');

  if (isolateBtn) isolateBtn.disabled = false;
  if (hideBtn) hideBtn.disabled = false;
  if (transparentBtn) transparentBtn.disabled = false;

  const visibility = getPartVisibility(part.id);
  if (transparentBtn) {
    transparentBtn.textContent = visibility.opacity < 1 ? 'Opaco' : 'Trasparenza';
  }
}

function updateUIText(lang) {
  const t = (key) => translate(key, lang);

  // Update placeholders
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.placeholder = t('search_placeholder');

  // Update button titles
  const updates = [
    ['resetBtn', 'reset'],
    ['isolateBtn', 'isolate'],
    ['hideBtn', 'hide'],
    ['transparentBtn', 'transparent'],
    ['frontViewBtn', 'front_view'],
    ['sideViewBtn', 'side_view'],
    ['backViewBtn', 'back_view'],
    ['topViewBtn', 'top_view'],
    ['footerIsolateBtn', 'isolate'],
    ['footerHideBtn', 'hide'],
    ['footerTransparentBtn', 'transparent'],
    ['footerShowAllBtn', 'show_all']
  ];

  updates.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) {
      el.title = t(key);
      if (el.tagName === 'BUTTON' && !el.querySelector('svg')) {
        el.textContent = t(key);
      }
    }
  });

  // Update sidebar headers
  const systemsHeader = document.querySelector('.sidebar-systems .sidebar-header h2');
  if (systemsHeader) systemsHeader.textContent = t('systems');

  const infoHeader = document.querySelector('.sidebar-info .sidebar-header h2');
  if (infoHeader) infoHeader.textContent = t('info');
}

// Initialize all UI
export async function initUI(viewer) {
  await loadAllData();
  // The markup is written in English; anything else comes from the dictionaries.
  updateUIText(state.language);
  initSystemsSidebar();
  initToolbar(viewer);
  initFooterActions(viewer);
  initHelpModal();
  initLanguageSelector();
  initSearch();
  initDrawers();
  initMobileSearch();
  initDepthSlider();
}

// Under 1024px the search field is hidden; this button is the only way to it.
function initMobileSearch() {
  const button = document.getElementById('searchOpen');
  const header = document.querySelector('.header');
  const input = document.getElementById('searchInput');
  if (!button || !header || !input) return;

  button.addEventListener('click', () => {
    const open = header.classList.toggle('search-open');
    button.setAttribute('aria-expanded', String(open));
    if (open) input.focus();
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      header.classList.remove('search-open');
      button.setAttribute('aria-expanded', 'false');
      input.blur();
    }
  });
}

// On narrow layouts both sidebars slide off-canvas; these wire the header
// buttons that bring them back and the close buttons inside them.
function initDrawers() {
  // On desktop the details panel is a grid column that opens on demand; below
  // the breakpoint both panels are off-canvas drawers.
  const app = document.getElementById('app');
  const toggleInfo = (open) => app?.classList.toggle('info-open', open);

  document.getElementById('infoOpen')?.addEventListener('click', () => {
    toggleInfo(!app.classList.contains('info-open'));
  });
  document.getElementById('infoToggle')?.addEventListener('click', () => toggleInfo(false));

  const drawers = [
    { sidebar: 'systemsSidebar', open: 'systemsOpen', close: 'systemsToggle' },
    { sidebar: 'infoSidebar', open: 'infoOpen', close: 'infoToggle' }
  ];

  drawers.forEach(({ sidebar, open, close }) => {
    const panel = document.getElementById(sidebar);
    if (!panel) return;

    document.getElementById(open)?.addEventListener('click', () => {
      panel.classList.add('open');
    });

    document.getElementById(close)?.addEventListener('click', () => {
      panel.classList.remove('open');
    });
  });
}