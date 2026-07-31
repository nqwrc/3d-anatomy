// Anatomy data derived from the Z-Anatomy models.
//
// The GLB files exported from Z-Anatomy carry the anatomical name on every mesh
// (Terminologia Anatomica, English), with a `.l` / `.r` suffix for paired
// structures. Rather than duplicating those ~2800 names in a separate data file
// that would drift out of sync, systems.json only lists which mesh belongs to
// which system, and every label is derived from the mesh name at runtime.

import { asset } from '../utils/paths.js';

const SIDE_SUFFIX = { '.l': 'left', '.r': 'right' };

const SIDE_LABEL = {
  it: { left: 'sinistro', right: 'destro' },
  en: { left: 'left', right: 'right' }
};

export const SYSTEM_IDS = [
  'skeletal',
  'muscular',
  'joints',
  'cardiovascular',
  'lymphatic',
  'nervous',
  'visceral'
];

// System loaded on startup. The others are fetched when the user enables them,
// so the initial payload stays around 2 MB instead of ~47 MB.
export const DEFAULT_SYSTEM = 'skeletal';

export function splitSide(meshName) {
  const suffix = meshName.slice(-2);
  const side = SIDE_SUFFIX[suffix];
  return side
    ? { base: meshName.slice(0, -2), side }
    : { base: meshName, side: null };
}

export function formatPartName(meshName, lang = 'it') {
  const { base, side } = splitSide(meshName);

  // Z-Anatomy wraps structures outside the official terminology in parentheses.
  const clean = base.replace(/^\((.*)\)$/, '$1').trim();
  if (!side) return clean;

  const label = (SIDE_LABEL[lang] || SIDE_LABEL.en)[side];
  return `${clean} (${label})`;
}

export async function loadSystemsData() {
  const response = await fetch(asset('data/systems.json'));
  if (!response.ok) {
    throw new Error(`systems.json: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Builds the part dictionary the store expects, keyed by mesh name because that
// is what loadModel.js registers as partId.
export function buildPartsData(systemsData) {
  const parts = {};

  Object.entries(systemsData).forEach(([systemId, meshNames]) => {
    meshNames.forEach(meshName => {
      const { base, side } = splitSide(meshName);
      parts[meshName] = {
        id: meshName,
        meshName,
        name: {
          it: formatPartName(meshName, 'it'),
          en: formatPartName(meshName, 'en')
        },
        baseName: base,
        side,
        system: systemId
      };
    });
  });

  return parts;
}
