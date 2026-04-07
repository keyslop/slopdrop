import type { Request, Response, NextFunction } from 'express';

const TOKEN = process.env.SLOPDROP_TOKEN;

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!TOKEN) {
    // No token configured — reject everything
    res.status(500).json({ error: 'Server token not configured' });
    return;
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const provided = auth.slice(7);
  if (provided !== TOKEN) {
    res.status(403).json({ error: 'Invalid token' });
    return;
  }

  next();
}
