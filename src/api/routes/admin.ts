import { Router } from 'express';
import prisma from '../../infrastructure/database/prisma';
import { User } from '../../infrastructure/database/prisma-client';
import { log } from '../../common/utils/log';
import type { AsyncRequestHandler } from '../../types/express';

const router = Router();

const getUsersHandler: AsyncRequestHandler = async (req, res) => {
  try {
    const user: User | undefined = req.user;

    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const users = await prisma.user.findMany({
      include: {
        chats: {
          include: {
            messages: true
          }
        }
      }
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

const getStatsHandler: AsyncRequestHandler = async (_req, res) => {
  try {
    const [userCount, chatCount, messageCount] = await Promise.all([
      prisma.user.count(),
      prisma.chat.count(),
      prisma.message.count()
    ]);

    res.json({
      users: userCount,
      chats: chatCount,
      messages: messageCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats' });
  }
};

router.get('/users', getUsersHandler);
router.get('/stats', getStatsHandler);

export default router; 