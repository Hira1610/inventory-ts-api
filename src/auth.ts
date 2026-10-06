import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const SECRET = () => process.env.JWT_SECRET || "dev-only-change-me";

export interface AuthUser { id: number; email: string; role: string }
export interface AuthedRequest extends Request { user?: AuthUser }

export function signToken(user: AuthUser): string {
  return jwt.sign(user, SECRET(), { expiresIn: "1h" });
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    req.user = jwt.verify(token, SECRET()) as AuthUser;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or missing token" });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}
