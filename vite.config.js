import { defineConfig, loadEnv } from 'vite';
import { createRsvpHandler } from './api/rsvp.js';

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [{
    name: 'local-rsvp-api',
    configureServer(server) {
      const handler = createRsvpHandler({ env: { ...loadEnv(mode, process.cwd(), ''), ...process.env } });
      server.middlewares.use('/api/rsvp', (req, res) => {
        handler(req, res).catch(() => { res.statusCode = 500; res.end(); console.error('[rsvp] Request failed'); });
      });
    },
  }],
}));
