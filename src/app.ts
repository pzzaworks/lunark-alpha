import 'dotenv/config';
import 'module-alias/register';
import { startServer, cleanup } from './infrastructure/http/server';
import { log } from './common/utils/log';

const removeAllHandlers = () => {
  const signals = ['SIGTERM', 'SIGINT', 'uncaughtException', 'unhandledRejection'];
  signals.forEach(signal => {
    process.removeAllListeners(signal);
  });
};

const setupProcessHandlers = () => {
  process.once('SIGTERM', async () => {
    await cleanup();
    process.exit(0);
  });

  process.once('SIGINT', async () => {
    await cleanup();
    process.exit(0);
  });

  process.once('uncaughtException', async (error) => {
    log('❌ Fatal uncaught exception:', error);
    await cleanup();
    process.exit(1);
  });

  process.once('unhandledRejection', async (error) => {
    log('❌ Fatal unhandled rejection:', error);
    await cleanup();
    process.exit(1);
  });
};

const bootstrap = async () => {
  removeAllHandlers();
  setupProcessHandlers();
  await startServer();
};

bootstrap().catch((error) => {
  log('❌ Fatal error during bootstrap:', error);
  process.exit(1);
});