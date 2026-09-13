import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';

function buildId(): string {
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'local-uncommitted'; } catch { return 'local-uncommitted'; }
}

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0'), __APP_AUTHOR__: JSON.stringify('Kumasuke120'), __BUILD_ID__: JSON.stringify(buildId()) },
  root: 'src/renderer',
  publicDir: '../../resources/brand',
  server: { port: 5173, strictPort: true },
  base: './',
  build: { outDir: '../../out/renderer', emptyOutDir: true },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      allowExternal: true,
      reportsDirectory: '../../out/coverage',
      reporter: ['text', 'html', 'json-summary'],
      include: ['../domain/**/*.ts', '../main/**/*.ts', './**/*.{ts,tsx}'],
      exclude: ['**/*.test.*', '**/*.d.ts', '../main/index.ts', '../main/data-cli.ts', 'main.tsx'],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 }
    },
    projects: [
      { test: { name: 'unit', environment: 'node', include: ['../domain/**/*.test.ts', '../data/**/*.test.ts'] } },
      { test: { name: 'component', environment: 'jsdom', include: ['**/*.test.tsx'], setupFiles: ['./test/setup.ts'] } },
      { test: { name: 'integration', environment: 'node', include: ['../main/**/*.test.ts'] } }
    ]
  }
});
