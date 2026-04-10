import unusedImports from 'eslint-plugin-unused-imports';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'Data/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      // disable default rule (important)
      'no-unused-vars': 'off',

      // remove unused imports automatically
      'unused-imports/no-unused-imports': 'error',

      // warn for unused vars/functions
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
];
