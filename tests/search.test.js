import { describe, it, expect, beforeEach } from 'vitest';
import { normalise, searchStructures } from '../src/utils/dataLoader.js';
import { state } from '../src/state/store.js';

// The index is normally built from the models; these rows are the same shape.
function row(base, system, italian = []) {
  return {
    key: `${base}|${system}`,
    base,
    label: base,
    system,
    sides: { left: `${base}.l`, right: `${base}.r` },
    partIds: [`${base}.l`, `${base}.r`],
    italian,
    terms: [normalise(base), ...italian.map(normalise)]
  };
}

describe('normalise', () => {
  it('folds case and accents so Italian queries match', () => {
    expect(normalise('Femore')).toBe('femore');
    expect(normalise('Muscolo grande gluteo ')).toBe('muscolo grande gluteo');
    expect(normalise('cartilagine tiroidea')).toBe(normalise('Cartilagine Tiroidea'));
  });
});

describe('searchStructures', () => {
  beforeEach(() => {
    state.loadedSystems = ['skeletal'];
    state.searchIndex = [
      row('Femur', 'skeletal', ['femore']),
      row('Ligament of head of femur', 'joints'),
      row('Ulna', 'skeletal'),
      row('Ulnar artery', 'cardiovascular'),
      row('Ulnar nerve', 'nervous')
    ];
  });

  it('ignores queries shorter than two characters', () => {
    expect(searchStructures('f')).toEqual([]);
    expect(searchStructures('')).toEqual([]);
  });

  it('ranks the exact structure above one that merely contains the word', () => {
    const [first] = searchStructures('femur');
    expect(first.base).toBe('Femur');
  });

  it('finds a structure through its Italian synonym', () => {
    const [first] = searchStructures('femore');
    expect(first.base).toBe('Femur');
  });

  it('puts the bone before the vessels that share its name', () => {
    const results = searchStructures('ulna').map(r => r.base);
    expect(results[0]).toBe('Ulna');
    expect(results).toContain('Ulnar artery');
  });

  it('returns nothing for a query that matches no structure', () => {
    expect(searchStructures('zzzzzz')).toEqual([]);
  });

  it('honours the result limit', () => {
    expect(searchStructures('ul', 2)).toHaveLength(2);
  });
});
