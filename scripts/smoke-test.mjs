import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const port = 18080;
const child = spawn(process.execPath, ['src/server.mjs'], {
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(port),
    WEBHOOK_SECRET: 'smoke-secret',
    FOUNDER_GITHUB_LOGIN: 'founder',
    ALLOWED_GITHUB_OWNER: 'altmanAI',
    GITHUB_TOKEN: 'development-only-placeholder'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

try {
  await sleep(500);
  const response = await fetch(`http://127.0.0.1:${port}/healthz`);
  if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
  console.log(await response.text());
} finally {
  child.kill('SIGTERM');
}
