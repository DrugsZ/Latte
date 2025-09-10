import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from "eslint-config-prettier/flat";
import importPlugin from 'eslint-plugin-import';

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintConfigPrettier,
  importPlugin.flatConfigs.recommended,
  {
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: [
            './tsconfig.json',
          ],
        },
      },
    },
    rules: {
      "react/jsx-filename-extension": "off",
      "typescript-eslint/lines-between-class-members": "off",
      "max-classes-per-file": "off",
      "import/prefer-default-export": "off",
      "@typescript-eslint/lines-between-class-members": "off",
      "no-underscore-dangle": "off",
      "no-plusplus": "off",
      "no-param-reassign": "off",
      "class-methods-use-this": "off",

      "no-restricted-imports": ["error", {
        patterns: [".*"],
      }],

      "consistent-return": "off",
      "no-console": "off",

      "@typescript-eslint/consistent-type-imports": ["error", {
        prefer: "type-imports",
      }],

      "@typescript-eslint/no-unused-vars": "off",

      "@typescript-eslint/naming-convention": ["error", {
        selector: "default",
        modifiers: ["private"],
        format: null,
        leadingUnderscore: "require",
      }, {
          selector: "class",
          format: ["PascalCase"],
        }, {
          selector: "default",
          modifiers: ["private", "static"],
          format: null,
          leadingUnderscore: "allow",
        }],

      "@typescript-eslint/no-shadow": "off",
      "no-nested-ternary": "off",
      "no-bitwise": "off",
      "default-case": "off",
      "no-continue": "off",
      "no-restricted-syntax": "off",
      "guard-for-in": "off",
    },
  }
);