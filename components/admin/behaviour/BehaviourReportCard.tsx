"use client";

import { useState } from "react";
import { DriveScoreGauge }    from "./DriveScoreGauge";
import { ScoreBreakdownBar }  from "./ScoreBreakdownBar";
import { EventTimeline }      from "./EventTimeline";
import { EventTypeBadge }     from "./EventTypeBadge";
import { cn }                 from "@/lib/utils";

// ── Types (minimal — mirrors API response shape) ──────────────────────────────

export interface BehaviourEventRow {
  id:          string;
  eventType:   string;
  severity:    "low" | "medium" | "high" | "critical";
  source:      "gps" | "esp32" | "camera";
  occurredAt:  string;
  durationSec?: number | null;
  valueJson?:   Record<string, unknown> | null;
}

export interface BehaviourReportData {
  id:             string;
  tripId:         string;
  driverId:       string;
  globalScore:    number;
  speedScore:     number;
  styleScore:     number;
  fatigueScore:   number;
  idleScore:      number;
  sosScore:       number;
  totalEvents:    number;
  criticalEvents: number;
  highEvents:     number;
  totalIdleSec:   number;
  adminReviewed:  boolean;
  reviewNote:     string | null;
  reviewedAt:     string | null;
  generatedAt:    string;
  status:         string;
}

interface BehaviourReportCardProps {
  report:     BehaviourReportData;
  events:     BehaviourEventRow[];
  tripStart?: string | null;
  isAdmin?:   boolean;
  onReview?:  (note: string) => Promise<void>;
  className?: string;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function toEventPoints(events: BehaviourEventRow[], tripStart?: string | null) {
  const base = tripStart ? new Date(tripStart).getTime() : null;
  return events.map((e) => ({
    minuteOffset: base
      ? (new Date(e.occurredAt).getTime() - base) / 60_000
      : 0,
    severity:  e.severity,
    eventType: e.eventType,
    occurredAt: e.occurredAt,
  }));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BehaviourReportCard({
  report,
  events,
  tripStart,
  isAdmin = false,
  onReview,
  className,
}: BehaviourReportCardProps) {
  const [note,    setNote]    = useState(report.reviewNote ?? "");
  const [saving,  setSaving]  = useState(false);
  const [reviewed, setReviewed] = useState(report.adminReviewed);

  const handleMarkReviewed = async () => {
    if (!onReview) return;
    setSaving(true);
    try {
      await onReview(note);
      setReviewed(true);
    } finally {
      setSaving(false);
    }
  };

  const points = toEventPoints(events, tripStart);

  return (
    <div
      className={cn(
        "rounded-[14px] overflow-hidden",
        className
      )}
      style={{
        background: "var(--surface)",
        border:     "1px solid var(--hairline)",
        boxShadow:  "var(--shadow-sm)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--hairline)" }}
      >
        <div>
          <h3
            className="font-display text-[15px] font-bold tracking-[-0.02em]"
            style={{ color: "var(--ink)" }}
          >
            Rapport de comportement
          </h3>
          <p className="text-[12px]" style={{ color: "var(--ink-secondary)" }}>
            Généré le {new Date(report.generatedAt).toLocaleString("fr-FR")}
          </p>
        </div>
        {reviewed && (
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-700">
            ✓ Vérifié
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-5 grid grid-cols-1 gap-6 md:grid-cols-2">

        {/* Left — Gauge + stats */}
        <div className="flex flex-col items-center gap-4">
          <DriveScoreGauge
            score={report.globalScore}
            size={140}
            label="Score global"
          />

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2 w-full text-center">
            <Stat label="Événements" value={report.totalEvents} />
            <Stat label="Critiques"  value={report.criticalEvents} accent="#ef4444" />
            <Stat label="Élevés"     value={report.highEvents}     accent="#f97316" />
          </div>

          {report.totalIdleSec > 0 && (
            <p className="text-[12px]" style={{ color: "var(--ink-secondary)" }}>
              Temps de ralenti total :{" "}
              <strong>{Math.round(report.totalIdleSec / 60)} min</strong>
            </p>
          )}
        </div>

        {/* Right — Score breakdown */}
        <div className="flex flex-col gap-2">
          <p
            className="text-[12px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--ink-secondary)" }}
          >
            Détail du score
          </p>
          <ScoreBreakdownBar
            speedScore={report.speedScore}
            styleScore={report.styleScore}
            fatigueScore={report.fatigueScore}
            idleScore={report.idleScore}
            sosScore={report.sosScore}
          />
        </div>
      </div>

      {/* Timeline */}
      {events.length > 0 && (
        <div
          className="px-5 pb-4"
          style={{ borderTop: "1px solid var(--hairline)" }}
        >
          <p
            className="pt-4 pb-2 text-[12px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--ink-secondary)" }}
          >
            Chronologie des événements
          </p>
          <EventTimeline events={points} tripStart={tripStart} />
        </div>
      )}

      {/* Event type badges summary */}
      {events.length > 0 && (
        <div
          className="px-5 pb-4 flex flex-wrap gap-1.5"
          style={{ borderTop: "1px solid var(--hairline)" }}
        >
          <p
            className="w-full pt-4 pb-1 text-[12px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--ink-secondary)" }}
          >
            Types d&apos;événements
          </p>
          {Array.from(new Set(events.map((e) => e.eventType))).map((type) => {
            const worst = events
              .filter((e) => e.eventType === type)
              .reduce(
                (acc, e) => {
                  const order = { low: 0, medium: 1, high: 2, critical: 3 };
                  return order[e.severity] > order[acc] ? e.severity : acc;
                },
                "low" as BehaviourEventRow["severity"]
              );
            return (
              <EventTypeBadge
                key={type}
                type={type}
                severity={worst}
              />
            );
          })}
        </div>
      )}

      {/* Admin review section */}
      {isAdmin && !reviewed && (
        <div
          className="px-5 py-4"
          style={{ borderTop: "1px solid var(--hairline)", background: "var(--surface-raised, #fafafa)" }}
        >
          <p
            className="mb-2 text-[12px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--ink-secondary)" }}
          >
            Note de l&apos;administrateur
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Observations ou mesures prises…"
            className="w-full resize-none rounded-[8px] px-3 py-2 text-[13px] outline-none transition-shadow focus:ring-2 focus:ring-blue-400"
            style={{
              background: "var(--surface)",
              border:     "1px solid var(--hairline)",
              color:      "var(--ink)",
            }}
          />
          <button
            onClick={handleMarkReviewed}
            disabled={saving}
            className="mt-2 rounded-[8px] bg-blue-600 px-4 py-1.5 text-[13px] font-semibold text-white disabled:opacity-60 hover:bg-blue-700 transition-colors"
          >
            {saving ? "Enregistrement…" : "Marquer comme vérifié"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  accent,
}: {
  label:   string;
  value:   number;
  accent?: string;
}) {
  return (
    <div className="rounded-[8px] px-2 py-1.5" style={{ background: "var(--surface-raised, #f9fafb)", border: "1px solid var(--hairline)" }}>
      <p className="text-[18px] font-bold leading-none" style={{ color: accent ?? "var(--ink)" }}>
        {value}
      </p>
      <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-secondary)" }}>
        {label}
      </p>
    </div>
  );
}
