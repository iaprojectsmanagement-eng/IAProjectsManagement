import { spawn } from 'node:child_process';
import { createServer } from 'vite';

process.env.VITE_DATA_MODE = 'local';
process.env.VITE_ALLOW_LOCAL_DEMO = 'true';

const server = await createServer({
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
  logLevel: 'warn',
});

try {
  await server.listen();
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], {
      cwd: process.cwd(), env: process.env, stdio: 'inherit', windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (exitCode) => resolve(exitCode ?? 1));
  });
  process.exitCode = code;
} finally {
  await server.close();
}
