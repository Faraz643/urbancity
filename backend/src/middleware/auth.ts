import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

interface AuthRequest extends Request {
  user?: any;
}

export function getJwtSecret(){
  const secret=process.env.JWT_SECRET;
  if(secret && secret.length>=32)return secret;
  if(process.env.NODE_ENV==='production')throw new Error('JWT_SECRET must be set to a strong value (at least 32 characters) in production.');
  return 'development-only-change-me';
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, getJwtSecret()) as any;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, username: true, role: true, displayName: true, isActive: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Use after authenticate on operations that change data or spend platform funds.
// Suspended users remain able to authenticate and use read-only account features.
export const requireActiveUser = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user?.isActive) {
    return res.status(403).json({ error: 'Your account is suspended. You can browse UrbanCity, but booking and editing are disabled.' });
  }
  next();
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export { AuthRequest };
