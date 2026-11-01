import { z } from "zod";

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const createBookingSchema = z.object({
  resourceId: z.uuid(),
  date: z.iso.date(),
  startTime: z.string().regex(timePattern),
});