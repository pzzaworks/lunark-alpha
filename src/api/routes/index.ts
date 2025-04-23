import { Application, Request, Response } from 'express';
import { paths } from '../../config/app.config';
import chatRoutes from './chat';
import messageRoutes from './message';
import adminRoutes from './admin';
import auth from '../middlewares/auth';

export const setupRoutes = (app: Application) => {
  // Root route handler
  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({ message: 'Lunark AI is running' });
  });

  app.get(paths.api.status, (_req: Request, res: Response) => {
    try {
      const status = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '0.1.0'
      };
      res.status(200).json(status);
    } catch (error) {
      console.error('Status endpoint error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.use(paths.api.admin, adminRoutes);

  app.use(paths.api.chat, auth, chatRoutes);
  app.use(paths.api.message, auth, messageRoutes);
}; 