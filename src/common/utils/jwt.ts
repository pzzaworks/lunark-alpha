import jwt from 'jsonwebtoken';
import prisma from '@/infrastructure/database/prisma';

const JWT_SECRET = process.env.JWT_SECRET!;

export interface JWTPayload {
  id: string;
  [key: string]: any;
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

export async function verifySessionToken(token: string) {
  const decodedToken = verifyToken(token);
  if (!decodedToken) return null;

  const user = await prisma.user.findFirst({
    where: { 
      sessionToken: token,
      sessionTokenExpiresAt: { gt: new Date() }
    }
  });

  return user;
}