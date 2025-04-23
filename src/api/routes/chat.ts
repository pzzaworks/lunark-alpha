import { Router, Request, Response } from 'express';
import prisma from '../../infrastructure/database/prisma';
import { AsyncRequestHandler } from '../../types/express';
import { messageService } from '../../core/assistant/message';
import { decrypt } from '@/common/utils/encrypt';

const router = Router();

const createChat: AsyncRequestHandler = async (req, res) => {
  try {
    const chat = await prisma.chat.create({
      data: {
        title: req.body.message,
        tools: req.body.tools || '',
        user: {
          connect: {
            id: req.user?.id
          }
        }
      },
      include: {
        messages: {
          include: {
            usage: true
          }
        },
        tasks: true,
        memories: true
      }
    });

    if (req.body.message) {
      await messageService.createMessage(
        chat.id,
        req.user?.id!,
        'user',
        decrypt(req.body.message),
        req.body.chainId || 1
      );
    }

    res.json(chat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
};

const getChat: AsyncRequestHandler = async (req, res) => {
  try {
    const chat = await prisma.chat.findUnique({
      where: {
        id: req.params.id,
        userId: req.user?.id
      },
      include: {
        messages: {
          include: {
            usage: true
          }
        },
        tasks: true,
        memories: true
      }
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
};

router.post('/create', createChat);
router.get('/get/:id', getChat);

export default router; 