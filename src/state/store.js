// State Management - Single source of truth for application state

export const state = {
  // Selected structure
  selectedPart: null,

  // Loaded systems
  loadedSystems: [],

  // Visibility states per part
  partStates: new Map(), // Map<partId, { visible: true, opacity: 1, selected: false }>

  // Currently isolated part (null = none isolated)
  isolatedPart: null,

  // Parts that are hidden
  hiddenParts: new Set(),

  // Parts with transparency
  transparentParts: new Set(),

  // Current language
  language: 'it',

  // Loaded data
  partsData: null,
  systemsData: null,
  regionsData: null,
  translations: { it: {}, en: {} },

  // Search index
  searchIndex: [],

  // Camera/view state
  currentView: 'front',
  isAnimating: false,

  // Loading state
  loading: {
    systems: {},
    progress: 0,
    total: 0
  },

  // Viewer reference (set after initialization)
  viewer: null,

  // Selection history for undo
  selectionHistory: [],
  maxHistory: 20
};

// Subscribers for reactive updates
const subscribers = new Map(); // Map<key, Set<callback>>

export function subscribe(key, callback) {
  if (!subscribers.has(key)) {
    subscribers.set(key, new Set());
  }
  subscribers.get(key).add(callback);
  return () => unsubscribe(key, callback);
}

export function unsubscribe(key, callback) {
  if (subscribers.has(key)) {
    subscribers.get(key).delete(callback);
  }
}

export function notify(key, value) {
  if (subscribers.has(key)) {
    subscribers.get(key).forEach(cb => cb(value));
  }
}

// State setters with notification
export function setSelectedPart(part) {
  state.selectedPart = part;
  if (part) {
    // Add to history
    state.selectionHistory.unshift(part);
    if (state.selectionHistory.length > state.maxHistory) {
      state.selectionHistory.pop();
    }
  }
  notify('selectedPart', part);
}

let partStateBatchDepth = 0;

export function setPartState(partId, updates) {
  const current = state.partStates.get(partId) || { visible: true, opacity: 1, selected: false };
  state.partStates.set(partId, { ...current, ...updates });
  if (partStateBatchDepth === 0) notify('partStates', state.partStates);
}

// Bulk operations (isolate, show all, per-system toggles) touch every structure.
// Subscribers walk the whole map, so notifying once per structure turns a single
// click into thousands of DOM queries.
export function batchPartStates(fn) {
  partStateBatchDepth++;
  try {
    fn();
  } finally {
    partStateBatchDepth--;
    if (partStateBatchDepth === 0) notify('partStates', state.partStates);
  }
}

export function setPartStates(partStates) {
  state.partStates = partStates;
  notify('partStates', partStates);
}

export function setIsolatedPart(partId) {
  state.isolatedPart = partId;
  notify('isolatedPart', partId);
}

export function setHiddenParts(parts) {
  state.hiddenParts = new Set(parts);
  notify('hiddenParts', state.hiddenParts);
}

export function setTransparentParts(parts) {
  state.transparentParts = new Set(parts);
  notify('transparentParts', state.transparentParts);
}

export function setLanguage(lang) {
  state.language = lang;
  notify('language', lang);
}

export function setPartsData(data) {
  state.partsData = data;
  notify('partsData', data);
}

export function setSystemsData(data) {
  state.systemsData = data;
  notify('systemsData', data);
}

export function setRegionsData(data) {
  state.regionsData = data;
  notify('regionsData', data);
}

export function setTranslations(data) {
  state.translations = data;
  notify('translations', data);
}

export function setSearchIndex(index) {
  state.searchIndex = index;
  notify('searchIndex', index);
}

export function setCurrentView(view) {
  state.currentView = view;
  notify('currentView', view);
}

export function setAnimating(animating) {
  state.isAnimating = animating;
  notify('isAnimating', animating);
}

export function setLoadingSystem(system, loaded, progress = 100) {
  state.loading.systems[system] = { loaded, progress };
  const loadedCount = Object.values(state.loading.systems).filter(s => s.loaded).length;
  const totalCount = Object.keys(state.loading.systems).length;
  state.loading.progress = totalCount > 0 ? (loadedCount / totalCount) * 100 : 0;
  state.loading.total = totalCount;
  notify('loading', { ...state.loading });
}

export function setViewer(viewer) {
  state.viewer = viewer;
}

export function getViewer() {
  return state.viewer;
}

export function getPartState(partId) {
  return state.partStates.get(partId) || { visible: true, opacity: 1, selected: false };
}

export function isPartVisible(partId) {
  const partState = getPartState(partId);
  if (state.isolatedPart && state.isolatedPart !== partId) return false;
  return partState.visible && !state.hiddenParts.has(partId);
}

export function getStructureInfo(partId) {
  if (!state.partsData) return null;
  return state.partsData[partId] || null;
}

export function translate(key, lang = state.language) {
  const dict = state.translations[lang] || state.translations.it;
  return dict[key] || key;
}

export function getSystemParts(systemId) {
  if (!state.systemsData) return [];
  return state.systemsData[systemId] || [];
}

export function getPartsByRegion(regionId) {
  if (!state.regionsData) return [];
  return state.regionsData[regionId] || [];
}

export function resetState() {
  state.selectedPart = null;
  state.isolatedPart = null;
  state.hiddenParts.clear();
  state.transparentParts.clear();
  state.partStates.clear();
  state.selectionHistory = [];
  state.currentView = 'front';
  notify('selectedPart', null);
  notify('partStates', state.partStates);
  notify('isolatedPart', null);
  notify('hiddenParts', state.hiddenParts);
  notify('transparentParts', state.transparentParts);
  notify('currentView', 'front');
}