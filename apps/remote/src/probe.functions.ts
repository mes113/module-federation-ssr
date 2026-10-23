import { createServerFn } from '@tanstack/react-start';
export const remoteProbe = createServerFn({ method: 'POST' }).handler(async () => ({ owner: 'remote', executedBy: 'REMOTE_BACKEND_HANDLER_MARKER', runtime: typeof process, pid: process.pid }));
