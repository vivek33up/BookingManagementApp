import { createBookingSchema } from "./bookings.validation.js";
import {
  createBooking,
  listUserBookings,
  cancelBooking,
} from "./bookings.service.js";

export async function createBookingController(req, res, next) {
  const validation = createBookingSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      error: "Invalid booking data",
      details: validation.error.flatten().fieldErrors,
    });
  }

  try {
    const bookingResult = await createBooking({
      ...validation.data,
      userId: req.user.id,
    });

    if (bookingResult.error === "RESOURCE_NOT_FOUND") {
      return res.status(404).json({ error: "Resource not found" });
    }

    if (bookingResult.error === "SLOT_UNAVAILABLE") {
      return res.status(409).json({ error: "Slot is unavailable" });
    }

    if (bookingResult.error === "RESOURCE_CHANGED") {
      return res.status(409).json({
        error:
          "Resource changed while booking. Please check availability and try again.",
      });
    }

    return res.status(201).json({ booking: bookingResult.booking });
  } catch (error) {
    const postgresCode = error?.cause?.code ?? error?.code;

    // PostgreSQL uses 23P01 for an exclusion constraint violation.
    if (postgresCode === "23P01") {
      return res.status(409).json({
        error: "This time slot is already booked",
      });
    }

    return next(error);
  }
}

export async function listUserBookingsController(req, res, next) {
  try {
    const bookings = await listUserBookings(req.user.id);
    return res.status(200).json({ bookings });
  } catch (error) {
    return next(error);
  }
}

export async function cancelBookingController(req, res, next) {
  const id = req.params.id;

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return res.status(400).json({ error: "Invalid booking ID" });
  }

  try {
    const booking = await cancelBooking({
      bookingId: id,
      userId: req.user.id,
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found or cannot be cancelled",
      });
    }

    return res.status(200).json({ booking });
  } catch (error) {
    return next(error);
  }
}
