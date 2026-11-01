import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

export async function registerUser({ email, password }) {
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    return null;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [createdUser] = await db
    .insert(users)
    .values({ email, passwordHash })
    .returning({
      id: users.id,
      email: users.email,
    });

  return createdUser;
}

export async function loginUser({ email, password }) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return null;
  }

  const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "1h",
  });

  return {
    user: { id: user.id, email: user.email },
    token,
  };
}
