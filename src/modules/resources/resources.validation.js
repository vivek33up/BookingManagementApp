import { z } from "zod";

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const createResourceSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).nullable().optional(),
    slotMinutes: z.number().int().positive(),
    openTime: z.string().regex(timePattern),
    closeTime: z.string().regex(timePattern),
  })
  .refine((data) => data.openTime < data.closeTime, {
    error: "Closing time must be after opening time",
    path: ["closeTime"],
  });

  export const resourceIdSchema = z.uuid();

  export const availabilityQuerySchema = z.object({
  date: z.iso.date(),
});