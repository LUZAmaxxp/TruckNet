import { z } from "zod";

/**
 * StressSignalSchema — validates emergency stress signal payloads.
 * Used in POST /api/stress-signals and the send_stress_signal socket event.
 */
export const StressSignalSchema = z.object({
  latitude: z
    .number({ required_error: "latitude is required" })
    .min(-90, { message: "latitude must be between -90 and 90" })
    .max(90, { message: "latitude must be between -90 and 90" }),
  longitude: z
    .number({ required_error: "longitude is required" })
    .min(-180, { message: "longitude must be between -180 and 180" })
    .max(180, { message: "longitude must be between -180 and 180" }),
});

export type StressSignalInput = z.infer<typeof StressSignalSchema>;
