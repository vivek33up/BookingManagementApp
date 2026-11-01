import { z } from "zod";
import "dotenv/config";
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(1),
  BOOKING_STRATEGY: z
    .enum(["constraint", "pessimistic", "optimistic"])
    .default("constraint"),
  HOLD_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  PORT: z.coerce.number().int().positive().default(3000),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error(
    "Invalid environment configuration: ",
    result.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const env = result.data;
