import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { createBookingController,listUserBookingsController, cancelBookingController, createBookingHoldController,confirmBookingHoldController } from "./bookings.controller.js";

const router = Router();

router.post("/", requireAuth, createBookingController);
router.get("/", requireAuth, listUserBookingsController);
router.post("/holds", requireAuth, createBookingHoldController);
router.post("/:id/confirm", requireAuth, confirmBookingHoldController);
router.delete("/:id", requireAuth, cancelBookingController);
export default router;