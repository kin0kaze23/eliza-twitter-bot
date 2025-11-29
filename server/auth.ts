import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import session from "express-session";
import { storage } from "./storage";

declare module "express-session" {
  interface SessionData {
    userId: string;
    username: string;
  }
}

const SESSION_SECRET = process.env.SESSION_SECRET || "eliza-agent-dashboard-secret-key-change-in-production";

export const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
});

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: "Authentication required" });
}

export async function seedDefaultAdmin() {
  try {
    const existingUser = await storage.getUserByUsername("admin");
    if (!existingUser) {
      const hashedPassword = await hashPassword("graceimmutable");
      await storage.createUser({
        username: "admin",
        password: hashedPassword,
      });
      console.log("[Auth] Default admin user created (username: admin)");
    } else {
      console.log("[Auth] Admin user already exists");
    }
  } catch (error) {
    console.error("[Auth] Error seeding admin user:", error);
  }
}
