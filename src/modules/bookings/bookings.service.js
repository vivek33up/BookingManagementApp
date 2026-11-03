import { and, lte, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { bookings, resources } from "../../db/schema.js";
import { getResourceAvailability } from "../resources/resources.service.js";
import { env } from "../../config/env.js";
import { redisClient } from "../../db/redis.js";

async function createBookingWithConstraint({ userId, resourceId, date, startTime }) {
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

export async function createBooking(bookingData){
  if(env.BOOKING_STRATEGY==="pessimistic"){
    return createBookingWithPessimisticLock(bookingData);
  }
  if (env.BOOKING_STRATEGY === "optimistic") {
    return createBookingWithOptimisticLock(bookingData);
  }
  return createBookingWithConstraint(bookingData)
}

async function createBookingWithPessimisticLock({
  userId,
  resourceId,
  date,
  startTime,
}) {
  return db.transaction(async (tx) => {
    const [resource] = await tx
      .select({ id: resources.id })
      .from(resources)
      .where(eq(resources.id, resourceId))
      .for("update")
      .limit(1);

    if (!resource) {
      return { error: "RESOURCE_NOT_FOUND" };
    }

    const availability = await getResourceAvailability(
      resourceId,
      date,
      tx,
    );

    const selectedSlot = availability?.slots.find(
      (slot) => slot.startTime === startTime,
    );

    if (!selectedSlot) {
      return { error: "SLOT_UNAVAILABLE" };
    }

    const startAt = new Date(`${date}T${selectedSlot.startTime}:00+05:30`);
    const endAt = new Date(`${date}T${selectedSlot.endTime}:00+05:30`);

    const [booking] = await tx
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
  });
}

async function createBookingWithOptimisticLock({
  userId,
  resourceId,
  date,
  startTime,
}) {
  return db.transaction(async (tx) => {
    const [resource] = await tx
      .select({
        id: resources.id,
        version: resources.version,
      })
      .from(resources)
      .where(eq(resources.id, resourceId))
      .limit(1);

    if (!resource) {
      return { error: "RESOURCE_NOT_FOUND" };
    }

    const availability = await getResourceAvailability(
      resourceId,
      date,
      tx,
    );

    const selectedSlot = availability?.slots.find(
      (slot) => slot.startTime === startTime,
    );

    if (!selectedSlot) {
      return { error: "SLOT_UNAVAILABLE" };
    }

    // Claim this version. If another request already changed it, this
    // update affects no row and this request must stop.
    const [updatedResource] = await tx
      .update(resources)
      .set({
        version: sql`${resources.version} + 1`,
      })
      .where(
        and(
          eq(resources.id, resourceId),
          eq(resources.version, resource.version),
        ),
      )
      .returning({ id: resources.id });

    if (!updatedResource) {
      return { error: "RESOURCE_CHANGED" };
    }

    const startAt = new Date(`${date}T${selectedSlot.startTime}:00+05:30`);
    const endAt = new Date(`${date}T${selectedSlot.endTime}:00+05:30`);

    const [booking] = await tx
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
  });
}

//________________ADDING HOLD__________
export async function createBookingHold({
  userId,
  resourceId,
  date,
  startTime,
}) {
  return db.transaction(async (tx) => {
    // Serialize hold creation for this resource.
    const [resource] = await tx
      .select({ id: resources.id })
      .from(resources)
      .where(eq(resources.id, resourceId))
      .for("update")
      .limit(1);

    if (!resource) {
      return { error: "RESOURCE_NOT_FOUND" };
    }

    // Expire this resource's old holds so they no longer block its slots.
    const now = new Date();

    await tx
      .update(bookings)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(bookings.resourceId, resourceId),
          eq(bookings.status, "held"),
          lte(bookings.holdExpiresAt, now),
        ),
      );

    const availability = await getResourceAvailability(
      resourceId,
      date,
      tx,
    );

    const selectedSlot = availability?.slots.find(
      (slot) => slot.startTime === startTime,
    );

    if (!selectedSlot) {
      return { error: "SLOT_UNAVAILABLE" };
    }

    const startAt = new Date(`${date}T${selectedSlot.startTime}:00+05:30`);
    const endAt = new Date(`${date}T${selectedSlot.endTime}:00+05:30`);
    const holdExpiresAt = new Date(
      Date.now() + env.HOLD_TTL_SECONDS * 1000,
    );

    const [booking] = await tx
      .insert(bookings)
      .values({
        resourceId,
        userId,
        during: sql`tstzrange(
          ${startAt.toISOString()}::timestamptz,
          ${endAt.toISOString()}::timestamptz,
          '[)'
        )`,
        status: "held",
        holdExpiresAt,
      })
      .returning({
        id: bookings.id,
        resourceId: bookings.resourceId,
        userId: bookings.userId,
        status: bookings.status,
        holdExpiresAt: bookings.holdExpiresAt,
        createdAt: bookings.createdAt,
      });

    // Redis keeps a timer for this hold. The database expiry worker
    // we add next will update the booking row when the timer runs out.
    await redisClient.set(`booking-hold:${booking.id}`, booking.id, {
      EX: env.HOLD_TTL_SECONDS,
    });

    return { booking };
  });
}
export async function confirmBookingHold({ bookingId, userId }) {
  const result = await db.transaction(async (tx) => {
    // Lock this user's booking while checking and confirming it.
    const [hold] = await tx
      .select({
        id: bookings.id,
        status: bookings.status,
        holdExpiresAt: bookings.holdExpiresAt,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.userId, userId),
        ),
      )
      .for("update")
      .limit(1);

    if (!hold) {
      return { error: "HOLD_NOT_FOUND" };
    }

    if (hold.status !== "held") {
      return { error: "HOLD_NOT_ACTIVE" };
    }

    const now = new Date();

    if (!hold.holdExpiresAt || hold.holdExpiresAt <= now) {
      await tx
        .update(bookings)
        .set({ status: "expired", updatedAt: now })
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.status, "held"),
          ),
        );

      return { error: "HOLD_EXPIRED" };
    }

    const [booking] = await tx
      .update(bookings)
      .set({
        status: "confirmed",
        holdExpiresAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.userId, userId),
          eq(bookings.status, "held"),
        ),
      )
      .returning({
        id: bookings.id,
        resourceId: bookings.resourceId,
        userId: bookings.userId,
        status: bookings.status,
        createdAt: bookings.createdAt,
      });

    return { booking };
  });

  // The booking is now confirmed, so its Redis timer can be removed.
  if (result.booking) {
    try {
      await redisClient.del(`booking-hold:${bookingId}`);
    } catch (error) {
      console.error("Could not remove confirmed booking's Redis key:", error);
    }
  }

  return result;
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