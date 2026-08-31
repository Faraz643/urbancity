import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('API error:', err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.flatten(),
    });
  }

  const known = err as { status?: number; statusCode?: number; message?: string; stack?: string };
  const status = known.status || known.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';

  return res.status(status).json({
    error: status >= 500 && !isDev ? 'Internal server error' : (known.message || 'Internal server error'),
    ...(isDev && { stack: known.stack }),
  });
};
