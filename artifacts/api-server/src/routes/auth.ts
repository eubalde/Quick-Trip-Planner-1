import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, sessionsTable } from "@workspace/db/schema";
import { eq, lt } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";

const router = Router();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256")
    .update(password + salt)
    .digest("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const attempt = createHash("sha256")
    .update(password + salt)
    .digest("hex");
  return attempt === hash;
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h
  // Opportunistically purge expired sessions to keep the table lean
  await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()));
  await db.insert(sessionsTable).values({ token, userId, expiresAt });
  return token;
}

export async function validateToken(token: string): Promise<string | null> {
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.token, token))
    .limit(1);
  if (!session) return null;
  if (Date.now() > session.expiresAt.getTime()) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
    return null;
  }
  return session.userId;
}

router.post("/auth/register", async (req, res) => {
  const { email, password, name } = req.body as {
    email: string;
    password: string;
    name: string;
  };

  if (!email || !password || !name) {
    res.status(400).json({ error: "Email, password, and name are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  const passwordHash = hashPassword(password);

  const [user] = await db
    .insert(usersTable)
    .values({
      id,
      email: email.toLowerCase(),
      passwordHash,
      name,
    })
    .returning();

  if (!user) {
    res.status(500).json({ error: "Failed to create user" });
    return;
  }

  const token = await createSession(user.id);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  });
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as {
    email: string;
    password: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(400).json({ error: "Invalid email or password" });
    return;
  }

  const token = await createSession(user.id);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  });
});

router.post("/auth/logout", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
  res.json({ message: "Logged out successfully" });
});

router.get("/auth/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7);
  const userId = await validateToken(token);
  if (!userId) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
