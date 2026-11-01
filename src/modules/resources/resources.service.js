import { db } from "../../db/index.js";
import { resources,bookings } from "../../db/schema.js";
import { eq, sql } from "drizzle-orm";

export async function createResource(resourceData) {
  const [createdResource] = await db
    .insert(resources)
    .values({
      name: resourceData.name,
      description: resourceData.description,
      slotMinutes: resourceData.slotMinutes,
      openTime: resourceData.openTime,
      closeTime: resourceData.closeTime,
    })
    .returning({
      id: resources.id,
      name: resources.name,
      description: resources.description,
      slotMinutes: resources.slotMinutes,
      openTime: resources.openTime,
      closeTime: resources.closeTime,
      version: resources.version,
      createdAt: resources.createdAt,
    });

  return createdResource;
}

export async function listResources() {
  return db
    .select({
      id: resources.id,
      name: resources.name,
      description: resources.description,
      slotMinutes: resources.slotMinutes,
      openTime: resources.openTime,
      closeTime: resources.closeTime,
      version: resources.version,
      createdAt: resources.createdAt,
    })
    .from(resources);
}

export async function getResourceById(id) {
  const [resource] = await db
    .select({
      id: resources.id,
      name: resources.name,
      description: resources.description,
      slotMinutes: resources.slotMinutes,
      openTime: resources.openTime,
      closeTime: resources.closeTime,
      version: resources.version,
      createdAt: resources.createdAt,
    })
    .from(resources)
    .where(eq(resources.id, id))
    .limit(1);

  return resource ?? null;
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function generateSlots(openTime, closeTime, slotMinutes) {
  const openMinutes = timeToMinutes(openTime);
  const closeMinutes = timeToMinutes(closeTime);
  const slots = [];

  for (
    let start = openMinutes;
    start + slotMinutes <= closeMinutes;
    start += slotMinutes
  ) {
    slots.push({
      startTime: minutesToTime(start),
      endTime: minutesToTime(start + slotMinutes),
    });
  }

  return slots;
}

export async function getResourceAvailability(resourceId, date) {
  const resource = await getResourceById(resourceId);

  if (!resource) {
    return null;
  }

  // All resource times use the shared Asia/Kolkata timezone (UTC+05:30).
  const dayStart = new Date(`${date}T00:00:00+05:30`);
  const dayEnd = new Date(`${date}T23:59:59.999+05:30`);

  const result = await db.execute(sql`
    SELECT
      lower(during) AS start_at,
      upper(during) AS end_at
    FROM bookings
    WHERE resource_id = ${resourceId}
      AND status IN ('held', 'confirmed')
      AND during && tstzrange(
        ${dayStart.toISOString()}::timestamptz,
        ${dayEnd.toISOString()}::timestamptz,
        '[)'
      )
  `);

  const busyBookings = result.rows;

  const slots = generateSlots(
    resource.openTime,
    resource.closeTime,
    resource.slotMinutes,
  );

  const availableSlots = slots.filter((slot) => {
    const slotStart = new Date(`${date}T${slot.startTime}:00+05:30`);
    const slotEnd = new Date(`${date}T${slot.endTime}:00+05:30`);

    return !busyBookings.some((booking) => {
      const bookingStart = new Date(booking.start_at);
      const bookingEnd = new Date(booking.end_at);

      // Two time ranges overlap when each starts before the other ends.
      return slotStart < bookingEnd && slotEnd > bookingStart;
    });
  });

  return {
    resourceId,
    date,
    timeZone: "Asia/Kolkata",
    slots: availableSlots,
  };
}