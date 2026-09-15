const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', 'legacy/**'],
  },
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              importNames: ['default'],
              message: 'Use the shared Axios instance or a typed resource function from src/api.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/api/axios.ts', 'src/api/token-service.ts', 'src/api/api-error.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]);
