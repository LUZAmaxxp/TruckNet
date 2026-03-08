/**
 * lib/driver-esg-html-template.ts
 *
 * Builds a fully self-contained HTML document (inline CSS, no external resources)
 * suitable for Puppeteer PDF generation.
 *
 * 10 sections + cover page + legal footer.
 * Section 10 is the machine-readable OCR import table for ESG platforms.
 * All text in French by default.
 */

import type { EsgDataPackage } from "@/schemas/driver-esg-report.schema";
import { GHG_FACTORS_KG_CO2_PER_LITER } from "@/lib/driver-esg-aggregator";

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function benchmarkColor(driverVsFleetPct: number | null, lowerIsBetter = false): string {
  if (driverVsFleetPct === null) return "#6b7280";
  const good = lowerIsBetter ? driverVsFleetPct < -5 : driverVsFleetPct > 5;
  const bad  = lowerIsBetter ? driverVsFleetPct > 10  : driverVsFleetPct < -10;
  if (good) return "#16a34a";
  if (bad)  return "#dc2626";
  return "#d97706";
}

function benchmarkLabel(pct: number | null, lowerIsBetter = false): string {
  if (pct === null) return "N/D";
  const sign = pct > 0 ? "+" : "";
  const color = benchmarkColor(pct, lowerIsBetter);
  return `<span style="color:${color};font-weight:700">${sign}${fmt(pct, 1)} % vs flotte</span>`;
}

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #1a1a2e; background: #fff; }
  .page { padding: 0; }
  h1 { font-size: 22pt; font-weight: 800; color: #0f2d5c; }
  h2 { font-size: 13pt; font-weight: 700; color: #0f2d5c; margin-bottom: 8px; }
  h3 { font-size: 11pt; font-weight: 700; color: #0f2d5c; margin-bottom: 6px; }
  .section { padding: 18px 0; border-top: 2px solid #0f2d5c; margin-top: 20px; }
  .section:first-child { border-top: none; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th { background: #0f2d5c; color: #fff; padding: 6px 8px; text-align: left; font-size: 9pt; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr:nth-child(even) td { background: #f9fafb; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
  .kpi-card { border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 12px; background: #f9fafb; }
  .kpi-label { font-size: 8pt; color: #6b7280; margin-bottom: 3px; }
  .kpi-value { font-size: 16pt; font-weight: 800; color: #0f2d5c; }
  .kpi-unit  { font-size: 8pt; color: #6b7280; }
  .ref-badge { display: inline-block; font-size: 7.5pt; background: #e0e7ff; color: #3730a3; border-radius: 3px; padding: 1px 5px; margin-left: 6px; vertical-align: middle; }
  .info-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 10px 14px; border-radius: 4px; font-size: 9pt; margin-bottom: 12px; }
  .warn-box  { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 10px 14px; border-radius: 4px; font-size: 9pt; margin-bottom: 12px; }
  .error-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 10px 14px; border-radius: 4px; font-size: 9pt; margin-bottom: 12px; }
  .success-box { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 10px 14px; border-radius: 4px; font-size: 9pt; margin-bottom: 12px; }
  .cover { background: #0f2d5c; color: #fff; padding: 40px; min-height: 220px; border-radius: 8px; margin-bottom: 24px; }
  .cover h1 { color: #fff; }
  .cover .subtitle { color: #93c5fd; font-size: 11pt; margin-top: 6px; }
  .cover .meta { font-size: 9pt; color: #bfdbfe; margin-top: 14px; }
  .bench-row { display: flex; gap: 14px; margin-top: 14px; }
  .bench-pill { background: rgba(255,255,255,.12); border-radius: 20px; padding: 6px 14px; font-size: 9pt; }
  .red-row td { background: #fef2f2 !important; }
  .orange-row td { background: #fffbeb !important; }
  .ocr-table th { font-size: 8pt; }
  .ocr-table td { font-size: 8.5pt; font-family: 'Courier New', monospace; }
  .ocr-table td:first-child { color: #1d4ed8; font-weight: 700; }
  .page-break { page-break-before: always; }
  .footer { font-size: 7.5pt; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 20px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
`;

function kpiCard(label: string, value: string | number | null, unit = ""): string {
  return `
    <div class="kpi-card">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value === null || value === undefined ? "—" : typeof value === "number" ? fmt(value) : value}</div>
      ${unit ? `<div class="kpi-unit">${unit}</div>` : ""}
    </div>`;
}

function idRow(label: string, value: string | null | undefined): string {
  return `<tr><td style="font-weight:600;width:46%">${label}</td><td>${value || "—"}</td></tr>`;
}

export function buildDriverEsgHtml(data: EsgDataPackage, language = "fr"): string {
  const ghgFactor = GHG_FACTORS_KG_CO2_PER_LITER[data.fuelType ?? "diesel"] ?? 2.65;

  // ── COVER PAGE ────────────────────────────────────────────────────────────
  const coverBenchGhg  = data.driverVsFleetGhgPct !== null
    ? `GES : ${data.driverVsFleetGhgPct > 0 ? "+" : ""}${fmt(data.driverVsFleetGhgPct, 1)}% vs flotte`
    : "GES : N/D";
  const coverBenchInc  = data.driverVsFleetIncidentPct !== null
    ? `Sécurité : ${data.driverVsFleetIncidentPct > 0 ? "+" : ""}${fmt(data.driverVsFleetIncidentPct, 1)}% incidents`
    : "Sécurité : N/D";
  const coverBenchTrn  = data.fleetAvgTrainingHours !== null
    ? `Formation : ${fmt(data.trainingHoursTotal, 1)}h (moy. flotte ${fmt(data.fleetAvgTrainingHours, 1)}h)`
    : "Formation : N/D";

  const ghgColor = benchmarkColor(data.driverVsFleetGhgPct, true);
  const incColor = benchmarkColor(data.driverVsFleetIncidentPct, true);
  const trnColor = data.trainingHoursTotal >= (data.fleetAvgTrainingHours ?? 0) ? "#16a34a" : "#d97706";

  const cover = `
  <div class="cover">
    <h1>RAPPORT ESG/RSE — DONNÉES DE TRANSPORT</h1>
    <div class="subtitle">Rapport individuel conducteur · ISO 26000 / CSRD ESRS</div>
    <div class="meta">
      Conducteur : <strong>${data.driverName}</strong> (${data.driverEmployeeId}) &nbsp;|&nbsp;
      Véhicule : <strong>${data.vehiclePlate ?? "N/D"}</strong> &nbsp;|&nbsp;
      Période : <strong>${fmtDate(data.periodStart)} → ${fmtDate(data.periodEnd)}</strong>
    </div>
    <div class="bench-row">
      <div class="bench-pill" style="border: 2px solid ${ghgColor}; color: ${ghgColor};">${coverBenchGhg}</div>
      <div class="bench-pill" style="border: 2px solid ${incColor}; color: ${incColor};">${coverBenchInc}</div>
      <div class="bench-pill" style="border: 2px solid ${trnColor}; color: ${trnColor};">${coverBenchTrn}</div>
    </div>
    <div class="meta" style="margin-top:10px">Généré le ${new Date(data.generatedAt).toLocaleDateString("fr-FR")} par TruckNet</div>
  </div>
  <div class="info-box">
    Ce document est optimisé pour import direct dans votre plateforme ESG/RSE via OCR automatique.
    La Section 10 contient la table structurée des observations normalisées.
  </div>`;

  // ── SECTION 1 — Identification ────────────────────────────────────────────
  const s1 = `
  <div class="section">
    <h2>1. IDENTIFICATION DU CONDUCTEUR <span class="ref-badge">ISO 26000 §4</span></h2>
    <table>
      ${idRow("Conducteur", data.driverName)}
      ${idRow("Matricule", data.driverEmployeeId)}
      ${idRow("Genre", data.gender ?? null)}
      ${idRow("Groupe d'âge", data.ageGroup ?? null)}
      ${idRow("Type de contrat", data.contractType ?? null)}
      ${idRow("Véhicule", data.vehiclePlate ? `${data.vehiclePlate}` : null)}
      ${idRow("Catégories de permis", data.drivingLicenseCategories.join(", ") || null)}
      ${idRow("Type de carburant", data.fuelType ?? null)}
      ${idRow("Période", `${fmtDate(data.periodStart)} → ${fmtDate(data.periodEnd)}`)}
    </table>
  </div>`;

  // ── SECTION 2 — Transport activity ────────────────────────────────────────
  const tripsRows = data.trips.slice(0, 50).map((t) => `
    <tr>
      <td>${t.id.slice(0, 8)}</td>
      <td>${t.startedAt ? new Date(t.startedAt).toLocaleDateString("fr-FR") : "—"}</td>
      <td>${t.originLabel ?? "—"} → ${t.destinationLabel ?? "—"}</td>
      <td>${fmt(t.distanceKm, 1)}</td>
      <td>${fmt(t.durationMinutes ? t.durationMinutes / 60 : null, 1)}</td>
      <td>${fmt(t.fuelLiters, 1)}</td>
      <td>${fmt(t.ghgKgco2eq, 1)}</td>
      <td>${t.isEmptyRun ? "✓" : ""}</td>
    </tr>`).join("");

  const s2 = `
  <div class="section">
    <h2>2. ACTIVITÉ DE TRANSPORT <span class="ref-badge">ISO 26000 §6.4</span> <span class="ref-badge">ESRS S1, E1</span></h2>
    <div class="kpi-grid">
      ${kpiCard("Trajets effectués",       data.totalTrips,       "trajets")}
      ${kpiCard("Trajets à vide",          data.emptyRunCount,    "trajets")}
      ${kpiCard("Taux roulage à vide",     data.emptyRunPct,      "%")}
      ${kpiCard("Distance totale",         data.totalDistanceKm,  "km")}
      ${kpiCard("Distance chargée",        data.loadedDistanceKm, "km")}
      ${kpiCard("Taux de chargement moy.", data.avgLoadFactorPct, "%")}
    </div>
    ${data.trips.length > 0 ? `
    <h3>Détail des trajectoires</h3>
    <table>
      <thead><tr><th>Réf</th><th>Date</th><th>Trajet</th><th>km</th><th>Durée (h)</th><th>Carburant (L)</th><th>GHG (kg)</th><th>À vide</th></tr></thead>
      <tbody>${tripsRows}</tbody>
    </table>` : '<div class="info-box">Aucun trajet enregistré pour cette période.</div>'}
  </div>`;

  // ── SECTION 3 — Working time ───────────────────────────────────────────────
  const s3 = `
  <div class="section">
    <h2>3. TEMPS DE TRAVAIL <span class="ref-badge">ISO 26000 §6.4.3</span> <span class="ref-badge">ESRS S1-7</span></h2>
    <div class="kpi-grid">
      ${kpiCard("Heures de travail totales",  data.totalShiftHours,    "heures")}
      ${kpiCard("Dont heures de conduite",    data.totalDrivingHours,  "heures")}
      ${kpiCard("Heures supplémentaires",     data.totalOvertimeHours, "heures")}
      ${kpiCard("Postes de nuit",             data.nightShiftCount,    "postes")}
      ${kpiCard("Conformité temps de repos",  data.restCompliancePct,  "%")}
      ${kpiCard("Moy. heures / jour",         data.avgDailyHours,      "h/jour")}
    </div>
    <div class="info-box">
      Analyse effectuée selon le règlement EU 561/2006 — repos minimum 11h entre deux prises de service.
      ${data.totalShiftHours === 0 ? " Les heures de travail sont estimées depuis les durées de trajets (aucune prise de service enregistrée)." : ""}
    </div>
  </div>`;

  // ── SECTION 4 — GHG Scope 1 ───────────────────────────────────────────────
  const s4 = `
  <div class="section">
    <h2>4. ÉMISSIONS GES — SCOPE 1 <span class="ref-badge">ISO 26000 §6.5.5</span> <span class="ref-badge">ESRS E1-6</span></h2>
    <div class="info-box">
      Véhicules appartenant à l'entreprise = Scope 1. Facteur ADEME Base Carbone 2024 :
      <strong>${ghgFactor} kg CO₂eq / L (${data.fuelType ?? "diesel"})</strong>.
    </div>
    <div class="kpi-grid">
      ${kpiCard("Carburant total",              data.totalFuelLiters,           "L")}
      ${kpiCard("Émissions GES Scope 1",        data.ghgScope1Kgco2eq,          "kg CO₂eq")}
      ${kpiCard("Dont trajets chargés",         data.ghgScope1LoadedKgco2eq,    "kg CO₂eq")}
      ${kpiCard("Dont trajets à vide (évit.)",  data.ghgScope1EmptyKgco2eq,     "kg CO₂eq")}
      ${kpiCard("Intensité GES / km",           data.ghgIntensityPerKm,         "kg CO₂eq/km")}
      ${kpiCard("Intensité GES / tonne-km",     data.ghgIntensityPerTonneKm,    "kg CO₂eq/t-km")}
    </div>
    ${data.fleetAvgGhgIntensityPerKm !== null ? `
    <p style="font-size:9pt;margin-top:6px">
      Comparaison flotte : ${benchmarkLabel(data.driverVsFleetGhgPct, true)}
      (Moy. flotte : ${fmt(data.fleetAvgGhgIntensityPerKm, 3)} kg CO₂eq/km)
    </p>` : ""}
  </div>`;

  // ── SECTION 5 — Safety ────────────────────────────────────────────────────
  const safetyBox = data.incidentCount === 0
    ? '<div class="success-box">Aucun incident enregistré sur cette période. ✓</div>'
    : '<div class="info-box"><strong>Formule TF :</strong> (Nombre d\'accidents × 1 000 000) / Heures travaillées</div>';

  const incRows = data.incidents.map((i) => `
    <tr>
      <td>${i.id.slice(0, 8)}</td>
      <td>${i.alertType}</td>
      <td>${fmt(i.value, 2)}</td>
      <td>${fmt(i.threshold, 2)}</td>
      <td>${i.status}</td>
      <td>${new Date(i.triggeredAt).toLocaleDateString("fr-FR")}</td>
    </tr>`).join("");

  const s5 = `
  <div class="section">
    <h2>5. SANTÉ ET SÉCURITÉ AU TRAVAIL <span class="ref-badge">ISO 26000 §6.4.6</span> <span class="ref-badge">ESRS S1-14</span></h2>
    <div class="kpi-grid">
      ${kpiCard("Incidents de transport",        data.incidentCount,           "incidents")}
      ${kpiCard("Dont arrêts de travail",        data.workStoppageCount,       "arrêts")}
      ${kpiCard("Incidents gravité haute",       data.highSeverityCount,       "incidents")}
      ${kpiCard("Taux de fréquence (TF)",        data.accidentFrequencyRate,   "acc/million h")}
    </div>
    ${safetyBox}
    ${data.incidents.length > 0 ? `
    <table>
      <thead><tr><th>Réf</th><th>Type</th><th>Valeur</th><th>Seuil</th><th>Statut</th><th>Date</th></tr></thead>
      <tbody>${incRows}</tbody>
    </table>` : ""}

    ${data.behaviourTripCount > 0 ? `
    <h3 style="margin-top:16px;font-size:11pt">5a. COMPORTEMENT DE CONDUITE — Sécurité routière <span class="ref-badge">ESRS S1-14</span></h3>
    <div class="kpi-grid">
      ${kpiCard("Score moyen conduite", data.behaviourAvgScore, "/100")}
      ${kpiCard("Trajets évalués",      data.behaviourTripCount, "trajets")}
      ${kpiCard("Événements totaux",    data.behaviourTotalEvents, "événements")}
      ${kpiCard("Événements critiques", data.behaviourCriticalEvents, "critiques")}
      ${kpiCard("Score trajet min.",    data.behaviourWorstTripScore, "/100")}
      ${kpiCard("Score trajet max.",    data.behaviourBestTripScore, "/100")}
    </div>
    ${Object.keys(data.behaviourEventsByType).length > 0 ? `
    <table>
      <thead><tr><th>Type d'événement</th><th style="text-align:right">Occurrences</th></tr></thead>
      <tbody>${Object.entries(data.behaviourEventsByType).map(([type, count]) => `<tr><td>${type.replace(/_/g, " ")}</td><td style="text-align:right">${count}</td></tr>`).join("")}</tbody>
    </table>` : ""}` : `
    <div class="info-box" style="margin-top:12px">Aucune donnée de comportement de conduite disponible pour cette période.</div>`}
  </div>`;

  // ── SECTION 6 — Cargo conditions ──────────────────────────────────────────
  const s6 = `
  <div class="section">
    <h2>6. CONDITIONS DE TRANSPORT CARGAISON <span class="ref-badge">ISO 26000 §6.7</span> <span class="ref-badge">ESRS G1</span></h2>
    ${data.sensorReadingCount === 0
      ? '<div class="info-box">Aucune donnée capteur ESP32 disponible pour cette période.</div>'
      : `<div class="kpi-grid">
          ${kpiCard("Mesures ESP32",        data.sensorReadingCount,   "mesures")}
          ${kpiCard("Température moy.",     data.avgCargoTempC,        "°C")}
          ${kpiCard("Température min./max.",data.minCargoTempC !== null ? `${fmt(data.minCargoTempC, 1)} / ${fmt(data.maxCargoTempC, 1)}` : null, "°C")}
          ${kpiCard("Humidité moy.",        data.avgCargoHumidityPct,  "%")}
          ${kpiCard("Dépassements seuils",  data.cargoBreachCount,     "dépassements")}
          ${kpiCard("Taux de dépassement",  data.cargoBreachRatePct,   "%")}
        </div>`}
  </div>`;

  // ── SECTION 7 — Maintenance ───────────────────────────────────────────────
  const maintRows = data.maintenanceRecords.map((m) => `
    <tr class="${!m.regulatoryCompliant ? "red-row" : ""}">
      <td>${fmtDate(m.performedAt)}</td>
      <td>${m.maintenanceType}</td>
      <td>${fmt(m.odometerKm, 0)} km</td>
      <td>${m.providerName ?? "—"}</td>
      <td style="color:${m.regulatoryCompliant ? "#16a34a" : "#dc2626"};font-weight:700">${m.regulatoryCompliant ? "✓" : "✗"}</td>
      <td>${fmtDate(m.nextDueAt)}</td>
    </tr>`).join("");

  const s7 = `
  <div class="section">
    <h2>7. ENTRETIEN VÉHICULE <span class="ref-badge">ISO 26000 §6.5.4</span> <span class="ref-badge">ESRS E5, G1</span></h2>
    <div class="kpi-grid">
      ${kpiCard("Interventions d'entretien",     data.maintenanceCount,             "interventions")}
      ${kpiCard("Contrôles techniques",          data.inspectionCount,              "contrôles")}
      ${kpiCard("Conformité réglementaire",      data.regulatoryComplianceRatePct,  "%")}
      ${kpiCard("Pleins de carburant",           data.fuelFillCount,                "pleins")}
    </div>
    ${data.maintenanceRecords.length > 0 ? `
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Kilométrage</th><th>Prestataire</th><th>Conformité</th><th>Prochaine échéance</th></tr></thead>
      <tbody>${maintRows}</tbody>
    </table>` : '<div class="info-box">Aucun entretien enregistré pour cette période.</div>'}
  </div>`;

  // ── SECTION 8 — Training ─────────────────────────────────────────────────
  const trainRows = data.trainingRecords.map((t) => `
    <tr class="${t.isExpired ? "red-row" : t.isExpiringSoon ? "orange-row" : ""}">
      <td>${fmtDate(t.completedAt)}</td>
      <td>${t.trainingType}</td>
      <td>${t.title}</td>
      <td>${t.provider ?? "—"}</td>
      <td>${fmt(t.durationHours, 1)}</td>
      <td>${t.certificationNumber ?? "—"}</td>
      <td>${fmtDate(t.expiryDate)}</td>
    </tr>`).join("");

  const certAlert = data.certificationsExpired > 0
    ? `<div class="error-box">⚠ ${data.certificationsExpired} certification(s) expirée(s) — action requise.</div>`
    : data.certificationsExpiring90d > 0
      ? `<div class="warn-box">⚠ ${data.certificationsExpiring90d} certification(s) à renouveler dans les 90 jours.</div>`
      : "";

  const s8 = `
  <div class="section">
    <h2>8. FORMATION ET CERTIFICATIONS <span class="ref-badge">ISO 26000 §6.4.7</span> <span class="ref-badge">ESRS S1-13</span></h2>
    <div class="kpi-grid">
      ${kpiCard("Heures de formation",            data.trainingHoursTotal,         "heures")}
      ${kpiCard("Certifications actives",         data.certificationsActive,        "certifications")}
      ${kpiCard("À renouveler (90 j)",            data.certificationsExpiring90d,   "certifications")}
      ${kpiCard("Expirées",                       data.certificationsExpired,       "certifications")}
    </div>
    ${certAlert}
    ${data.trainingRecords.length > 0 ? `
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Intitulé</th><th>Organisme</th><th>Durée (h)</th><th>Certification</th><th>Expiration</th></tr></thead>
      <tbody>${trainRows}</tbody>
    </table>` : '<div class="info-box">Aucune formation enregistrée pour cette période.</div>'}
  </div>`;

  // ── SECTION 9 — Diversity ─────────────────────────────────────────────────
  const s9 = `
  <div class="section">
    <h2>9. PROFIL DIVERSITÉ <span class="ref-badge">ISO 26000 §6.3.10</span> <span class="ref-badge">ESRS S1-12</span></h2>
    <div class="info-box">Ces données individuelles sont destinées à être agrégées au niveau de la flotte pour produire les indicateurs CSRD de diversité.</div>
    <table style="width:60%">
      ${idRow("Genre", data.diversityGender)}
      ${idRow("Groupe d'âge", data.diversityAgeGroup)}
      ${idRow("Type de contrat", data.diversityContractType)}
      ${idRow("Catégories de permis", data.licenseCategories.join(", ") || null)}
    </table>
  </div>`;

  // ── SECTION 10 — OCR structured import table ──────────────────────────────
  const ocrRows = [
    ["transport_trips_count",                 "Nombre de trajets",                       data.totalTrips,                   "trajets",        "ISO 26000 §6.4",   "ESRS S1"],
    ["transport_empty_run_count",             "Trajets à vide",                          data.emptyRunCount,                "trajets",        "ISO 26000 §6.4",   "ESRS E1"],
    ["transport_empty_run_pct",               "Taux roulage à vide",                     data.emptyRunPct,                  "%",              "ISO 26000 §6.4",   "ESRS E1"],
    ["transport_total_distance_km",           "Distance totale",                         data.totalDistanceKm,              "km",             "ISO 26000 §6.4",   "ESRS S1"],
    ["transport_shift_hours_total",           "Heures de travail",                       data.totalShiftHours,              "heures",         "ISO 26000 §6.4.3", "ESRS S1-7"],
    ["transport_driving_hours_total",         "Heures de conduite",                      data.totalDrivingHours,            "heures",         "ISO 26000 §6.4.3", "ESRS S1-7"],
    ["transport_overtime_hours_total",        "Heures supplémentaires",                  data.totalOvertimeHours,           "heures",         "ISO 26000 §6.4.3", "ESRS S1-7"],
    ["transport_rest_compliance_pct",         "Conformité temps de repos",               data.restCompliancePct,            "%",              "EU Reg 561/2006",  "ESRS S1-7"],
    ["transport_fuel_total_liters",           "Carburant consommé",                      data.totalFuelLiters,              "L",              "ISO 26000 §6.5.5", "ESRS E5"],
    ["ghg_scope1",                            "Émissions GES Scope 1 transport",         data.ghgScope1Kgco2eq,             "kg CO2eq",       "ISO 26000 §6.5.5", "ESRS E1-6"],
    ["ghg_scope1_empty_runs",                 "GES trajets à vide",                      data.ghgScope1EmptyKgco2eq,        "kg CO2eq",       "ISO 26000 §6.5.5", "ESRS E1-6"],
    ["transport_ghg_intensity_kgco2_per_km",  "Intensité GES/km",                        data.ghgIntensityPerKm,            "kg CO2eq/km",    "ISO 26000 §6.5.5", "ESRS E1"],
    ["transport_ghg_intensity_per_tonne_km",  "Intensité GES/tonne-km",                  data.ghgIntensityPerTonneKm,       "kg CO2eq/t-km",  "ISO 26000 §6.5.5", "ESRS E1"],
    ["work_accidents_frequency_rate",         "Incidents de transport",                  data.incidentCount,                "incidents",      "ISO 26000 §6.4.6", "ESRS S1-14"],
    ["transport_accident_frequency_rate",     "Taux de fréquence accidents",             data.accidentFrequencyRate,        "acc/million h",  "ISO 26000 §6.4.6", "ESRS S1-14"],
    ["transport_work_stoppages_count",        "Arrêts de travail",                       data.workStoppageCount,            "arrêts",         "ISO 26000 §6.4.6", "ESRS S1"],
    ["transport_cargo_temp_avg_c",            "Température moy. cargaison",              data.avgCargoTempC,                "°C",             "ISO 26000 §6.7",   "ESRS G1"],
    ["transport_cargo_condition_breaches",    "Dépassements cargaison",                  data.cargoBreachCount,             "dépassements",   "ISO 26000 §6.7",   "ESRS G1"],
    ["vehicle_maintenance_count",             "Entretiens véhicule",                     data.maintenanceCount,             "interventions",  "ISO 26000 §6.5.4", "ESRS E5"],
    ["vehicle_regulatory_compliance_rate",    "Conformité réglementaire véhicule",       data.regulatoryComplianceRatePct,  "%",              "ISO 26000 §6.5.4", "ESRS G1"],
    ["employee_training_hours_avg",           "Heures de formation",                     data.trainingHoursTotal,           "heures",         "ISO 26000 §6.4.7", "ESRS S1-13"],
    ["driver_certifications_active",          "Certifications actives",                  data.certificationsActive,         "certifications", "ISO 26000 §6.4.7", "ESRS S1-13"],
    ["employee_gender",                       "Genre",                                   data.diversityGender,              "—",              "ISO 26000 §6.3.10","ESRS S1-12"],
    ["employee_age_group",                    "Groupe d'âge",                            data.diversityAgeGroup,            "—",              "ISO 26000 §6.3.10","ESRS S1-12"],
    ["employee_contract_type",                "Type de contrat",                         data.diversityContractType,        "—",              "ISO 26000 §6.3.10","ESRS S1"],
    // --- Driver behaviour (ESRS S1-14 — conduct & safe driving) ---
    ["driving_behaviour_avg_score",           "Score conduite moyen",                    data.behaviourAvgScore,            "/100",           "ISO 26000 §6.4.6", "ESRS S1-14"],
    ["driving_behaviour_trip_count",          "Trajets évalués",                         data.behaviourTripCount,           "trajets",        "ISO 26000 §6.4.6", "ESRS S1-14"],
    ["driving_behaviour_total_events",        "Événements de conduite",                  data.behaviourTotalEvents,         "événements",     "ISO 26000 §6.4.6", "ESRS S1-14"],
    ["driving_behaviour_critical_events",     "Événements critiques",                    data.behaviourCriticalEvents,      "événements",     "ISO 26000 §6.4.6", "ESRS S1-14"],
    ["driving_behaviour_worst_trip_score",    "Score trajet le plus bas",                data.behaviourWorstTripScore,      "/100",           "ISO 26000 §6.4.6", "ESRS S1-14"],
    ["driving_behaviour_best_trip_score",     "Score trajet le plus élevé",              data.behaviourBestTripScore,       "/100",           "ISO 26000 §6.4.6", "ESRS S1-14"],
  ] as const;

  const ocrTbody = ocrRows.map(([key, label, value, unit, iso, esrs]) => {
    const display = value === null || value === undefined ? "" : typeof value === "number" ? fmt(value, 3) : String(value);
    return `<tr><td>${key}</td><td>${label}</td><td style="text-align:right">${display}</td><td>${unit}</td><td>${esrs}</td><td>${`${fmtDate(data.periodStart)} – ${fmtDate(data.periodEnd)}`}</td></tr>`;
  }).join("");

  const s10 = `
  <div class="section page-break">
    <h2>10. DONNÉES STRUCTURÉES ESG — TABLE D'IMPORT</h2>
    <div class="info-box">
      Table normalisée pour import automatique (OCR/API) dans votre plateforme ESG/RSE.
      Chaque ligne = une observation. Les clés de référence (colonne 1) correspondent aux champs normalisés de la plateforme.
    </div>
    <table class="ocr-table">
      <thead>
        <tr>
          <th style="width:28%">Clé de référence ESG</th>
          <th style="width:24%">Libellé complet</th>
          <th style="width:9%;text-align:right">Valeur</th>
          <th style="width:10%">Unité</th>
          <th style="width:12%">Norme</th>
          <th style="width:17%">Période</th>
        </tr>
      </thead>
      <tbody>${ocrTbody}</tbody>
    </table>
    <div class="footer" style="margin-top:12px">
      Source : TruckNet. GES : facteur ADEME Base Carbone 2024 (${ghgFactor} kg CO₂eq/L ${data.fuelType ?? "diesel"}).
      Temps de travail : règlement EU 561/2006.
    </div>
  </div>`;

  // ── LEGAL DISCLAIMER ──────────────────────────────────────────────────────
  const disclaimer = `
  <div class="footer" style="margin-top:24px;font-size:8pt">
    Rapport généré automatiquement par TruckNet. Estimations GES selon ADEME Base Carbone 2024.
    Ne constitue pas une certification de conformité ESG/RSE.
    Destiné à alimenter le système de reporting ESG/RSE de l'entreprise conformément à la directive CSRD et au cadre ISO 26000.
  </div>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Rapport ESG — ${data.driverName} — ${data.periodStart} / ${data.periodEnd}</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="page">
    ${cover}
    ${s1}
    ${s2}
    ${s3}
    ${s4}
    ${s5}
    ${s6}
    ${s7}
    ${s8}
    ${s9}
    ${s10}
    ${disclaimer}
  </div>
</body>
</html>`;
}
