import { z } from "zod";
import bcrypt from "bcryptjs";

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .transform((email) => email.toLowerCase()),
  password: z
    .string()
    .min(8, "Password must be atleast 8 characters")
    .refine(
      (password) => !bcrypt.truncates(password),
      "Password is too long for bcrypt",
    ),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .transform((email) => email.toLowerCase()),

  password: z
    .string()
    .min(1, "Password is required")
    .refine(
      (password) => !bcrypt.truncates(password),
      "Password is too long for bcrypt",
    ),
});
