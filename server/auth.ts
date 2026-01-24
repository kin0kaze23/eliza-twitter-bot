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

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.error("[Auth] FATAL: SESSION_SECRET environment variable is required");
  process.exit(1);
}

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
      const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD;
      if (!defaultPassword) {
        console.warn("[Auth] No ADMIN_DEFAULT_PASSWORD set. Skipping admin user creation.");
        console.warn("[Auth] Set ADMIN_DEFAULT_PASSWORD env var to create initial admin user.");
        return;
      }
      const hashedPassword = await hashPassword(defaultPassword);
      await storage.createUser({
        username: "admin",
        password: hashedPassword,
      });
      console.log("[Auth] Default admin user created (username: admin)");
      console.log("[Auth] IMPORTANT: Change the default password after first login!");
    } else {
      console.log("[Auth] Admin user already exists");
    }
  } catch (error) {
    console.error("[Auth] Error seeding admin user:", error);
  }
}
