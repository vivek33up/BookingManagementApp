import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { bookings, resources } from "../../db/schema.js";
import { getResourceAvailability } from "../resources/resources.service.js";

export async function createBooking({ userId, resourceId, date, startTime }) {
  const [resource] = await db
    .select({
      id: resources.id,
      slotMinutes: resources.slotMinutes,
    })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1);

  if (!resource) {
    return { error: "RESOURCE_NOT_FOUND" };
  }

  const availability = await getResourceAvailability(resourceId, date);

  if (!availability) {
    return { error: "RESOURCE_NOT_FOUND" };
  }

  const selectedSlot = availability.slots.find(
    (slot) => slot.startTime === startTime,
  );

  if (!selectedSlot) {
    return { error: "SLOT_UNAVAILABLE" };
  }

  const startAt = new Date(`${date}T${selectedSlot.startTime}:00+05:30`);
  const endAt = new Date(`${date}T${selectedSlot.endTime}:00+05:30`);

  const [booking] = await db
    .insert(bookings)
    .values({
      resourceId,
      userId,
      during: sql`tstzrange(
        ${startAt.toISOString()}::timestamptz,
        ${endAt.toISOString()}::timestamptz,
        '[)'
      )`,
      status: "confirmed",
    })
    .returning({
      id: bookings.id,
      resourceId: bookings.resourceId,
      userId: bookings.userId,
      status: bookings.status,
      createdAt: bookings.createdAt,
    });

  return { booking };
}

export async function listUserBookings(userId) {
  return db
    .select({
      id: bookings.id,
      resourceId: bookings.resourceId,
      status: bookings.status,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .where(eq(bookings.userId, userId));
}

export async function cancelBooking({ bookingId, userId }) {
  const [booking] = await db
    .update(bookings)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.userId, userId),
        eq(bookings.status, "confirmed"),
      ),
    )
    .returning({
      id: bookings.id,
      resourceId: bookings.resourceId,
      status: bookings.status,
      updatedAt: bookings.updatedAt,
    });

  return booking ?? null;
}