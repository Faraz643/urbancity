import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'development-only-change-me') as any;
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
