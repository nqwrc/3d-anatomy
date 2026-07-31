// Data loading from JSON files
import { state, setTranslations, setSearchIndex, notify } from '../state/store.js';
import { asset } from './paths.js';

// Parts and systems are set up in main.js from systems.json (see data/anatomy.js);
// this only loads the UI translations and refreshes the search index.
export async function loadAllData() {
  try {
    // Load translations
    const [itResponse, enResponse] = await Promise.all([
      fetch(asset('data/translations/it.json')),
      fetch(asset('data/translations/en.json'))
    ]);

    if (itResponse.ok && enResponse.ok) {
      const it = await itResponse.json();
      const en = await enResponse.json();
      setTranslations({ it, en });
    }

    // Build search index
    buildSearchIndex();

    notify('dataLoaded', true);
  } catch (error) {
    console.error('Error loading data:', error);
    notify('dataError', error);
  }
}

function buildSearchIndex() {
  if (!state.partsData) return;

  const index = [];

  Object.entries(state.partsData).forEach(([partId, info]) => {
    const terms = [partId.toLowerCase()];

    if (info.name?.it) terms.push(info.name.it.toLowerCase());
    if (info.name?.en) terms.push(info.name.en.toLowerCase());
    if (info.latinName) terms.push(info.latinName.toLowerCase());
    if (info.searchTerms) terms.push(...info.searchTerms.map(t => t.toLowerCase()));

    index.push({
      partId,
      name: info.name?.it || info.name?.en || partId,
      system: info.system || 'unknown',
      terms: [...new Set(terms)]
    });
  });

  setSearchIndex(index);
}

export function searchStructures(query) {
  if (!state.searchIndex || query.length < 2) return [];

  const lowerQuery = query.toLowerCase();
  const results = [];

  for (const item of state.searchIndex) {
    for (const term of item.terms) {
      if (term.includes(lowerQuery)) {
        results.push(item);
        break;
      }
      if (results.length >= 10) break;
    }
    if (results.length >= 10) break;
  }

  return results;
}