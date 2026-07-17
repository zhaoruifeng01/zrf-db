import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Shell ESLint flat config - mirrors web/shared/eslint.config.js.
 * New packages in the strangler migration share one baseline.
 */
export default tseslint.config(
  { ignores: ['build/**', 'node_modules/**', '.react-router/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
);
