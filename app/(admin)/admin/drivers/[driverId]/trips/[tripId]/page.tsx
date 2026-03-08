"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Clock } from "lucide-react";
import Link                            from "next/link";
import { useSocket }                   from "@/hooks/useSocket";
import { BehaviourReportCard, type BehaviourReportData, type BehaviourEventRow }
  from "@/components/admin/behaviour/BehaviourReportCard";
import type { BehaviourReportReadyPayload } from "@/sockets/types";

// ── Shape of the API response ─────────────────────────────────────────────────

interface TripInfo {
  id:               string;
  driverId:         string;
  vehiclePlate:     string;
  originLabel:      string | null;
  destinationLabel: string | null;
  distanceKm:       number | null;
  durationMinutes:  number | null;
  startedAt:        string | null;
  completedAt:      string | null;
  status:           string;
}

interface PageData {
  trip:   TripInfo;
  report: BehaviourReportData | null;
  events: BehaviourEventRow[];
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TripDetailPage({
  params,
}: {
  params: { driverId: string; tripId: string };
}) {
  const { driverId, tripId } = params;
  const [data,    setData]    = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const { on } = useSocket();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/drivers/${driverId}/trips/${tripId}/behaviour`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { trip: TripInfo; report: BehaviourReportData | null; events: BehaviourEventRow[] };
      setData({
        trip:   json.trip,
        report: json.report ?? null,
        events: json.events ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [driverId, tripId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Auto-refresh when report generation completes
  useEffect(() => {
    const unsub = on("behaviour_report_ready", (payload: BehaviourReportReadyPayload) => {
      if (payload.tripId === tripId) {
        void fetchData();
      }
    });
    return unsub;
  }, [on, tripId, fetchData]);

  const handleReview = async (note: string) => {
    const res = await fetch(
      `/api/drivers/${driverId}/trips/${tripId}/behaviour`,
      {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ adminReviewed: true, reviewNote: note }),
      }
    );
    if (!res.ok) throw new Error("Review failed");
    const json = await res.json() as { report: BehaviourReportData };
    setData((prev) => prev ? { ...prev, report: json.report } : prev);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-[14px] text-red-500">{error ?? "Données non disponibles"}</p>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[13px] hover:bg-gray-50 transition-colors"
          style={{ borderColor: "var(--hairline)" }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Réessayer
        </button>
      </div>
    );
  }

  const { trip, report, events } = data;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href={`/admin/drivers/${driverId}`}
          className="mt-0.5 rounded-[8px] p-1.5 hover:bg-gray-100 transition-colors"
          style={{ color: "var(--ink-secondary)" }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1
            className="font-display text-[20px] font-bold tracking-[-0.04em]"
            style={{ color: "var(--ink)" }}
          >
            Détail du trajet
          </h1>
          <p className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>
            {trip.originLabel ?? "Départ inconnu"} → {trip.destinationLabel ?? "Arrivée inconnue"}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="rounded-[8px] border p-1.5 hover:bg-gray-50 transition-colors"
          style={{ borderColor: "var(--hairline)", color: "var(--ink-secondary)" }}
          title="Actualiser"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Trip meta card */}
      <div
        className="grid grid-cols-2 gap-3 rounded-[14px] px-5 py-4 sm:grid-cols-4"
        style={{
          background: "var(--surface)",
          border:     "1px solid var(--hairline)",
          boxShadow:  "var(--shadow-sm)",
        }}
      >
        <MetaItem label="Véhicule"    value={trip.vehiclePlate} />
        <MetaItem label="Distance"    value={trip.distanceKm ? `${trip.distanceKm.toFixed(1)} km` : "—"} />
        <MetaItem
          label="Départ"
          value={trip.startedAt ? new Date(trip.startedAt).toLocaleString("fr-FR") : "—"}
        />
        <MetaItem
          label="Arrivée"
          value={trip.completedAt ? new Date(trip.completedAt).toLocaleString("fr-FR") : (
            <span className="flex items-center gap-1 text-amber-600">
              <Clock className="h-3.5 w-3.5" /> En cours
            </span>
          )}
        />
      </div>

      {/* Report section */}
      {report?.status === "generating" && (
        <div
          className="flex items-center gap-3 rounded-[12px] px-4 py-3"
          style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}
        >
          <div className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
          <p className="text-[13px]" style={{ color: "var(--ink-secondary)" }}>
            Génération du rapport en cours…
          </p>
        </div>
      )}

      {report?.status === "failed" && (
        <div
          className="rounded-[12px] px-4 py-3 text-[13px] text-red-600"
          style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
        >
          La génération du rapport a échoué. Vérifiez les logs du worker.
        </div>
      )}

      {!report && trip.status !== "completed" && (
        <div
          className="rounded-[12px] px-4 py-3 text-[13px]"
          style={{ background: "var(--surface)", border: "1px solid var(--hairline)", color: "var(--ink-secondary)" }}
        >
          Le rapport sera généré automatiquement à la fin du trajet.
        </div>
      )}

      {!report && trip.status === "completed" && (
        <div
          className="rounded-[12px] px-4 py-3 text-[13px]"
          style={{ background: "var(--surface)", border: "1px solid var(--hairline)", color: "var(--ink-secondary)" }}
        >
          Aucun rapport disponible pour ce trajet.
        </div>
      )}

      {report && report.status === "ready" && (
        <BehaviourReportCard
          report={report}
          events={events}
          tripStart={trip.startedAt}
          isAdmin
          onReview={handleReview}
        />
      )}
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--ink-secondary)" }}>{label}</p>
      <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{value}</p>
    </div>
  );
}
