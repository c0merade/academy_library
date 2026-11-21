import type { Request, Response, NextFunction } from 'express';
import { db, parseUser } from './db.ts';
import type { User, UserRole } from '../src/types.ts';

declare global {
  namespace Express {
    interface Request {
      currentUser?: User;
    }
  }
}

export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const headerId = req.header('x-user-id');
  const userId = headerId ? Number(headerId) : 1;

  const row = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(Number.isFinite(userId) ? userId : 1) as Record<string, unknown> | undefined;

  if (row) {
    req.currentUser = parseUser(row);
  }
  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.currentUser;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        error: `Permission denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${user.role}.`,
      });
      return;
    }
    next();
  };
}

export function canModifyOwnedItem(user: User, ownerId: number): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'lecturer' && user.id === ownerId) return true;
  return false;
}
