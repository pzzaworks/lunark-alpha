import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../../common/utils/jwt';
import prisma from '../../infrastructure/database/prisma';
import { log } from '../../common/utils/log';
import { AsyncRequestHandler } from '../../types/express';

// Verify session token and return user if valid
export const verifySession = async (token: string) => {
  try {
    const decoded = await verifyToken(token);
    if (!decoded || !decoded.userId) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    return user;
  } catch (error) {
    return null;
  }
};

const auth: AsyncRequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }

    const user = await verifySession(token);
    if (!user) {
      res.status(401).json({ message: 'Invalid token' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed' });
  }
};

export default auth; 