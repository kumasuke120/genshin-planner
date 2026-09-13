import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const projectRules = {
  rules: {
    'comment-no-terminal-period': {
      meta: {
        type: 'layout',
        docs: { description: '禁止注释内容行使用句末句号' },
        fixable: 'whitespace',
        schema: [],
        messages: { terminalPeriod: '注释内容行末尾不需要句号' }
      },
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments()) {
              const lines = comment.value.split(/\r?\n/u);
              if (lines.some((line) => /[。.][ \t]*$/u.test(line.replace(/^\s*\*/u, '').trim()))) {
                context.report({
                  loc: comment.loc,
                  messageId: 'terminalPeriod',
                  fix(fixer) {
                    const commentText = context.sourceCode.getText(comment);
                    return fixer.replaceText(
                      comment,
                      commentText.replace(/[。.](?=[ \t]*(?:\r?\n|\*\/|$))/gu, '')
                    );
                  }
                });
              }
            }
          }
        };
      }
    }
  }
};

export default tseslint.config(
  { ignores: ['node_modules/**', 'out/**', '.codex/**', '.idea/**', 'resources/game-data/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'vite.config.ts', 'playwright.config.ts'],
    plugins: { jsdoc, 'react-hooks': reactHooks, project: projectRules },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        AbortController: 'readonly', AbortSignal: 'readonly', Buffer: 'readonly', URL: 'readonly',
        __APP_AUTHOR__: 'readonly', __APP_VERSION__: 'readonly', __BUILD_ID__: 'readonly',
        document: 'readonly', fetch: 'readonly', navigator: 'readonly', process: 'readonly', window: 'readonly'
      }
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react-hooks/exhaustive-deps': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'project/comment-no-terminal-period': 'error',
      'jsdoc/check-alignment': 'error',
      'jsdoc/check-param-names': 'error',
      'jsdoc/match-description': ['error', {
        contexts: [
          'ExportNamedDeclaration[declaration]',
          'ExportDefaultDeclaration',
          'ExportNamedDeclaration > TSInterfaceDeclaration TSPropertySignature',
          'ExportNamedDeclaration > TSInterfaceDeclaration TSMethodSignature',
          'VariableDeclaration:has(VariableDeclarator[id.name="api"])',
          'VariableDeclarator[id.name="api"] > ObjectExpression > Property'
        ],
        mainDescription: {
          match: '[\\u3400-\\u9fff]',
          message: '导出的公开 API 必须使用简体中文说明用途。'
        }
      }],
      'jsdoc/require-param': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-jsdoc': ['error', {
        contexts: [
          'ExportNamedDeclaration[declaration]',
          'ExportDefaultDeclaration',
          'ExportNamedDeclaration > TSInterfaceDeclaration TSPropertySignature',
          'ExportNamedDeclaration > TSInterfaceDeclaration TSMethodSignature',
          'VariableDeclaration:has(VariableDeclarator[id.name="api"])',
          'VariableDeclarator[id.name="api"] > ObjectExpression > Property'
        ],
        enableFixer: false,
        require: { FunctionDeclaration: false }
      }],
      'jsdoc/require-returns': 'error',
      'jsdoc/require-returns-description': 'error'
    }
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } }
  }
);
