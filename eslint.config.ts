import js from '@eslint/js'
import prettier from 'eslint-config-prettier/flat'
import importX from 'eslint-plugin-import-x'
import nodePlugin from 'eslint-plugin-n'
import tseslint from 'typescript-eslint'

/**
 * @type {import("@eslint/config-helpers").InfiniteConfigArray}
 */
const config: import('@eslint/config-helpers').InfiniteConfigArray = [
    js.configs.recommended,
    nodePlugin.configs['flat/recommended'],

    // Type-aware TypeScript rules
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,

    // Global config (typed linting ON)
    {
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            'import-x': importX,
        },

        languageOptions: {
            parserOptions: {
                project: true,
                tsconfigRootDir: import.meta.dirname,
            },

            globals: {
                fetch: false,
                Response: false,
                Request: false,
                addEventListener: false,
            },

            ecmaVersion: 2021,
            sourceType: 'module',
        },

        rules: {
            'no-debugger': ['error'],

            'no-empty': [
                'warn',
                {
                    allowEmptyCatch: true,
                },
            ],

            'no-process-exit': 'off',
            'no-useless-escape': 'off',

            'prefer-const': [
                'warn',
                {
                    destructuring: 'all',
                },
            ],

            // import-x
            'import-x/consistent-type-specifier-style': ['error', 'prefer-top-level'],
            'import-x/order': [
                'error',
                {
                    groups: ['external', 'builtin', 'internal', 'parent', 'sibling', 'index'],
                    alphabetize: {
                        order: 'asc',
                        caseInsensitive: true,
                    },
                },
            ],
            'import-x/no-duplicates': 'error',

            // node plugin overrides (TS handles these better)
            'n/no-missing-import': 'off',
            'n/no-missing-require': 'off',
            'n/no-deprecated-api': 'off',
            'n/no-unpublished-import': 'off',
            'n/no-unpublished-require': 'off',
            'n/no-unsupported-features/es-syntax': 'off',
            'n/no-unsupported-features/node-builtins': 'off',

            // TypeScript rules
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    prefer: 'type-imports',
                },
            ],
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'off',
            '@typescript-eslint/no-empty-function': [
                'error',
                {
                    allow: ['arrowFunctions'],
                },
            ],
            '@typescript-eslint/no-unused-expressions': 'off',
            '@typescript-eslint/no-empty-interface': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-inferrable-types': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
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
            '@typescript-eslint/no-var-requires': 'off',

            '@typescript-eslint/no-base-to-string': [
                'error',
                {
                    ignoredTypeNames: ['Error', 'RegExp', 'URL', 'URLSearchParams'],
                },
            ],

            '@typescript-eslint/restrict-template-expressions': [
                'error',
                {
                    allow: [{ name: ['Error', 'URL', 'URLSearchParams'], from: 'lib' }],
                    allowAny: true,
                    allowBoolean: true,
                    allowNullish: true,
                    allowNumber: true,
                    allowRegExp: true,
                },
            ],
        },
    },
    {
        files: [
            '**/*.js',
            'eslint.config.ts',
            'drizzle.config.ts',
            'drizzle.config.js',
        ],
        languageOptions: {
            parserOptions: {
                project: null,
            },
        },
    },

    // Prettier (must come late)
    prettier,

    // Optional overrides after Prettier
    {
        rules: {
            curly: ['error', 'all'],
        },
    },
]

export default config