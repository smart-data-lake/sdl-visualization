import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

/**
 * Flat config, replacing the CRA "react-app" shareable config that package.json referenced.
 * eslint-config-react-app is unmaintained and eslintrc-only, so the rule set is rebuilt here
 * from the maintained plugins.
 *
 * Severities are chosen against the state of the codebase:
 *  - error: no current violations, so CI catches regressions
 *  - warn:  pre-existing violations that need a judgement call, listed with their count
 *  - off:   rules that do not apply to this codebase, with the reason
 */
export default tseslint.config(
  {
    ignores: ['build/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'src/data/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  jsxA11y.flatConfigs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      /* ---- off: not applicable here -------------------------------------------------- */
      // the parsed hocon/json config is `any` by nature, and react-app had this off too
      '@typescript-eslint/no-explicit-any': 'off',
      // tsc's noUnusedLocals/noUnusedParameters is the place for this
      '@typescript-eslint/no-unused-vars': 'off',
      // prop types are expressed as TypeScript types
      'react/prop-types': 'off',
      'react/display-name': 'off',
      // style, not correctness
      'no-var': 'off',
      'prefer-const': 'off',

      /* ---- warn: pre-existing violations to clean up ---------------------------------- */
      // React Compiler rules, new in eslint-plugin-react-hooks v7
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/use-memo': 'warn',
      // advisory, and the codebase has deliberate eslint-disable comments for it
      'react-hooks/exhaustive-deps': 'warn',
      // 6 hits: helpers that call hooks, plus a conditional useParams in TimelineRow
      'react-hooks/rules-of-hooks': 'warn',
      '@typescript-eslint/no-wrapper-object-types': 'warn', // 13: String/Number used as types
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn', // 12
      '@typescript-eslint/no-unused-expressions': 'warn', // 6
      '@typescript-eslint/no-empty-object-type': 'warn', // 3
      '@typescript-eslint/no-require-imports': 'warn', // 2
      'react/jsx-key': 'warn', // 8
      'react/no-unescaped-entities': 'warn', // 4
      'react/no-deprecated': 'warn', // 2
      'react/no-children-prop': 'warn', // 2
      'react/no-find-dom-node': 'warn', // 1
      'no-prototype-builtins': 'warn', // 3
      'no-case-declarations': 'warn', // 3
      'no-unsafe-optional-chaining': 'warn', // 3
      'no-empty': 'warn', // 2
      'no-useless-escape': 'warn', // 1
      'no-empty-pattern': 'warn', // 1
      'no-extra-boolean-cast': 'warn', // 1
      'no-unused-private-class-members': 'warn', // 1
      'jsx-a11y/no-autofocus': 'warn', // 3
      'jsx-a11y/anchor-is-valid': 'warn', // 1
      'jsx-a11y/no-static-element-interactions': 'warn', // 1
    },
  },
);
