import { CorsOptions } from 'cors';

export const PORT = 4545;

export const corsOptions: CorsOptions = {
  origin: process.env.APP_URL,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  maxAge: 600,
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
};

export const securityConfig = {
  bodyLimit: '2mb',
};

export const paths = {
  api: {
    root: '/api',
    admin: '/api/admin',
    chat: '/api/chat',
    message: '/api/message',
    status: '/api/status',
  },
}; 