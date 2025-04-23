import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { socketHandlers } from './handlers';
import { corsOptions } from '../../config/app.config';
import { verifySession } from '../../api/middlewares/auth';

let io: SocketServer | null = null;

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO is not initialized');
    }
    return io;
};

export const setupSocketServer = (httpServer: HttpServer) => {
    io = new SocketServer(httpServer, {
        cors: {
            origin: corsOptions.origin,
            methods: corsOptions.methods,
            credentials: corsOptions.credentials,
            allowedHeaders: corsOptions.allowedHeaders
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true,
        pingTimeout: 60000,
        pingInterval: 25000,
        connectTimeout: 45000
    });

    io.on('connection', async (socket) => {
        // Store active connections for this socket
        const activeConnections = new Set();

        socket.on('joinChat', async ({ chatId, userId, sessionToken }) => {
            try {
                // Validate required parameters
                if (!chatId || !userId || !sessionToken) {
                    socket.emit('error', { message: 'Missing required parameters' });
                    return;
                }

                // Verify session
                const user = await verifySession(sessionToken);
                if (!user) {
                    socket.emit('error', { message: 'Authentication failed' });
                    return;
                }

                // Verify userId matches authenticated user
                if (user.id !== userId) {
                    socket.emit('error', { message: 'Authentication failed' });
                    return;
                }

                // Check if socket is already in the room
                if (!io) {
                    throw new Error('Socket.IO is not initialized');
                }

                // Leave previous rooms if any
                if (socket.data.chatId && socket.data.chatId !== chatId) {
                    await socket.leave(socket.data.chatId);
                }

                // Check if user is already in the room with another socket
                const roomSockets = await io.in(chatId).fetchSockets();
                for (const existingSocket of roomSockets) {
                    if (existingSocket.data.user?.id === userId && existingSocket.id !== socket.id) {
                        existingSocket.disconnect(true);
                    }
                }

                // Join the chat room
                await socket.join(chatId);
                activeConnections.add(chatId);
                
                // Set socket data
                socket.data.chatId = chatId;
                socket.data.user = user;
                socket.data.authenticated = true;
                
                // Set up message handlers
                await socketHandlers(socket);

                // Emit success event
                socket.emit('joinedChat', { chatId });

            } catch (error) {
                socket.emit('error', { message: 'Failed to join chat' });
            }
        });

        // Handle stream abort
        socket.on('streamAbort', async ({ chatId }) => {
            if (!socket.data.authenticated || socket.data.chatId !== chatId) {
                socket.emit('error', { message: 'Unauthorized' });
                return;
            }

            // Get all sockets in the room and trigger their abort handlers
            const roomSockets = await io?.in(chatId).fetchSockets();
            if (roomSockets) {
                for (const roomSocket of roomSockets) {
                    if (roomSocket.data.abortHandler) {
                        roomSocket.data.abortHandler();
                    }
                }
            }

            io?.to(chatId).emit('streamAborted', { chatId });
        });

        // Handle disconnection
        socket.on('disconnect', async () => {
            try {
                const { chatId, user } = socket.data;
                if (chatId && user) {
                    // Remove from active connections
                    activeConnections.delete(chatId);

                    // Leave the room
                    await socket.leave(chatId);

                    // Clean up room if it's the last client
                    const roomSockets = await io?.in(chatId).fetchSockets();
                    if (!roomSockets || roomSockets.length === 0) {}
                }
            } catch (error) {}
        });
    });

    return io;
};