import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { createBookingController,listUserBookingsController, cancelBookingController } from "./bookings.controller.js";

const router = Router();

router.post("/", requireAuth, createBookingController);
router.get("/", requireAuth, listUserBookingsController);
router.delete("/:id", requireAuth, cancelBookingController);
export default router;