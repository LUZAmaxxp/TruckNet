"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, RefreshCw } from "lucide-react";
import { DriverProfileForm } from "@/components/admin/drivers/DriverProfileForm";
import { ShiftLogForm } from "@/components/admin/drivers/ShiftLogForm";
import { ShiftLogTable } from "@/components/admin/drivers/ShiftLogTable";
import { MaintenanceLogForm } from "@/components/admin/drivers/MaintenanceLogForm";
import { MaintenanceLogTable } from "@/components/admin/drivers/MaintenanceLogTable";
import { TrainingLogForm } from "@/components/admin/drivers/TrainingLogForm";
import { TrainingLogTable } from "@/components/admin/drivers/TrainingLogTable";
import { TripLogForm } from "@/components/admin/drivers/TripLogForm";
import { TripLogTable } from "@/components/admin/drivers/TripLogTable";
import { CertificationAlertBadge } from "@/components/admin/drivers/CertificationAlertBadge";
import { GenerateEsgReportModal } from "@/components/admin/drivers/GenerateEsgReportModal";
import { EsgReportKpiGrid } from "@/components/admin/drivers/EsgReportKpiGrid";
import { FleetEsgBenchmarkChart } from "@/components/admin/drivers/FleetEsgBenchmarkChart";

const TABS = ["Profile", "Shifts", "Trips", "Maintenance", "Training", "ESG Reports", "Benchmark"] as const;
type Tab = typeof TABS[number];

interface DriverProfile {
  id: string;
  name: string;
  email: string;
  licenseNumber?: string;
  licenseCategory?: string;
  licenseExpiryDate?: string;
  vehiclePlate?: string;
  contractType?: string;
  hireDate?: string;
  gender?: string;
  age?: number;
  nationalityIso?: string;
  homeBaseCity?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  hrEmail?: string;
  notes?: string;
}

export default function DriverDetailPage({ params }: { params: { driverId: string } }) {
  const { driverId } = params;
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("Profile");
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [shifts, setShifts] = useState<unknown[]>([]);
  const [trips, setTrips] = useState<unknown[]>([]);
  const [maintenance, setMaintenance] = useState<unknown[]>([]);
  const [training, setTraining] = useState<unknown[]>([]);
  const [reports, setReports] = useState<unknown[]>([]);
  const [fleetSummary, setFleetSummary] = useState<unknown[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [loadingMaint, setLoadingMaint] = useState(false);
  const [loadingTrain, setLoadingTrain] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [showAddShift, setShowAddShift] = useState(false);
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [showAddMaint, setShowAddMaint] = useState(false);
  const [showAddTrain, setShowAddTrain] = useState(false);
  const [showGenModal, setShowGenModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null
  );

  const fetchProfile = useCallback(async () => {
    const res = await fetch(`/api/drivers/${driverId}/profile`);
    if (res.ok) {
      const d = await res.json();
      setDriver({ id: driverId, name: d.driver?.name ?? "", email: d.driver?.email ?? "" });
      if (d.profile) setProfile(d.profile);
    }
  }, [driverId]);

  const fetchShifts = useCallback(async () => {
    setLoadingShifts(true);
    try {
      const res = await fetch(`/api/drivers/${driverId}/shifts`);
      if (res.ok) { const d = await res.json(); setShifts(d.shifts ?? []); }
    } finally { setLoadingShifts(false); }
  }, [driverId]);

  const fetchMaintenance = useCallback(async () => {
    setLoadingMaint(true);
    try {
      const res = await fetch(`/api/drivers/${driverId}/maintenance`);
      if (res.ok) { const d = await res.json(); setMaintenance(d.records ?? []); }
    } finally { setLoadingMaint(false); }
  }, [driverId]);

  const fetchTrips = useCallback(async () => {
    setLoadingTrips(true);
    try {
      const res = await fetch(`/api/drivers/${driverId}/trips`);
      if (res.ok) { const d = await res.json(); setTrips(d.records ?? []); }
    } finally { setLoadingTrips(false); }
  }, [driverId]);

  const fetchTraining = useCallback(async () => {
    setLoadingTrain(true);
    try {
      const res = await fetch(`/api/drivers/${driverId}/training`);
      if (res.ok) { const d = await res.json(); setTraining(d.records ?? []); }
    } finally { setLoadingTrain(false); }
  }, [driverId]);

  const fetchReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await fetch(`/api/drivers/esg-reports?driverId=${driverId}`);
      if (res.ok) { const d = await res.json(); setReports(d.reports ?? []); }
    } finally { setLoadingReports(false); }
  }, [driverId]);

  const fetchFleet = useCallback(async () => {
    const res = await fetch("/api/drivers/fleet-esg-summary");
    if (res.ok) { const d = await res.json(); setFleetSummary(d.summary ?? []); }
  }, []);

  useEffect(() => { void fetchProfile(); }, [fetchProfile]);
  useEffect(() => { if (tab === "Shifts") void fetchShifts(); }, [tab, fetchShifts]);
  useEffect(() => { if (tab === "Trips") void fetchTrips(); }, [tab, fetchTrips]);
  useEffect(() => { if (tab === "Maintenance") void fetchMaintenance(); }, [tab, fetchMaintenance]);
  useEffect(() => { if (tab === "Training") void fetchTraining(); }, [tab, fetchTraining]);
  useEffect(() => { if (tab === "ESG Reports") void fetchReports(); }, [tab, fetchReports]);
  useEffect(() => { if (tab === "Benchmark") { void fetchReports(); void fetchFleet(); } }, [tab, fetchReports, fetchFleet]);

  // Handle ?tab=training query param
  useEffect(() => {
    if (activeTab === "training") { setTab("Training"); setActiveTab(null); }
  }, [activeTab]);

  const tabLabel = (t: Tab) => t === "Training" ? (
    <span className="flex items-center gap-1">
      {t}
      <CertificationAlertBadge driverId={driverId} days={90} />
    </span>
  ) : t;

  const currentDriverFleet = (fleetSummary as Array<{ driverId: string }>).find((d) => d.driverId === driverId);
  const otherFleet = (fleetSummary as Array<{ driverId: string }>).filter((d) => d.driverId !== driverId);
  const latestReport = (reports as Array<{ status: string }>).find((r) => r.status === "ready");

  return (
    <div className="flex flex-col gap-4">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="rounded-[10px] border p-2" style={{ borderColor: "var(--hairline)", color: "var(--muted)" }}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="font-display text-[20px] font-bold" style={{ color: "var(--ink)" }}>
            {driver?.name ?? "Driver"}
          </h1>
          <p className="text-[12px]" style={{ color: "var(--muted)" }}>{driver?.email}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setShowGenModal(true)}
            className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[12px] font-semibold text-white"
            style={{ background: "var(--navy)" }}>
            <Plus className="h-3.5 w-3.5" />
            Generate ESG
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-[12px] p-1" style={{ background: "var(--base)" }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-[10px] px-3 py-1.5 text-[12px] font-medium transition-all ${tab === t ? "text-white shadow-sm" : ""}`}
            style={{ background: tab === t ? "var(--navy)" : "transparent", color: tab === t ? "white" : "var(--muted)" }}>
            {tabLabel(t)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-[14px] p-4" style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}>
        {tab === "Profile" && (
          <DriverProfileForm driverId={driverId} onSaved={fetchProfile} initial={profile as any ?? {}} />
        )}

        {tab === "Shifts" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[14px]" style={{ color: "var(--ink)" }}>Shift Log</h2>
              <div className="flex gap-2">
                <button onClick={fetchShifts} className="rounded-[8px] border p-1.5" style={{ borderColor: "var(--hairline)", color: "var(--muted)" }}>
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button onClick={() => setShowAddShift((s) => !s)}
                  className="flex items-center gap-1 rounded-[8px] px-3 py-1.5 text-[12px] font-medium text-white"
                  style={{ background: "var(--navy)" }}>
                  <Plus className="h-3.5 w-3.5" />
                  {showAddShift ? "Cancel" : "New Shift"}
                </button>
              </div>
            </div>
            {showAddShift && (
              <div className="rounded-[12px] p-3" style={{ background: "var(--base)", border: "1px solid var(--hairline)" }}>
                <ShiftLogForm driverId={driverId} onCreated={() => { setShowAddShift(false); void fetchShifts(); }} />
              </div>
            )}
            <ShiftLogTable driverId={driverId} shifts={shifts as any[]} loading={loadingShifts} onRefresh={fetchShifts} />
          </div>
        )}

        {tab === "Trips" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[14px]" style={{ color: "var(--ink)" }}>Trip Log</h2>
              <div className="flex gap-2">
                <button onClick={fetchTrips} className="rounded-[8px] border p-1.5" style={{ borderColor: "var(--hairline)", color: "var(--muted)" }}>
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button onClick={() => setShowAddTrip((s) => !s)}
                  className="flex items-center gap-1 rounded-[8px] px-3 py-1.5 text-[12px] font-medium text-white"
                  style={{ background: "var(--navy)" }}>
                  <Plus className="h-3.5 w-3.5" />
                  {showAddTrip ? "Cancel" : "Log Trip"}
                </button>
              </div>
            </div>
            {showAddTrip && (
              <div className="rounded-[12px] p-3" style={{ background: "var(--base)", border: "1px solid var(--hairline)" }}>
                <TripLogForm driverId={driverId} onCreated={() => { setShowAddTrip(false); void fetchTrips(); }} />
              </div>
            )}
            <TripLogTable driverId={driverId} trips={trips as any[]} onDeleted={fetchTrips} />
            {!loadingTrips && trips.length > 0 && (
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                CO₂ = fuel litres × ADEME 2024 factor per fuel type (diesel 2.65, petrol 2.37, LPG 1.63, CNG 2.30 kg CO₂eq/L)
              </p>
            )}
          </div>
        )}

        {tab === "Maintenance" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[14px]" style={{ color: "var(--ink)" }}>Maintenance Log</h2>
              <button onClick={() => setShowAddMaint((s) => !s)}
                className="flex items-center gap-1 rounded-[8px] px-3 py-1.5 text-[12px] font-medium text-white"
                style={{ background: "var(--navy)" }}>
                <Plus className="h-3.5 w-3.5" />
                {showAddMaint ? "Cancel" : "New Log"}
              </button>
            </div>
            {showAddMaint && (
              <div className="rounded-[12px] p-3" style={{ background: "var(--base)", border: "1px solid var(--hairline)" }}>
                <MaintenanceLogForm driverId={driverId} onCreated={() => { setShowAddMaint(false); void fetchMaintenance(); }} />
              </div>
            )}
            <MaintenanceLogTable records={maintenance as any[]} loading={loadingMaint} />
          </div>
        )}

        {tab === "Training" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[14px]" style={{ color: "var(--ink)" }}>Training Records</h2>
              <button onClick={() => setShowAddTrain((s) => !s)}
                className="flex items-center gap-1 rounded-[8px] px-3 py-1.5 text-[12px] font-medium text-white"
                style={{ background: "var(--navy)" }}>
                <Plus className="h-3.5 w-3.5" />
                {showAddTrain ? "Cancel" : "Add Record"}
              </button>
            </div>
            {showAddTrain && (
              <div className="rounded-[12px] p-3" style={{ background: "var(--base)", border: "1px solid var(--hairline)" }}>
                <TrainingLogForm driverId={driverId} onCreated={() => { setShowAddTrain(false); void fetchTraining(); }} />
              </div>
            )}
            <TrainingLogTable records={training as any[]} loading={loadingTrain} />
          </div>
        )}

        {tab === "ESG Reports" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[14px]" style={{ color: "var(--ink)" }}>ESG Reports</h2>
              <button onClick={fetchReports} className="rounded-[8px] border p-1.5" style={{ borderColor: "var(--hairline)", color: "var(--muted)" }}>
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            {(reports as any[]).length === 0 && !loadingReports && (
              <p className="text-center py-6 text-[13px]" style={{ color: "var(--muted)" }}>No reports generated yet.</p>
            )}
            <div className="flex flex-col gap-3">
              {(reports as any[]).map((r: any) => (
                <div key={r.id} className="rounded-[12px] p-4" style={{ border: "1px solid var(--hairline)" }}>
                  <EsgReportKpiGrid report={r} onRefresh={fetchReports} />
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "Benchmark" && (
          <div className="flex flex-col gap-4">
            <h2 className="font-semibold text-[14px]" style={{ color: "var(--ink)" }}>Fleet Benchmark</h2>
            {currentDriverFleet ? (
              <FleetEsgBenchmarkChart
                driver={currentDriverFleet as any}
                fleet={otherFleet as any[]}
              />
            ) : (
              <p className="text-center py-6 text-[13px]" style={{ color: "var(--muted)" }}>
                No ESG data available yet for benchmarking.
              </p>
            )}
          </div>
        )}
      </div>

      {showGenModal && driver && (
        <GenerateEsgReportModal
          drivers={[{ id: driver.id, name: driver.name }]}
          onClose={() => setShowGenModal(false)}
          onCreated={() => { setTab("ESG Reports"); void fetchReports(); }}
        />
      )}
    </div>
  );
}
