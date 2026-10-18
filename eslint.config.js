import js from '@eslint/js';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const LIMITS = {
  lineLength: 100,
  fileLines: 300,
  testFileLines: 500,
  functionLines: 50,
  complexity: 10,
  depth: 3,
  params: 4,
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'content/**',
      'tooling/lint-fixtures/**',
      '**/*.generated.*',
      '.superpowers/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  comments.recommended,
  prettier,
  {
    files: ['**/*.{ts,js}'],
    rules: {
      'max-len': [
        'error',
        {
          code: LIMITS.lineLength,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
        },
      ],
      'max-lines': ['error', { max: LIMITS.fileLines, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'error',
        { max: LIMITS.functionLines, skipBlankLines: true, skipComments: true },
      ],
      complexity: ['error', LIMITS.complexity],
      'max-depth': ['error', LIMITS.depth],
      'max-params': ['error', LIMITS.params],
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'error',
      'no-eval': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'default-case': 'error',
      'no-magic-numbers': [
        'warn',
        { ignore: [-1, 0, 1, 2, 10, 100, 1000], ignoreArrayIndexes: true, enforceConst: true },
      ],
      '@eslint-community/eslint-comments/require-description': ['error', { ignore: [] }],
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
    },
  },
  {
    files: ['packages/**/*.ts', 'apps/**/*.ts', 'tooling/**/*.ts'],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts', '**/testing/**/*.ts'],
    rules: {
      'max-lines': [
        'error',
        { max: LIMITS.testFileLines, skipBlankLines: true, skipComments: true },
      ],
      'max-lines-per-function': 'off',
      'no-magic-numbers': 'off',
    },
  },
);
