import app from './app';
import env from './config/env';

/**
 * Local / traditional server. On Vercel the platform imports the default export
 * from this module and invokes it as a serverless function, so `app.listen` is
 * only run when this file is executed directly (e.g. `npm run dev` / `start`).
 */
if (require.main === module) {
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`🚀 API running on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

export default app;
