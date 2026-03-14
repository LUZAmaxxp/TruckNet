/**
 * lib/driver-esg-csv.ts
 *
 * Generates a structured CSV from an EsgDataPackage.
 * UTF-8 BOM for Excel compatibility.
 * One row per KPI — normalized_key matches ESG platform reference list.
 * Null values exported as empty string (never "null" or "N/A").
 */

import type { EsgDataPackage } from "@/schemas/driver-esg-report.schema";

const BOM = "\uFEFF";

const HEADERS = [
  "normalized_key",
  "label",
  "value",
  "unit",
  "data_type",
  "period_start",
  "period_end",
  "iso26000_ref",
  "csrd_esrs_ref",
  "driver_name",
  "company_name",
  "source",
].join(",");

function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(
  normalizedKey: string,
  label: string,
  value: unknown,
  unit: string,
  dataType: "number" | "string" | "percent",
  iso26000: string,
  esrs: string,
  data: EsgDataPackage,
): string {
  return [
    esc(normalizedKey),
    esc(label),
    esc(value),
    esc(unit),
    esc(dataType),
    esc(data.periodStart),
    esc(data.periodEnd),
    esc(iso26000),
    esc(esrs),
    esc(data.driverName),
    esc("TruckNet"),
    esc("TruckNet ESG Module"),
  ].join(",");
}

export function generateDriverEsgCsv(data: EsgDataPackage): string {
  const rows: string[] = [];

  const r = (key: string, label: string, value: unknown, unit: string, type: "number"|"string"|"percent", iso: string, esrs: string) =>
    row(key, label, value, unit, type, iso, esrs, data);

  rows.push(
    r("transport_trips_count",                 "Nombre de trajets",                          data.totalTrips,                   "trajets",           "number",  "ISO 26000 §6.4",   "ESRS S1"),
    r("transport_empty_run_count",             "Trajets à vide",                             data.emptyRunCount,                "trajets",           "number",  "ISO 26000 §6.4",   "ESRS E1"),
    r("transport_empty_run_pct",               "Taux roulage à vide",                        data.emptyRunPct,                  "%",                 "percent", "ISO 26000 §6.4",   "ESRS E1"),
    r("transport_total_distance_km",           "Distance totale",                            data.totalDistanceKm,              "km",                "number",  "ISO 26000 §6.4",   "ESRS S1"),
    r("transport_avg_load_factor_pct",         "Taux de chargement moyen",                   data.avgLoadFactorPct,             "%",                 "percent", "ISO 26000 §6.4",   "ESRS E1"),
    r("transport_shift_hours_total",           "Heures de travail",                          data.totalShiftHours,              "heures",            "number",  "ISO 26000 §6.4.3", "ESRS S1-7"),
    r("transport_driving_hours_total",         "Heures de conduite",                         data.totalDrivingHours,            "heures",            "number",  "ISO 26000 §6.4.3", "ESRS S1-7"),
    r("transport_overtime_hours_total",        "Heures supplémentaires",                     data.totalOvertimeHours,           "heures",            "number",  "ISO 26000 §6.4.3", "ESRS S1-7"),
    r("transport_night_shifts_count",          "Postes de nuit",                             data.nightShiftCount,              "postes",            "number",  "ISO 26000 §6.4.3", "ESRS S1-7"),
    r("transport_rest_compliance_pct",         "Conformité temps de repos",                  data.restCompliancePct,            "%",                 "percent", "ISO 26000 §6.4.3", "EU Reg 561/2006"),
    r("transport_fuel_total_liters",           "Carburant consommé",                         data.totalFuelLiters,              "L",                 "number",  "ISO 26000 §6.5.5", "ESRS E5"),
    r("ghg_scope1",                            "Émissions GES Scope 1 transport",            data.ghgScope1Kgco2eq,             "kg CO2eq",          "number",  "ISO 26000 §6.5.5", "ESRS E1-6"),
    r("ghg_scope1_loaded_runs",                "GES trajets chargés",                        data.ghgScope1LoadedKgco2eq,       "kg CO2eq",          "number",  "ISO 26000 §6.5.5", "ESRS E1-6"),
    r("ghg_scope1_empty_runs",                 "GES trajets à vide",                         data.ghgScope1EmptyKgco2eq,        "kg CO2eq",          "number",  "ISO 26000 §6.5.5", "ESRS E1-6"),
    r("transport_ghg_intensity_kgco2_per_km",  "Intensité GES/km",                           data.ghgIntensityPerKm,            "kg CO2eq/km",       "number",  "ISO 26000 §6.5.5", "ESRS E1"),
    r("transport_ghg_intensity_per_tonne_km",  "Intensité GES/tonne-km",                     data.ghgIntensityPerTonneKm,       "kg CO2eq/t-km",     "number",  "ISO 26000 §6.5.5", "ESRS E1"),
    r("work_accidents_frequency_rate",         "Incidents de transport",                     data.incidentCount,                "incidents",         "number",  "ISO 26000 §6.4.6", "ESRS S1-14"),
    r("transport_work_stoppages_count",        "Arrêts de travail",                          data.workStoppageCount,            "arrêts",            "number",  "ISO 26000 §6.4.6", "ESRS S1"),
    r("transport_high_severity_incidents",     "Incidents gravité haute/critique",           data.highSeverityCount,            "incidents",         "number",  "ISO 26000 §6.4.6", "ESRS S1-14"),
    r("transport_accident_frequency_rate",     "Taux de fréquence accidents",                data.accidentFrequencyRate,        "acc/million h",     "number",  "ISO 26000 §6.4.6", "ESRS S1-14"),
    r("transport_sensor_readings_count",       "Mesures ESP32",                              data.sensorReadingCount,           "mesures",           "number",  "ISO 26000 §6.7",   "ESRS G1"),
    r("transport_cargo_temp_avg_c",            "Température moy. cargaison",                 data.avgCargoTempC,                "°C",                "number",  "ISO 26000 §6.7",   "ESRS G1"),
    r("transport_cargo_temp_min_c",            "Température min. cargaison",                 data.minCargoTempC,                "°C",                "number",  "ISO 26000 §6.7",   "ESRS G1"),
    r("transport_cargo_temp_max_c",            "Température max. cargaison",                 data.maxCargoTempC,                "°C",                "number",  "ISO 26000 §6.7",   "ESRS G1"),
    r("transport_cargo_humidity_avg_pct",      "Humidité moy. cargaison",                    data.avgCargoHumidityPct,          "%",                 "percent", "ISO 26000 §6.7",   "ESRS G1"),
    r("transport_cargo_condition_breaches",    "Dépassements cargaison",                     data.cargoBreachCount,             "dépassements",      "number",  "ISO 26000 §6.7",   "ESRS G1"),
    r("transport_cargo_breach_rate_pct",       "Taux de dépassement cargaison",              data.cargoBreachRatePct,           "%",                 "percent", "ISO 26000 §6.7",   "ESRS G1"),
    r("vehicle_maintenance_count",             "Entretiens véhicule",                        data.maintenanceCount,             "interventions",     "number",  "ISO 26000 §6.5.4", "ESRS E5"),
    r("vehicle_inspection_count",              "Contrôles techniques",                       data.inspectionCount,              "contrôles",         "number",  "ISO 26000 §6.5.4", "ESRS G1"),
    r("vehicle_regulatory_compliance_rate",    "Conformité réglementaire véhicule",          data.regulatoryComplianceRatePct,  "%",                 "percent", "ISO 26000 §6.5.4", "ESRS G1"),
    r("employee_training_hours_avg",           "Heures de formation",                        data.trainingHoursTotal,           "heures",            "number",  "ISO 26000 §6.4.7", "ESRS S1-13"),
    r("driver_certifications_active",          "Certifications actives",                     data.certificationsActive,         "certifications",    "number",  "ISO 26000 §6.4.7", "ESRS S1-13"),
    r("driver_certifications_expiring",        "Certifications à renouveler (90 j)",         data.certificationsExpiring90d,    "certifications",    "number",  "ISO 26000 §6.4.7", "ESRS S1-13"),
    r("driver_certifications_expired",         "Certifications expirées",                    data.certificationsExpired,        "certifications",    "number",  "ISO 26000 §6.4.7", "ESRS S1-13"),
    r("employee_gender",                       "Genre",                                      data.diversityGender,              "—",                 "string",  "ISO 26000 §6.3.10","ESRS S1-12"),
    r("employee_age_group",                    "Groupe d'âge",                               data.diversityAgeGroup,            "—",                 "string",  "ISO 26000 §6.3.10","ESRS S1-12"),
    r("employee_contract_type",                "Type de contrat",                            data.diversityContractType,        "—",                 "string",  "ISO 26000 §6.3.10","ESRS S1"),
    r("driving_license_categories",            "Catégories de permis",                       data.licenseCategories.join(", "), "—",                 "string",  "ISO 26000 §6.4",   "ESRS S1"),
  );

  return BOM + HEADERS + "\n" + rows.join("\n");
}
