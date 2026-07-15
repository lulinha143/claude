/* eslint-env node */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
  ignorePatterns: [
    'dist/',
    'dist-electron/',
    'release/',
    'coverage/',
    'node_modules/',
    '*.config.ts',
    '*.config.js',
    'scripts/build-electron.mjs',
  ],
  overrides: [
    {
      files: ['electron/**/*.ts'],
      env: { node: true, browser: false },
    },
    {
      files: ['tests/**/*.ts'],
      env: { node: true },
    },
  ],
};
