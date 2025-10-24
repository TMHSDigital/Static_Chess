// ESLint v9 flat config
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // Allow tests to reference Node globals
        ...globals.node,
        // JSDOM/Jest globals (tests)
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off'
    }
  },
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.playwright/**'
    ]
  }
];


