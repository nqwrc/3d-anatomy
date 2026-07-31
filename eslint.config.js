import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'assets-src/**', 'public/draco/**']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'tools/**/*.mjs', '*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      // The two defects that shipped to production were a shadowed import and a
      // call to a name that was never imported. Both are caught here.
      'no-shadow': 'error',
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  }
];
