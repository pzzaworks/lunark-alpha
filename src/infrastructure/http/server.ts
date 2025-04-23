import express from 'express';
import { createServer, Server as NodeHttpServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import xss from 'xss';
import hpp from 'hpp';

import { PORT, corsOptions, securityConfig, paths } from '../../config/app.config';
import { setupSocketServer } from '../socket/server';
import { errorHandler } from '../../api/middlewares/errorHandler';
import { setupRoutes } from '../../api/routes';
import { log } from '../../common/utils/log';

let io: Server | null = null;
let httpServer: NodeHttpServer | null = null;

export { NodeHttpServer };

function xssMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
    if (req.body) {
        for (let key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = xss(req.body[key]);
            }
        }
    }
    next();
}

function securityHeaders(req: express.Request, res: express.Response, next: express.NextFunction): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
}

function setupMiddleware(app: express.Application): void {
    // CORS should be first
    app.use(cors(corsOptions));

    // Then security middleware
    app.use(helmet({
        crossOriginResourcePolicy: false,
        crossOriginOpenerPolicy: false
    }));
    
    app.use(hpp());
    app.use(xssMiddleware);

    app.use(express.json({ limit: securityConfig.bodyLimit }));
    app.use(express.urlencoded({ extended: true, limit: securityConfig.bodyLimit }));

    app.use(securityHeaders);
}

function setupErrorHandling(app: express.Application): void {
    app.use((req, res, next) => {
        const error = new Error(`Route ${req.originalUrl} not found`);
        res.status(404);
        next(error);
    });

    app.use(errorHandler);
}

export async function startServer(): Promise<void> {
    try {
        const app = express();
        httpServer = createServer(app);

        setupMiddleware(app);
        setupRoutes(app);
        setupErrorHandling(app);
        
        // Start the server before setting up Socket.IO
        await new Promise<void>((resolve, reject) => {
            httpServer!.listen(PORT, () => {
                log(`🚀 Lunark AI running on port ${PORT}`);
                resolve();
            }).on('error', (err) => {
                log(`❌ Server failed to start: ${err.message}`);
                reject(err);
            });
        });

        // Setup Socket.IO after server is running
        io = setupSocketServer(httpServer);
    } catch (error) {
        await cleanup();
        process.exit(1);
    }
}

export async function cleanup(): Promise<void> {
    try {
        if (io) {
            await new Promise<void>((resolve) => {
                io?.close(() => {
                    resolve();
                });
            });
            io = null;
        }

        if (httpServer?.listening) {
            await new Promise<void>((resolve) => {
                httpServer!.close((err) => {
                    if (err) {}
                    resolve();
                });
            });
        }
    } catch (error) {
        throw error;
    }
}

export function getIO(): Server | null {
    return io;
} 