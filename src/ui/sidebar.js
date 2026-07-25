// Sidebar UI - Systems panel with collapsible groups
import { state, subscribe, getSystemParts, translate } from '../state/store.js';
import { getMeshRegistry, getMeshesBySystem } from '../viewer/loadModel.js';
import { hideSystem, showSystem, setSystemTransparency, getSystemVisibilityState } from '../viewer/visibility.js';
import { selectPartById, deselectPart } from '../viewer/selection.js';
import { setView, resetView } from '../viewer/camera.js';
import { loadAllData, searchStructures } from '../utils/dataLoader.js';

export function initSystemsSidebar() {
  const container = document.getElementById('systemsList');
  if (!container) return;

  // System order and labels
  const systemOrder = [
    'muscular', 'skeletal', 'cardiovascular', 'respiratory',
    'digestive', 'urinary', 'nervous', 'joints', 'lymphatic'
  ];

  const systemLabels = {
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

  const systemIcons = {
    muscular: '💪',
    skeletal: '🦴',
    cardiovascular: '❤️',
    respiratory: '🫁',
    digestive: '🫃',
    urinary: '🫘',
    nervous: '🧠',
    joints: '🦵',
    lymphatic: '🫧'
  };

  const lang = state.language || 'it';

  container.innerHTML = systemOrder.map(systemId => {
    const parts = getSystemParts(systemId);
    const count = parts.length;
    const icon = systemIcons[systemId] || '🔬';
    const label = systemLabels[lang]?.[systemId] || systemId;

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

  // Add event listeners for system toggles
  container.querySelectorAll('[data-system-checkbox]').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const systemId = e.target.dataset.systemCheckbox;
      const content = e.target.closest('.system-group').querySelector('.system-group-content');

      if (e.target.checked) {
        showSystem(systemId);
        content.style.display = 'block';
      } else {
        hideSystem(systemId);
        content.style.display = 'none';
      }
    });
  });

  // Add click handlers for system labels to expand/collapse structure list
  container.querySelectorAll('.system-group-label').forEach(label => {
    label.addEventListener('click', (e) => {
      if (e.target.type === 'checkbox') return;
      const group = label.closest('.system-group');
      const content = group.querySelector('.system-group-content');
      const checkbox = group.querySelector('[data-system-checkbox]');
      const systemId = group.dataset.system;

      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change'));

      if (checkbox.checked && content.children.length === 0) {
        populateSystemStructures(systemId, content);
      }
    });
  });
}

function populateSystemStructures(systemId, container) {
  const parts = getSystemParts(systemId);
  const lang = state.language || 'it';
  const meshRegistry = getMeshRegistry();

  container.innerHTML = parts.map(partId => {
    const mesh = meshRegistry.get(partId);
    const info = mesh?.userData?.info || {};

    const name = info.name?.[lang] || info.name?.en || partId;
    const partState = state.partStates.get(partId);
    const visible = partState?.visible !== false;
    const selected = partState?.selected === true;

    return `
      <div class="structure-item ${selected ? 'selected' : ''}" data-part="${partId}">
        <input type="checkbox" ${visible ? 'checked' : ''} data-part-checkbox="${partId}">
        <span class="structure-name">${escapeHtml(name)}</span>
        <div class="structure-actions">
          <button class="action-btn isolate" data-action="isolate" data-part="${partId}" title="Isola" aria-label="Isola">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="action-btn hide" data-action="hide" data-part="${partId}" title="Nascondi" aria-label="Nascondi">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M2 2l20 20"/></svg>
          </button>
          <button class="action-btn transparent" data-action="transparent" data-part="${partId}" title="Trasparenza" aria-label="Trasparenza">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners for structure items
  container.querySelectorAll('[data-part-checkbox]').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const partId = e.target.dataset.partCheckbox;
      if (e.target.checked) {
        showSystem(partId.split('_')[0]);
      } else {
        hideSystem(partId.split('_')[0]);
      }
    });
  });

  container.querySelectorAll('.structure-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.type === 'checkbox') return;
      const partId = item.dataset.part;
      selectPartById(partId, state.viewer);
    });
  });

  container.querySelectorAll('[data-action="isolate"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const partId = e.currentTarget.dataset.part;
      import('../viewer/visibility.js').then(({ isolatePart }) => {
        isolatePart(partId);
      });
    });
  });

  container.querySelectorAll('[data-action="hide"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const partId = e.currentTarget.dataset.part;
      import('../viewer/visibility.js').then(({ hidePart }) => {
        hidePart(partId);
        deselectPart();
      });
    });
  });

  container.querySelectorAll('[data-action="transparent"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const partId = e.currentTarget.dataset.part;
      const visibility = getPartVisibility(partId);
      import('../viewer/visibility.js').then(({ setPartTransparency }) => {
        setPartTransparency(partId, visibility.opacity < 1 ? 1 : 0.3);
      });
    });
  });
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
  const buttons = {
    resetBtn: () => resetView(viewer),
    isolateBtn: () => isolateSelected(),
    hideBtn: () => hideSelected(),
    transparentBtn: () => toggleTransparencySelected(),
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
    import('../viewer/visibility.js').then(({ isolatePart }) => {
      isolatePart(state.selectedPart.id);
    });
  }
}

function hideSelected() {
  if (state.selectedPart) {
    import('../viewer/visibility.js').then(({ hidePart }) => {
      hidePart(state.selectedPart.id);
      deselectPart();
    });
  }
}

function toggleTransparencySelected() {
  if (state.selectedPart) {
    const visibility = getPartVisibility(state.selectedPart.id);
    import('../viewer/visibility.js').then(({ setPartTransparency }) => {
      setPartTransparency(state.selectedPart.id, visibility.opacity < 1 ? 1 : 0.3);
    });
  }
}

// Footer actions
export function initFooterActions(viewer) {
  const buttons = {
    footerIsolateBtn: () => isolateSelected(),
    footerHideBtn: () => hideSelected(),
    footerTransparentBtn: () => toggleTransparencySelected(),
    footerShowAllBtn: () => resetView(viewer)
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
      import('../state/store.js').then(({ setLanguage }) => {
        setLanguage(e.target.value);
      });
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
      results.innerHTML = matches.map(match => `
        <div class="search-result-item" data-part="${match.partId}">
          <span class="result-icon">🔍</span>
          <span class="result-name">${escapeHtml(match.name)}</span>
          <span class="result-system">${escapeHtml(match.system)}</span>
        </div>
      `).join('');

      results.classList.add('show');

      results.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const partId = item.dataset.part;
          selectPartById(partId, state.viewer);
          input.value = '';
          results.innerHTML = '';
          results.classList.remove('show');
          input.blur();
        });
      });
    } else {
      results.innerHTML = '<div class="search-result-item">Nessun risultato</div>';
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
  initSystemsSidebar();
  initToolbar(viewer);
  initFooterActions(viewer);
  initHelpModal();
  initLanguageSelector();
  initSearch();
}