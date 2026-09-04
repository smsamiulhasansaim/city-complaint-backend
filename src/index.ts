import app from './app';
import env from './config/env';

if (require.main === module) {
  app.listen(env.port, () => {
    console.log(`API running on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

export default app;
