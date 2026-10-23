import { createServerFn } from '@tanstack/react-start';
export const remoteProbe = createServerFn({ method: 'POST' }).handler(async () => ({ owner: 'cart', executedBy: 'CART_BACKEND_HANDLER_MARKER', runtime: typeof process, pid: process.pid }));
