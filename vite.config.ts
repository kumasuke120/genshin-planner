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
  server: { port: 5173, strictPort: true },
  base: './',
  build: { outDir: '../../dist-renderer', emptyOutDir: true },
  test: { environment: 'jsdom', globals: true, include: ['../domain/**/*.test.ts', '../main/**/*.test.ts', '**/*.{test,spec}.?(c|m)[jt]s?(x)'] }
});
