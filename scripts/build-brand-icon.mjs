import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const workspace = path.resolve(import.meta.dirname, '..');
const source = path.join(workspace, 'resources', 'brand', 'app-icon.svg');
const output = path.join(workspace, 'resources', 'brand');
await mkdir(output, { recursive: true });

try {
  execFileSync('magick', ['-background', 'none', source, '-resize', '1024x1024', path.join(output, 'app-icon.png')], { stdio: 'inherit' });
  execFileSync('magick', ['-background', 'none', source, '-define', 'icon:auto-resize=256,128,64,48,32,24,16', path.join(output, 'app.ico')], { stdio: 'inherit' });
} catch (error) {
  throw new Error('无法调用 ImageMagick 生成品牌图标，请确认 magick 已加入 PATH', { cause: error });
}
