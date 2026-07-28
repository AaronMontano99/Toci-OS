const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    files: ['jest.setup.js'],
    languageOptions: {
      globals: { jest: 'readonly', require: 'readonly' },
    },
  },
];
