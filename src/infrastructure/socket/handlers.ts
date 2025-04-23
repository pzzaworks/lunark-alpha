import { Socket } from 'socket.io';
import { getIO } from './server';
import { getState, cleanup, emitStatus } from '@/core/stream/stream';
import { log } from '@/common/utils/log';

export const socketHandlers = async (socket: Socket) => {
    const { chatId, userId } = socket.handshake.auth;

    // Track active streams
    let lastActivity = Date.now();

    // Function to update activity
    const updateActivity = () => {
        lastActivity = Date.now();
        const state = getState(chatId);
        if (state) {
            state.lastActive = new Date();
        }
    };

    // Handle stream start
    socket.on('streamStart', () => {
        updateActivity();
    });

    // Handle stream end
    socket.on('streamEnd', () => {
        updateActivity();
    });

    // Handle message events
    socket.on('streamResponse', () => {
        updateActivity();
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
        try {
            const io = getIO();
            const room = io.sockets.adapter.rooms.get(chatId);
            
            if (!room || room.size === 0) {
                cleanup(chatId);
            }
        } catch (error) {}
    });

    // Handle errors
    socket.on('error', (error) => {});
};

export const updateStatus = async (chatId: string, status: string) => {
    emitStatus(chatId, status);
}; 