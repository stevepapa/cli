import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    files: ['src/cli/**/*.ts'],
    rules: {
      'no-console': 'error',
      'no-process-exit': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ThrowStatement > NewExpression[callee.name="Error"]',
          message:
            'Do not throw new Error() from the CLI layer; throw a typed CLI error or rethrow.',
        },
      ],
    },
  },
  {
    files: ['src/cli/output.ts'],
    rules: {
      'no-process-exit': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/'],
  }
);
