/**
 * schemas/driver-esg-report.schema.ts
 *
 * Zod validation schemas for FEAT-008 API inputs.
 * TypeScript interfaces for the internal EsgDataPackage structure.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Report generation inputs
// ---------------------------------------------------------------------------

export const GenerateDriverEsgReportSchema = z.object({
  driver_id:    z.string().uuid(),
  period_type:  z.enum(["weekly", "monthly", "quarterly", "custom"]),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD required"),
  period_end:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD required"),
  language:     z.enum(["fr", "en"]).default("fr"),
}).refine((d) => d.period_start <= d.period_end, {
  message: "period_start must be before or equal to period_end",
  path: ["period_start"],
});

export const GenerateFleetEsgReportSchema = z.object({
  period_type:  z.enum(["weekly", "monthly", "quarterly", "custom"]),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  language:     z.enum(["fr", "en"]).default("fr"),
  driver_ids:   z.array(z.string().uuid()).optional(),
}).refine((d) => d.period_start <= d.period_end, {
  message: "period_start must be before or equal to period_end",
  path: ["period_start"],
});

export type GenerateDriverEsgReportInput = z.infer<typeof GenerateDriverEsgReportSchema>;
export type GenerateFleetEsgReportInput  = z.infer<typeof GenerateFleetEsgReportSchema>;

// ---------------------------------------------------------------------------
// Shift schemas
// ---------------------------------------------------------------------------

export const CreateShiftSchema = z.object({
  trip_id:       z.string().uuid().optional(),
  shift_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD required"),
  started_at:    z.string().datetime({ offset: true }),
  break_minutes: z.number().int().min(0).default(0),
  driver_notes:  z.string().max(1000).optional(),
});

export const CompleteShiftSchema = z.object({
  ended_at:         z.string().datetime({ offset: true }).optional(),
  overtime_minutes: z.number().int().min(0).default(0),
  night_shift:      z.boolean().default(false),
  break_minutes:    z.number().int().min(0).optional(),
  driver_notes:     z.string().max(1000).optional(),
});

export type CreateShiftInput   = z.infer<typeof CreateShiftSchema>;
export type CompleteShiftInput = z.infer<typeof CompleteShiftSchema>;

// ---------------------------------------------------------------------------
// Maintenance schema
// ---------------------------------------------------------------------------

export const CreateMaintenanceSchema = z.object({
  vehicle_plate:        z.string().min(1).max(20),
  maintenance_type:     z.enum([
    "oil_change", "tire_replacement", "brake_service", "technical_inspection",
    "filter_replacement", "battery", "bodywork", "fuel_fill", "other",
  ]),
  performed_at:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  odometer_km:          z.number().min(0).optional(),
  cost_eur:             z.number().min(0).optional(),
  fuel_liters:          z.number().min(0).optional(),
  fuel_type:            z.enum(["diesel", "petrol", "lpg", "electric", "hydrogen", "cng", "other"]).optional(),
  provider_name:        z.string().max(200).optional(),
  next_due_at:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  next_due_km:          z.number().min(0).optional(),
  regulatory_compliant: z.boolean().default(true),
  notes:                z.string().max(2000).optional(),
});

export const UpdateMaintenanceSchema = CreateMaintenanceSchema.partial();

export type CreateMaintenanceInput = z.infer<typeof CreateMaintenanceSchema>;
export type UpdateMaintenanceInput = z.infer<typeof UpdateMaintenanceSchema>;

// ---------------------------------------------------------------------------
// Training schema
// ---------------------------------------------------------------------------

export const CreateTrainingSchema = z.object({
  training_type:        z.enum([
    "license_renewal", "adr_certification", "eco_driving", "defensive_driving",
    "first_aid", "cargo_handling", "digital_tools", "other",
  ]),
  title:                z.string().min(1).max(200),
  provider:             z.string().max(200).optional(),
  completed_at:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration_hours:       z.number().min(0.5),
  cost_eur:             z.number().min(0).optional(),
  certification_number: z.string().max(100).optional(),
  expiry_date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  passed:               z.boolean().default(true),
  notes:                z.string().max(2000).optional(),
});

export const UpdateTrainingSchema = CreateTrainingSchema.partial();

export type CreateTrainingInput = z.infer<typeof CreateTrainingSchema>;
export type UpdateTrainingInput = z.infer<typeof UpdateTrainingSchema>;

// ---------------------------------------------------------------------------
// Driver profile schema
// ---------------------------------------------------------------------------

export const UpdateDriverProfileSchema = z.object({
  gender:                    z.enum(["male", "female", "non_binary", "prefer_not_to_say"]).optional(),
  birth_year:                z.number().int().min(1940).max(new Date().getFullYear() - 18).optional(),
  nationality:               z.string().max(100).optional(),
  contract_type:             z.enum(["cdi", "cdd", "interim", "apprenticeship", "other"]).optional(),
  contract_start_date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  contract_end_date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  weekly_hours_contractual:  z.number().min(0).max(168).optional(),
  driving_license_categories:z.array(z.string().max(5)).optional(),
  license_obtained_year:     z.number().int().min(1970).max(new Date().getFullYear()).optional(),
});

export type UpdateDriverProfileInput = z.infer<typeof UpdateDriverProfileSchema>;

// ---------------------------------------------------------------------------
// ESG report schedule schema
// ---------------------------------------------------------------------------

export const CreateEsgReportScheduleSchema = z.object({
  period_type: z.enum(["monthly", "quarterly"]),
  hr_email:    z.string().email(),
  language:    z.enum(["fr", "en"]).default("fr"),
  active:      z.boolean().optional(),
});

export const UpdateEsgReportScheduleSchema = z.object({
  active:      z.boolean().optional(),
  hr_email:    z.string().email().optional(),
  language:    z.enum(["fr", "en"]).optional(),
  period_type: z.enum(["monthly", "quarterly"]).optional(),
});

export type CreateEsgReportScheduleInput = z.infer<typeof CreateEsgReportScheduleSchema>;
export type UpdateEsgReportScheduleInput = z.infer<typeof UpdateEsgReportScheduleSchema>;

// ---------------------------------------------------------------------------
// EsgDataPackage — internal aggregate structure (TypeScript only, not Zod)
// ---------------------------------------------------------------------------

export interface TripSummary {
  id:              string;
  vehiclePlate:    string | null;
  originLabel:     string | null;
  destinationLabel:string | null;
  distanceKm:      number | null;
  durationMinutes: number | null;
  fuelLiters:      number | null;
  fuelType:        string | null;
  cargoWeightKg:   number | null;
  isEmptyRun:      boolean;
  loadFactorPct:   number | null;
  ghgKgco2eq:      number;
  startedAt:       string | null;
  completedAt:     string | null;
}

export interface ShiftSummary {
  id:              string;
  shiftDate:       string;
  startedAt:       string;
  endedAt:         string | null;
  breakMinutes:    number;
  drivingMinutes:  number | null;
  overtimeMinutes: number;
  nightShift:      boolean;
  status:          string;
}

export interface IncidentSummary {
  id:          string;
  alertType:   string;
  value:       number;
  threshold:   number;
  status:      string;
  triggeredAt: string;
}

export interface MaintenanceSummary {
  id:                  string;
  vehiclePlate:        string;
  maintenanceType:     string;
  performedAt:         string;
  odometerKm:          number | null;
  costEur:             number | null;
  fuelLiters:          number | null;
  providerName:        string | null;
  nextDueAt:           string | null;
  regulatoryCompliant: boolean;
}

export interface TrainingSummary {
  id:                  string;
  trainingType:        string;
  title:               string;
  provider:            string | null;
  completedAt:         string;
  durationHours:       number;
  certificationNumber: string | null;
  expiryDate:          string | null;
  passed:              boolean;
  isExpired:           boolean;
  isExpiringSoon:      boolean;
}

export interface EsgDataPackage {
  // --- Identity ---
  driverId:                string;
  driverName:              string;
  driverEmployeeId:        string;
  gender:                  string | null;
  ageGroup:                string | null;
  contractType:            string | null;
  vehiclePlate:            string | null;
  fuelType:                string | null;
  drivingLicenseCategories:string[];
  periodStart:             string;
  periodEnd:               string;
  periodType:              string;
  generatedAt:             string;
  language:                string;

  // --- Transport activity ---
  totalTrips:        number;
  emptyRunCount:     number;
  emptyRunPct:       number;
  totalDistanceKm:   number;
  emptyDistanceKm:   number;
  loadedDistanceKm:  number;
  avgLoadFactorPct:  number | null;
  trips:             TripSummary[];

  // --- Working time (ESRS S1-7) ---
  totalShiftHours:      number;
  totalDrivingHours:    number;
  totalBreakHours:      number;
  totalOvertimeHours:   number;
  nightShiftCount:      number;
  avgDailyHours:        number | null;
  restCompliancePct:    number | null;
  shifts:               ShiftSummary[];

  // --- GHG emissions (ESRS E1-6) ---
  totalFuelLiters:           number;
  ghgFuelBreakdown:          Record<string, { liters: number; kgco2eq: number }>;
  ghgScope1Kgco2eq:          number;
  ghgScope1LoadedKgco2eq:    number;
  ghgScope1EmptyKgco2eq:     number;
  ghgIntensityPerKm:         number | null;
  ghgIntensityPerTonneKm:    number | null;

  // --- Health & safety (ESRS S1-14) ---
  incidentCount:          number;
  workStoppageCount:      number;
  highSeverityCount:      number;
  accidentFrequencyRate:  number | null;
  incidents:              IncidentSummary[];

  // --- Cargo conditions ---
  sensorReadingCount:    number;
  avgCargoTempC:         number | null;
  minCargoTempC:         number | null;
  maxCargoTempC:         number | null;
  avgCargoHumidityPct:   number | null;
  cargoBreachCount:      number;
  cargoBreachRatePct:    number | null;

  // --- Vehicle maintenance (ESRS E5, G1) ---
  maintenanceCount:           number;
  fuelFillCount:              number;
  inspectionCount:            number;
  regulatoryComplianceRatePct:number | null;
  totalMaintenanceCostEur:    number | null;
  maintenanceRecords:         MaintenanceSummary[];

  // --- Training & certifications (ESRS S1-13) ---
  trainingHoursTotal:        number;
  trainingCount:             number;
  certificationsActive:      number;
  certificationsExpiring90d: number;
  certificationsExpired:     number;
  trainingRecords:           TrainingSummary[];
  licenseCategories:         string[];

  // --- Diversity (ESRS S1-12) ---
  diversityGender:       string | null;
  diversityAgeGroup:     string | null;
  diversityContractType: string | null;

  // --- Fleet benchmark ---
  fleetAvgGhgIntensityPerKm:   number | null;
  fleetAvgIncidentRate:        number | null;
  fleetAvgTrainingHours:       number | null;
  fleetAvgCargoCompliancePct:  number | null;
  fleetAvgVehicleCompliancePct:number | null;
  driverVsFleetGhgPct:         number | null;
  driverVsFleetIncidentPct:    number | null;
}
