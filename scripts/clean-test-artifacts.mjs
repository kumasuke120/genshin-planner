import { rm } from 'node:fs/promises';
import path from 'node:path';

const workspace = path.resolve(import.meta.dirname, '..');
const targets = [
  path.join(workspace, 'out', 'test-results'),
  path.join(workspace, 'out', 'coverage'),
  path.join(workspace, 'out', 'test-build')
];

for (const target of targets) {
  const relative = path.relative(workspace, target);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !relative.startsWith(`out${path.sep}`)) {
    throw new Error(`拒绝清理工作区外的测试目录：${target}`);
  }
  await rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
