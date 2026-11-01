import { createResourceSchema, resourceIdSchema,availabilityQuerySchema } from "./resources.validation.js";
import { createResource, listResources, getResourceById,getResourceAvailability } from "./resources.service.js";

export async function createResourceController(req, res, next) {
  const result = createResourceSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Invalid resource data",
      details: result.error.flatten().fieldErrors,
    });
  }

  try {
    const resource = await createResource(result.data);
    return res.status(201).json({ resource });
  } catch (error) {
    return next(error);
  }
}

export async function listResourcesController(req, res, next) {
  try {
    const resources = await listResources();
    return res.status(200).json({ resources });
  } catch (error) {
    return next(error);
  }
}

export async function getResourceController(req, res, next) {
  const result = resourceIdSchema.safeParse(req.params.id);

  if (!result.success) {
    return res.status(400).json({ error: "Invalid resource ID" });
  }

  try {
    const resource = await getResourceById(result.data);

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    return res.status(200).json({ resource });
  } catch (error) {
    return next(error);
  }
}

export async function getResourceAvailabilityController(req, res, next) {
  const idResult = resourceIdSchema.safeParse(req.params.id);
  const queryResult = availabilityQuerySchema.safeParse(req.query);

  if (!idResult.success || !queryResult.success) {
    return res.status(400).json({
      error: "Provide a valid resource ID and date in YYYY-MM-DD format",
    });
  }

  try {
    const availability = await getResourceAvailability(
      idResult.data,
      queryResult.data.date,
    );

    if (!availability) {
      return res.status(404).json({ error: "Resource not found" });
    }

    return res.status(200).json({ availability });
  } catch (error) {
    return next(error);
  }
}