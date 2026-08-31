import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('Error:', err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Don't expose internal errors in production
  const isDev = process.env.NODE_ENV === 'development';

  res.status(status).json({
    error: message,
    ...(isDev && { stack: err.stack }),
  });
};
