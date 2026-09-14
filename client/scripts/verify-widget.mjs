import { existsSync, readFileSync } from 'node:fs';

const path = new URL('../dist/widget.js', import.meta.url);
if (!existsSync(path)) throw new Error('dist/widget.js is missing. Run npm run build first.');
const widget = readFileSync(path, 'utf8');
for (const required of ['dataset.org', 'dataset.assistantKey', '/chat/', 'iframe']) {
  if (!widget.includes(required)) throw new Error(`widget.js is missing expected content: ${required}`);
}
console.log('Widget build verification passed: dist/widget.js is present and contains the embed contract.');
