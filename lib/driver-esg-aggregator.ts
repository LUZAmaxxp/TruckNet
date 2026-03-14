/**
 * lib/driver-esg-aggregator.ts
 *
 * Builds a complete EsgDataPackage for one driver + period.
 * Single source of truth before PDF / CSV rendering.
 *
 * CSRD / ISO 26000 references are documented inline on each calculation.
 */

import { and, eq, gte, lte, ne, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  driverProfiles,
  transportTrips,
  driverShifts,
  vehicleMaintenanceLogs,
  driverTrainingRecords,
  iotDevices,
  sensorReadings,
  sensorAlerts,
  behaviourReports,
  drivingEvents,
} from "@/db/schema";
import type {
  EsgDataPackage,
  TripSummary,
  ShiftSummary,
  IncidentSummary,
  MaintenanceSummary,
  TrainingSummary,
} from "@/schemas/driver-esg-report.schema";

// ---------------------------------------------------------------------------
// GHG emission factors — ADEME Base Carbone 2024
// Configurable per fuel type (kg CO2eq per litre)
// ---------------------------------------------------------------------------

export const GHG_FACTORS_KG_CO2_PER_LITER: Record<string, number> = {
  diesel:   2.65,
  petrol:   2.37,
  lpg:      1.63,
  cng:      2.30,
  electric: 0.00,   // Scope 1 = 0; Scope 2 not tracked here
  hydrogen: 0.00,   // Scope 1 = 0 for green hydrogen
  other:    2.65,   // fallback to diesel
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGhgFactor(fuelType: string | null): number {
  if (!fuelType) return GHG_FACTORS_KG_CO2_PER_LITER.diesel;
  return GHG_FACTORS_KG_CO2_PER_LITER[fuelType] ?? GHG_FACTORS_KG_CO2_PER_LITER.diesel;
}

function deriveAgeGroup(birthYear: number | null): string | null {
  if (!birthYear) return null;
  const age = new Date().getFullYear() - birthYear;
  if (age <= 25) return "18-25";
  if (age <= 35) return "26-35";
  if (age <= 45) return "36-45";
  if (age <= 55) return "46-55";
  return "55+";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * EU Regulation 561/2006 — minimum 11h rest between two consecutive shifts.
 * Returns compliance percentage (null if < 2 shifts recorded).
 */
function computeRestCompliance(shifts: ShiftSummary[]): number | null {
  const completed = shifts
    .filter((s) => s.endedAt !== null)
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

  if (completed.length < 2) return null;

  let compliant = 0;
  const total = completed.length - 1;

  for (let i = 0; i < total; i++) {
    const gapMs =
      new Date(completed[i + 1].startedAt).getTime() -
      new Date(completed[i].endedAt!).getTime();
    if (gapMs >= 11 * 60 * 60 * 1000) compliant++;
  }

  return round2((compliant / total) * 100);
}

// ---------------------------------------------------------------------------
// Fleet benchmark — lightweight aggregation across all other drivers
// ---------------------------------------------------------------------------

async function buildFleetBenchmarks(
  excludeDriverId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{
  fleetAvgGhgIntensityPerKm:   number | null;
  fleetAvgIncidentRate:        number | null;
  fleetAvgTrainingHours:       number | null;
  fleetAvgCargoCompliancePct:  number | null;
  fleetAvgVehicleCompliancePct:number | null;
}> {
  const allDrivers = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "driver"), ne(users.id, excludeDriverId)));

  if (allDrivers.length === 0) {
    return {
      fleetAvgGhgIntensityPerKm:   null,
      fleetAvgIncidentRate:        null,
      fleetAvgTrainingHours:       null,
      fleetAvgCargoCompliancePct:  null,
      fleetAvgVehicleCompliancePct:null,
    };
  }

  const startTs = new Date(periodStart);
  const endTs   = new Date(periodEnd + "T23:59:59.999Z");

  const ghgIntensities: number[]       = [];
  const incidentRates: number[]        = [];
  const trainingHoursList: number[]    = [];
  const cargoComplianceList: number[]  = [];
  const vehicleComplianceList: number[]= [];

  for (const { id } of allDrivers) {
    // GHG intensity
    const trips = await db
      .select({ distanceKm: transportTrips.distanceKm, fuelLiters: transportTrips.fuelLiters, fuelType: transportTrips.fuelType })
      .from(transportTrips)
      .where(and(eq(transportTrips.driverId, id), isNotNull(transportTrips.startedAt), gte(transportTrips.startedAt, startTs), lte(transportTrips.startedAt, endTs)));

    const totalDist = trips.reduce((s, t) => s + (t.distanceKm ?? 0), 0);
    const totalGhg  = trips.reduce((s, t) => s + (t.fuelLiters ?? 0) * getGhgFactor(t.fuelType), 0);
    if (totalDist > 0) ghgIntensities.push(totalGhg / totalDist);

    // Training hours
    const training = await db
      .select({ durationHours: driverTrainingRecords.durationHours })
      .from(driverTrainingRecords)
      .where(and(eq(driverTrainingRecords.driverId, id), gte(driverTrainingRecords.completedAt, periodStart), lte(driverTrainingRecords.completedAt, periodEnd)));
    trainingHoursList.push(training.reduce((s, t) => s + t.durationHours, 0));

    // Incident rate (via sensor alerts linked to driver)
    const alerts = await db
      .select({ id: sensorAlerts.id })
      .from(sensorAlerts)
      .where(and(eq(sensorAlerts.driverId, id), gte(sensorAlerts.triggeredAt, startTs), lte(sensorAlerts.triggeredAt, endTs)));

    const shifts = await db
      .select({ startedAt: driverShifts.startedAt, endedAt: driverShifts.endedAt, breakMinutes: driverShifts.breakMinutes })
      .from(driverShifts)
      .where(and(eq(driverShifts.driverId, id), gte(driverShifts.shiftDate, periodStart), lte(driverShifts.shiftDate, periodEnd)));

    const shiftHours = shifts.reduce((s, sh) => {
      if (!sh.endedAt) return s;
      const totalMin = (new Date(sh.endedAt).getTime() - new Date(sh.startedAt).getTime()) / 60000;
      return s + (totalMin - sh.breakMinutes) / 60;
    }, 0);

    if (shiftHours > 0) incidentRates.push((alerts.length * 1_000_000) / shiftHours);

    // Vehicle compliance
    const maintenance = await db
      .select({ regulatoryCompliant: vehicleMaintenanceLogs.regulatoryCompliant, maintenanceType: vehicleMaintenanceLogs.maintenanceType })
      .from(vehicleMaintenanceLogs)
      .where(and(eq(vehicleMaintenanceLogs.driverId, id), gte(vehicleMaintenanceLogs.performedAt, periodStart), lte(vehicleMaintenanceLogs.performedAt, periodEnd)));

    const inspections = maintenance.filter((m) => m.maintenanceType === "technical_inspection");
    if (inspections.length > 0) {
      const compliant = inspections.filter((m) => m.regulatoryCompliant).length;
      vehicleComplianceList.push((compliant / inspections.length) * 100);
    }

    // Cargo compliance (sensor alerts on device for breaches)
    const deviceRows = await db
      .select({ deviceId: iotDevices.deviceId })
      .from(iotDevices)
      .where(eq(iotDevices.driverId, id))
      .limit(1);

    if (deviceRows.length > 0) {
      const readingCount = (await db
        .select({ id: sensorReadings.id })
        .from(sensorReadings)
        .where(and(eq(sensorReadings.deviceId, deviceRows[0].deviceId), gte(sensorReadings.recordedAt, startTs), lte(sensorReadings.recordedAt, endTs)))).length;

      const breachCount = (await db
        .select({ id: sensorAlerts.id })
        .from(sensorAlerts)
        .where(and(eq(sensorAlerts.driverId, id), gte(sensorAlerts.triggeredAt, startTs), lte(sensorAlerts.triggeredAt, endTs)))).length;

      if (readingCount > 0) cargoComplianceList.push(((readingCount - breachCount) / readingCount) * 100);
    }
  }

  const avg = (arr: number[]) => arr.length > 0 ? round2(arr.reduce((s, v) => s + v, 0) / arr.length) : null;

  return {
    fleetAvgGhgIntensityPerKm:    avg(ghgIntensities),
    fleetAvgIncidentRate:         avg(incidentRates),
    fleetAvgTrainingHours:        avg(trainingHoursList),
    fleetAvgCargoCompliancePct:   avg(cargoComplianceList),
    fleetAvgVehicleCompliancePct: avg(vehicleComplianceList),
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function buildEsgDataPackage(
  driverId: string,
  periodStart: string,  // YYYY-MM-DD
  periodEnd: string,    // YYYY-MM-DD
  language = "fr",
): Promise<EsgDataPackage> {
  const startTs = new Date(periodStart);
  const endTs   = new Date(periodEnd + "T23:59:59.999Z");

  // ── Parallel data fetch ───────────────────────────────────────────────────
  const [
    [driver],
    [profile],
    trips,
    shifts,
    maintenance,
    training,
    deviceRows,
    allAlerts,
  ] = await Promise.all([
    db.select({ id: users.id, name: users.name, tag: users.tag })
      .from(users).where(eq(users.id, driverId)).limit(1),

    db.select()
      .from(driverProfiles).where(eq(driverProfiles.driverId, driverId)).limit(1),

    db.select()
      .from(transportTrips)
      .where(and(eq(transportTrips.driverId, driverId), isNotNull(transportTrips.startedAt), gte(transportTrips.startedAt, startTs), lte(transportTrips.startedAt, endTs)))
      .orderBy(transportTrips.startedAt),

    db.select()
      .from(driverShifts)
      .where(and(eq(driverShifts.driverId, driverId), gte(driverShifts.shiftDate, periodStart), lte(driverShifts.shiftDate, periodEnd)))
      .orderBy(driverShifts.startedAt),

    db.select()
      .from(vehicleMaintenanceLogs)
      .where(and(eq(vehicleMaintenanceLogs.driverId, driverId), gte(vehicleMaintenanceLogs.performedAt, periodStart), lte(vehicleMaintenanceLogs.performedAt, periodEnd)))
      .orderBy(vehicleMaintenanceLogs.performedAt),

    db.select()
      .from(driverTrainingRecords)
      .where(and(eq(driverTrainingRecords.driverId, driverId), gte(driverTrainingRecords.completedAt, periodStart), lte(driverTrainingRecords.completedAt, periodEnd)))
      .orderBy(driverTrainingRecords.completedAt),

    db.select({ deviceId: iotDevices.deviceId })
      .from(iotDevices).where(eq(iotDevices.driverId, driverId)).limit(1),

    db.select()
      .from(sensorAlerts)
      .where(and(eq(sensorAlerts.driverId, driverId), gte(sensorAlerts.triggeredAt, startTs), lte(sensorAlerts.triggeredAt, endTs)))
      .orderBy(sensorAlerts.triggeredAt),
  ]);

  // ── Sensor readings (only if device exists) ───────────────────────────────
  const readings = deviceRows.length > 0
    ? await db.select()
        .from(sensorReadings)
        .where(and(eq(sensorReadings.deviceId, deviceRows[0].deviceId), gte(sensorReadings.recordedAt, startTs), lte(sensorReadings.recordedAt, endTs)))
    : [];

  // ── Trip calculations ─────────────────────────────────────────────────────
  const ghgBreakdown: Record<string, { liters: number; kgco2eq: number }> = {};

  const tripSummaries: TripSummary[] = trips.map((t) => {
    const liters = t.fuelLiters ?? 0;
    const factor = getGhgFactor(t.fuelType);
    const ghg    = round2(liters * factor);
    const key    = t.fuelType ?? "diesel";
    if (!ghgBreakdown[key]) ghgBreakdown[key] = { liters: 0, kgco2eq: 0 };
    ghgBreakdown[key].liters   += liters;
    ghgBreakdown[key].kgco2eq  += ghg;
    return {
      id:              t.id,
      vehiclePlate:    t.vehiclePlate,
      originLabel:     t.originLabel,
      destinationLabel:t.destinationLabel,
      distanceKm:      t.distanceKm,
      durationMinutes: t.durationMinutes,
      fuelLiters:      t.fuelLiters,
      fuelType:        t.fuelType,
      cargoWeightKg:   t.cargoWeightKg,
      isEmptyRun:      t.isEmptyRun,
      loadFactorPct:   t.loadFactorPct,
      ghgKgco2eq:      ghg,
      startedAt:       t.startedAt?.toISOString() ?? null,
      completedAt:     t.completedAt?.toISOString() ?? null,
    };
  });

  const totalTrips      = tripSummaries.length;
  const emptyRunCount   = tripSummaries.filter((t) => t.isEmptyRun).length;
  const emptyRunPct     = totalTrips > 0 ? round2((emptyRunCount / totalTrips) * 100) : 0;
  const totalDistanceKm = round2(tripSummaries.reduce((s, t) => s + (t.distanceKm ?? 0), 0));
  const emptyDistanceKm = round2(tripSummaries.filter((t) => t.isEmptyRun).reduce((s, t) => s + (t.distanceKm ?? 0), 0));
  const loadedDistanceKm= round2(totalDistanceKm - emptyDistanceKm);

  const loadFactors = tripSummaries.filter((t) => t.loadFactorPct !== null).map((t) => t.loadFactorPct!);
  const avgLoadFactorPct = loadFactors.length > 0 ? round2(loadFactors.reduce((s, v) => s + v, 0) / loadFactors.length) : null;

  const ghgScope1Kgco2eq       = round2(Object.values(ghgBreakdown).reduce((s, b) => s + b.kgco2eq, 0));
  const ghgScope1LoadedKgco2eq = round2(tripSummaries.filter((t) => !t.isEmptyRun).reduce((s, t) => s + t.ghgKgco2eq, 0));
  const ghgScope1EmptyKgco2eq  = round2(ghgScope1Kgco2eq - ghgScope1LoadedKgco2eq);
  const ghgIntensityPerKm      = totalDistanceKm > 0 ? round2(ghgScope1Kgco2eq / totalDistanceKm) : null;

  // GHG intensity per tonne-km: null if any trip missing cargo weight
  const allHaveWeight = tripSummaries.every((t) => t.isEmptyRun || t.cargoWeightKg !== null);
  const tonneKm = tripSummaries.reduce((s, t) => {
    if (t.isEmptyRun) return s;
    return s + ((t.cargoWeightKg ?? 0) / 1000) * (t.distanceKm ?? 0);
  }, 0);
  const ghgIntensityPerTonneKm  = allHaveWeight && tonneKm > 0 ? round2(ghgScope1LoadedKgco2eq / tonneKm) : null;

  // ── Shift calculations (ESRS S1-7) ───────────────────────────────────────
  const shiftSummaries: ShiftSummary[] = shifts.map((s) => ({
    id:              s.id,
    shiftDate:       s.shiftDate,
    startedAt:       s.startedAt.toISOString(),
    endedAt:         s.endedAt?.toISOString() ?? null,
    breakMinutes:    s.breakMinutes,
    drivingMinutes:  s.drivingMinutes,
    overtimeMinutes: s.overtimeMinutes,
    nightShift:      s.nightShift,
    status:          s.status,
  }));

  const totalShiftHours   = round2(shifts.reduce((sum, s) => {
    if (!s.endedAt) return sum;
    const totalMin = (s.endedAt.getTime() - s.startedAt.getTime()) / 60000;
    return sum + (totalMin - s.breakMinutes) / 60;
  }, 0));
  const totalBreakHours   = round2(shifts.reduce((s, sh) => s + sh.breakMinutes / 60, 0));
  const totalOvertimeHours= round2(shifts.reduce((s, sh) => s + sh.overtimeMinutes / 60, 0));
  const nightShiftCount   = shifts.filter((s) => s.nightShift).length;

  // Estimate driving hours from trips when shifts are missing  
  const totalDrivingHours = totalShiftHours > 0
    ? round2(shifts.reduce((s, sh) => s + (sh.drivingMinutes ?? 0) / 60, 0))
    : round2(tripSummaries.reduce((s, t) => s + (t.durationMinutes ?? 0) / 60, 0));

  const workingDays = new Set(shifts.map((s) => s.shiftDate)).size;
  const avgDailyHours = workingDays > 0 ? round2(totalShiftHours / workingDays) : null;

  const restCompliancePct = computeRestCompliance(shiftSummaries);

  // ── Incident / safety calculations (ESRS S1-14) ───────────────────────────
  const incidentSummaries: IncidentSummary[] = allAlerts.map((a) => ({
    id:          a.id,
    alertType:   a.alertType,
    value:       a.value,
    threshold:   a.threshold,
    status:      a.status,
    triggeredAt: a.triggeredAt.toISOString(),
  }));

  const incidentCount         = incidentSummaries.length;
  // Count alerts that are still active (proxy for work stoppages requiring intervention)
  const workStoppageCount     = incidentSummaries.filter((i) => i.status === "active").length;
  const highSeverityCount     = incidentSummaries.filter((i) => i.alertType === "vibration_high").length;
  // TF = (accidents × 1,000,000) / total shift hours — EU ESRS S1-14
  const accidentFrequencyRate = totalShiftHours > 0 ? round2((incidentCount * 1_000_000) / totalShiftHours) : null;

  // ── Cargo conditions ──────────────────────────────────────────────────────
  const sensorReadingCount = readings.length;
  const cargoBreachCount   = allAlerts.filter((a) => ["temp_high", "temp_low", "humidity_high"].includes(a.alertType)).length;
  const cargoBreachRatePct = sensorReadingCount > 0 ? round2((cargoBreachCount / sensorReadingCount) * 100) : null;

  const temps = readings.map((r) => r.temperatureC);
  const avgCargoTempC  = temps.length > 0 ? round2(temps.reduce((s, v) => s + v, 0) / temps.length) : null;
  const minCargoTempC  = temps.length > 0 ? round2(Math.min(...temps)) : null;
  const maxCargoTempC  = temps.length > 0 ? round2(Math.max(...temps)) : null;
  const humidities     = readings.map((r) => r.humidityPct);
  const avgCargoHumidityPct = humidities.length > 0 ? round2(humidities.reduce((s, v) => s + v, 0) / humidities.length) : null;

  // ── Maintenance (ESRS E5, G1) ─────────────────────────────────────────────
  const maintenanceSummaries: MaintenanceSummary[] = maintenance.map((m) => ({
    id:                  m.id,
    vehiclePlate:        m.vehiclePlate,
    maintenanceType:     m.maintenanceType,
    performedAt:         m.performedAt,
    odometerKm:          m.odometerKm,
    costEur:             m.costEur,
    fuelLiters:          m.fuelLiters,
    providerName:        m.providerName,
    nextDueAt:           m.nextDueAt,
    regulatoryCompliant: m.regulatoryCompliant,
  }));

  const maintenanceCount     = maintenance.length;
  const fuelFillCount        = maintenance.filter((m) => m.maintenanceType === "fuel_fill").length;
  const inspections          = maintenance.filter((m) => m.maintenanceType === "technical_inspection");
  const inspectionCount      = inspections.length;
  const regulatoryCompliantCount = inspections.filter((m) => m.regulatoryCompliant).length;
  const regulatoryComplianceRatePct = inspectionCount > 0 ? round2((regulatoryCompliantCount / inspectionCount) * 100) : null;
  const costsRecorded        = maintenance.filter((m) => m.costEur !== null);
  const totalMaintenanceCostEur = costsRecorded.length > 0 ? round2(costsRecorded.reduce((s, m) => s + (m.costEur ?? 0), 0)) : null;

  // Also count fuel from maintenance logs (fuel_fill entries)
  const totalFuelFromMaintenance = maintenance
    .filter((m) => m.maintenanceType === "fuel_fill" && m.fuelLiters)
    .reduce((s, m) => s + (m.fuelLiters ?? 0), 0);
  const totalFuelLiters = round2(
    tripSummaries.reduce((s, t) => s + (t.fuelLiters ?? 0), 0) + totalFuelFromMaintenance,
  );

  // ── Training & certifications (ESRS S1-13) ───────────────────────────────
  const periodEndDate = new Date(periodEnd);
  const ninetyDaysLater = new Date(periodEnd);
  ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90);

  const trainingSummaries: TrainingSummary[] = training.map((t) => {
    const expiry       = t.expiryDate ? new Date(t.expiryDate) : null;
    const isExpired    = expiry ? expiry <= periodEndDate : false;
    const isExpiringSoon = expiry ? expiry <= ninetyDaysLater && !isExpired : false;
    return {
      id:                  t.id,
      trainingType:        t.trainingType,
      title:               t.title,
      provider:            t.provider,
      completedAt:         t.completedAt,
      durationHours:       t.durationHours,
      certificationNumber: t.certificationNumber,
      expiryDate:          t.expiryDate,
      passed:              t.passed,
      isExpired,
      isExpiringSoon,
    };
  });

  const trainingHoursTotal       = round2(training.reduce((s, t) => s + t.durationHours, 0));
  const trainingCount            = training.length;
  const withCert                 = training.filter((t) => t.certificationNumber);
  const certificationsActive     = withCert.filter((t) => !trainingSummaries.find((ts) => ts.id === t.id)?.isExpired).length;
  const certificationsExpiring90d= trainingSummaries.filter((ts) => ts.isExpiringSoon).length;
  const certificationsExpired    = trainingSummaries.filter((ts) => ts.isExpired).length;
  const licenseCategories        = (profile?.drivingLicenseCategories as string[]) ?? [];

  // ── Fleet benchmarks ──────────────────────────────────────────────────────
  const bench = await buildFleetBenchmarks(driverId, periodStart, periodEnd);

  const driverVsFleetGhgPct =
    bench.fleetAvgGhgIntensityPerKm && ghgIntensityPerKm
      ? round2(((ghgIntensityPerKm - bench.fleetAvgGhgIntensityPerKm) / bench.fleetAvgGhgIntensityPerKm) * 100)
      : null;

  const driverVsFleetIncidentPct =
    bench.fleetAvgIncidentRate !== null && accidentFrequencyRate !== null
      ? bench.fleetAvgIncidentRate > 0
        ? round2(((accidentFrequencyRate - bench.fleetAvgIncidentRate) / bench.fleetAvgIncidentRate) * 100)
        : null
      : null;

  // ── Behaviour metrics (ESRS S1-14 — safe driving behaviour) ─────────────
  const driverBhReports = await db
    .select({
      globalScore:    behaviourReports.globalScore,
      totalEvents:    behaviourReports.totalEvents,
      criticalEvents: behaviourReports.criticalEvents,
    })
    .from(behaviourReports)
    .where(
      and(
        eq(behaviourReports.driverId, driverId),
        eq(behaviourReports.status, "ready"),
        gte(behaviourReports.generatedAt, startTs),
        lte(behaviourReports.generatedAt, endTs),
      )
    );

  // Event type distribution for the period
  const bhEventRows = await db
    .select({
      eventType: drivingEvents.eventType,
    })
    .from(drivingEvents)
    .innerJoin(transportTrips, eq(drivingEvents.tripId, transportTrips.id))
    .where(
      and(
        eq(transportTrips.driverId, driverId),
        gte(drivingEvents.occurredAt, startTs),
        lte(drivingEvents.occurredAt, endTs),
      )
    );

  const behaviourEventsByType: Record<string, number> = {};
  for (const { eventType } of bhEventRows) {
    behaviourEventsByType[eventType] = (behaviourEventsByType[eventType] ?? 0) + 1;
  }

  const scores          = driverBhReports.map((r) => r.globalScore);
  const behaviourAvgScore     = scores.length > 0
    ? round2(scores.reduce((s, v) => s + v, 0) / scores.length)
    : null;
  const behaviourTripCount    = driverBhReports.length;
  const behaviourTotalEvents  = driverBhReports.reduce((s, r) => s + r.totalEvents, 0);
  const behaviourCriticalEvents = driverBhReports.reduce((s, r) => s + r.criticalEvents, 0);
  const behaviourWorstTripScore = scores.length > 0 ? Math.min(...scores) : null;
  const behaviourBestTripScore  = scores.length > 0 ? Math.max(...scores) : null;

  // ── Primary vehicle plate / fuel type from trips ─────────────────────────
  const primaryTrip  = tripSummaries[0];
  const vehiclePlate = primaryTrip?.vehiclePlate ?? null;
  const fuelType     = primaryTrip?.fuelType ?? null;

  return {
    // Identity
    driverId,
    driverName:              driver?.name ?? driverId,
    driverEmployeeId:        driver?.tag  ?? driverId,
    gender:                  profile?.gender ?? null,
    ageGroup:                deriveAgeGroup(profile?.birthYear ?? null),
    contractType:            profile?.contractType ?? null,
    vehiclePlate,
    fuelType,
    drivingLicenseCategories: licenseCategories,
    periodStart,
    periodEnd,
    periodType:              "custom",
    generatedAt:             new Date().toISOString(),
    language,

    // Transport activity
    totalTrips,
    emptyRunCount,
    emptyRunPct,
    totalDistanceKm,
    emptyDistanceKm,
    loadedDistanceKm,
    avgLoadFactorPct,
    trips: tripSummaries,

    // Working time
    totalShiftHours,
    totalDrivingHours,
    totalBreakHours,
    totalOvertimeHours,
    nightShiftCount,
    avgDailyHours,
    restCompliancePct,
    shifts: shiftSummaries,

    // GHG
    totalFuelLiters,
    ghgFuelBreakdown:        ghgBreakdown,
    ghgScope1Kgco2eq,
    ghgScope1LoadedKgco2eq,
    ghgScope1EmptyKgco2eq,
    ghgIntensityPerKm,
    ghgIntensityPerTonneKm,

    // Health & safety
    incidentCount,
    workStoppageCount,
    highSeverityCount,
    accidentFrequencyRate,
    incidents: incidentSummaries,

    // Cargo
    sensorReadingCount,
    avgCargoTempC,
    minCargoTempC,
    maxCargoTempC,
    avgCargoHumidityPct,
    cargoBreachCount,
    cargoBreachRatePct,

    // Maintenance
    maintenanceCount,
    fuelFillCount,
    inspectionCount,
    regulatoryComplianceRatePct,
    totalMaintenanceCostEur,
    maintenanceRecords: maintenanceSummaries,

    // Training
    trainingHoursTotal,
    trainingCount,
    certificationsActive,
    certificationsExpiring90d,
    certificationsExpired,
    trainingRecords: trainingSummaries,
    licenseCategories,

    // Diversity
    diversityGender:       profile?.gender ?? null,
    diversityAgeGroup:     deriveAgeGroup(profile?.birthYear ?? null),
    diversityContractType: profile?.contractType ?? null,

    // Fleet benchmark
    ...bench,
    driverVsFleetGhgPct,
    driverVsFleetIncidentPct,

    // Driver behaviour (ESRS S1-14)
    behaviourAvgScore,
    behaviourTripCount,
    behaviourTotalEvents,
    behaviourCriticalEvents,
    behaviourEventsByType,
    behaviourWorstTripScore,
    behaviourBestTripScore,
  };
}
