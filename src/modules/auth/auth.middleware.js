import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    if (typeof payload === "string" || typeof payload.sub !== "string") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = { id: payload.sub };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}