import { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError.js';
import { logger } from '../logger.js';

export const errorMiddleware = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn(
      {
        errorCode: err.errorCode,
        message: err.message,
        statusCode: err.statusCode,
        details: err.details,
        path: req.path,
      },
      'Operational Error Handled'
    );

    return res.status(err.statusCode).json({
      status: 'error',
      errorCode: err.errorCode,
      message: err.message,
      details: err.details,
    });
  }

  // Unhandled or non-operational errors
  logger.error(
    {
      err: {
        message: err.message,
        stack: err.stack,
        name: err.name,
      },
      path: req.path,
      method: req.method,
    },
    'Unhandled Exception'
  );

  res.status(500).json({
    status: 'error',
    errorCode: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred. Our team has been notified.',
  });
};
