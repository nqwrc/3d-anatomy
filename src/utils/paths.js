// Asset URLs are built from Vite's BASE_URL so the app also works when it is
// served from a sub-path (a GitHub Pages project site, for instance). Setting
// `base` in vite.config.js alone would not rewrite string literals passed to
// fetch() or to the loaders.

const BASE = import.meta.env.BASE_URL;

export function asset(path) {
  return `${BASE}${path.replace(/^\//, '')}`;
}
