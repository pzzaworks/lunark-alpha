import { Request, Response, NextFunction } from 'express';
import { log } from '../../common/utils/log';

interface ErrorWithStatus extends Error {
  status?: number;
}

export const errorHandler = (
  err: ErrorWithStatus,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.status || 500;
  const message = err.message || 'Internal Server Error';

  log('❌ Error:', {
    status: statusCode,
    message,
    stack: err.stack
  });

  const response = {
    error: true,
    message,
    stack: err.stack
  };

  (res as any).status(statusCode).json(response);
}; 