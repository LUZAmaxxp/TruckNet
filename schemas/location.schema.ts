import { z } from "zod";

/**
 * LocationUpdateSchema — validates driver location update payloads.
 * Used in POST /api/drivers/location and the update_location socket event.
 */
export const LocationUpdateSchema = z.object({
  latitude: z
    .number({ required_error: "latitude is required" })
    .min(-90, { message: "latitude must be between -90 and 90" })
    .max(90, { message: "latitude must be between -90 and 90" }),
  longitude: z
    .number({ required_error: "longitude is required" })
    .min(-180, { message: "longitude must be between -180 and 180" })
    .max(180, { message: "longitude must be between -180 and 180" }),
});

export type LocationUpdateInput = z.infer<typeof LocationUpdateSchema>;
