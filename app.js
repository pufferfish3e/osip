import { createAppServer } from './server.mjs';

const APP_SERVER = createAppServer();
const DEFAULT_PORT = 4173;
const PORT = Number(process.env.PORT ?? DEFAULT_PORT);
APP_SERVER.on('error', (error) => { console.error('Aura server failed.', error); process.exitCode = 1; });
APP_SERVER.listen(PORT);
