module.exports = {
  root: true,
  env: { browser: true, es2021: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint', 'react-hooks', 'jsx-a11y'],
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    // jsx-a11y is here deliberately for this project — a clinical
    // documentation tool has real WCAG/AODA obligations (see
    // docs/accessibility-note.md in the backend repo), so accessibility
    // lint failures should block CI the same way a type error would.
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
