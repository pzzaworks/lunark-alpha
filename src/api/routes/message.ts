import { Router, Request, Response } from 'express';
import prisma from '../../infrastructure/database/prisma';
import { log } from '../../common/utils/log';
import { messageService } from '../../core/assistant/message';

const router = Router();

const getMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { chatId } = req.params;
    
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userId: req.user!.id
      }
    });

    if (!chat) {
      res.status(404).json({ message: 'Chat not found' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { chatId },
      include: {
        transaction: true,
        memories: true
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching messages' });
  }
};

const createMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { content, chatId } = req.body;

    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userId: req.user!.id
      }
    });

    if (!chat) {
      res.status(404).json({ message: 'Chat not found' });
      return;
    }

    const message = await messageService.createMessage(
      chatId,
      req.user!.id,
      'user',
      content,
      req.body.chainId || 1
    );

    res.json(message);
  } catch (error) {
    res.status(500).json({ message: 'Error creating message' });
  }
};

router.get('/get/:chatId', getMessages);
router.post('/create', createMessage);

export default router; 