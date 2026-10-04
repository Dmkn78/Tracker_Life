import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const environment = { ...process.env, NEXT_PUBLIC_WEBSITE_VERSION: randomUUID(), MOBILE_BUILD_TIME: new Date().toISOString() };
function run(script, args) {
  return new Promise((resolveBuild, reject) => {
    const child = spawn(process.execPath, [script, ...args], { stdio: 'inherit', env: environment });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolveBuild() : reject(new Error(`Build failed (${code})`)));
  });
}
try {
  const vite = resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js');
  await run(vite, ['build', '--config', 'mobile/vite.config.ts', '--mode', 'hosted']);
  await run(require.resolve('next/dist/bin/next'), ['build', '--webpack']);
} catch (error) { console.error(error); process.exitCode = 1; }
