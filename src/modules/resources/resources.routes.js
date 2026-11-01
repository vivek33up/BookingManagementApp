import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { createResourceController, listResourcesController, getResourceAvailabilityController,getResourceController } from "./resources.controller.js";

const router = Router();

router.post("/", requireAuth, createResourceController);
router.get("/", requireAuth, listResourcesController);
router.get("/:id/availability", requireAuth, getResourceAvailabilityController);
router.get("/:id", requireAuth, getResourceController);
export default router;