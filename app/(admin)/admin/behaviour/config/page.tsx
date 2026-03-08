"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import Link  from "next/link";
import { toast } from "sonner";

interface ScoringConfig {
  harshBrakingThresholdG:      number;
  harshAccelerationThresholdG: number;
  swerveThresholdG:            number;
  speedViolationExcessKmh:     number;
  idleExcessMinutes:           number;
  earDrowsyThreshold:          number;
  earMicrosleepThreshold:      number;
  drowsyDurationSeconds:       number;
  microsleepDurationSeconds:   number;
  headAngleDistractionDeg:     number;
  distractionDurationSeconds:  number;
  weightSpeed:                 number;
  weightDrivingStyle:          number;
  weightFatigue:               number;
  weightIdle:                  number;
  weightSos:                   number;
}

const DEFAULT_CONFIG: ScoringConfig = {
  harshBrakingThresholdG:      0.4,
  harshAccelerationThresholdG: 0.35,
  swerveThresholdG:            0.3,
  speedViolationExcessKmh:     10,
  idleExcessMinutes:           10,
  earDrowsyThreshold:          0.25,
  earMicrosleepThreshold:      0.20,
  drowsyDurationSeconds:       2.0,
  microsleepDurationSeconds:   3.0,
  headAngleDistractionDeg:     30,
  distractionDurationSeconds:  3.0,
  weightSpeed:                 25,
  weightDrivingStyle:          20,
  weightFatigue:               30,
  weightIdle:                  10,
  weightSos:                   15,
};

interface SliderFieldProps {
  label:     string;
  hint?:     string;
  value:     number;
  min:       number;
  max:       number;
  step?:     number;
  onChange:  (v: number) => void;
}

function SliderField({ label, hint, value, min, max, step = 0.01, onChange }: SliderFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
          {label}
          {hint && <span className="ml-1 text-[11px]" style={{ color: "var(--ink-secondary)" }}>({hint})</span>}
        </label>
        <span className="w-14 text-right text-[13px] tabular-nums font-semibold" style={{ color: "var(--ink)" }}>
          {value.toFixed(step < 1 ? 2 : 0)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-600"
      />
    </div>
  );
}

/**
 * /admin/behaviour/config — Configure scoring weights & detection thresholds.
 */
export default function BehaviourConfigPage() {
  const [config,  setConfig]  = useState<ScoringConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    fetch("/api/admin/behaviour/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.config) setConfig({ ...DEFAULT_CONFIG, ...d.config });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const update = (field: keyof ScoringConfig) => (v: number) =>
    setConfig((prev) => ({ ...prev, [field]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        harsh_braking_threshold_g:      config.harshBrakingThresholdG,
        harsh_acceleration_threshold_g: config.harshAccelerationThresholdG,
        swerve_threshold_g:             config.swerveThresholdG,
        speed_violation_excess_kmh:     config.speedViolationExcessKmh,
        idle_excess_minutes:            config.idleExcessMinutes,
        ear_drowsy_threshold:           config.earDrowsyThreshold,
        ear_microsleep_threshold:       config.earMicrosleepThreshold,
        drowsy_duration_seconds:        config.drowsyDurationSeconds,
        microsleep_duration_seconds:    config.microsleepDurationSeconds,
        head_angle_distraction_deg:     config.headAngleDistractionDeg,
        distraction_duration_seconds:   config.distractionDurationSeconds,
        weight_speed:                   config.weightSpeed,
        weight_driving_style:           config.weightDrivingStyle,
        weight_fatigue:                 config.weightFatigue,
        weight_idle:                    config.weightIdle,
        weight_sos:                     config.weightSos,
      };
      const res = await fetch("/api/admin/behaviour/config", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Configuration mise à jour");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/behaviour"
          className="rounded-[8px] p-1.5 hover:bg-gray-100 transition-colors"
          style={{ color: "var(--ink-secondary)" }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1
          className="font-display text-[20px] font-bold tracking-[-0.04em]"
          style={{ color: "var(--ink)" }}
        >
          Configuration du scoring
        </h1>
      </div>

      {/* Score weights section */}
      <section
        className="rounded-[14px] p-5 flex flex-col gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}
      >
        <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-secondary)" }}>
          Pondérations du score (total recommandé = 100)
        </h2>
        <p className="text-[11px]" style={{ color: "var(--ink-secondary)" }}>
          Total actuel: {config.weightSpeed + config.weightDrivingStyle + config.weightFatigue + config.weightIdle + config.weightSos}
        </p>
        <SliderField label="Vitesse"       value={config.weightSpeed}        min={0} max={50} step={1} onChange={update("weightSpeed")}        />
        <SliderField label="Style conduite" value={config.weightDrivingStyle} min={0} max={50} step={1} onChange={update("weightDrivingStyle")} />
        <SliderField label="Fatigue"        value={config.weightFatigue}      min={0} max={50} step={1} onChange={update("weightFatigue")}      />
        <SliderField label="Ralenti"        value={config.weightIdle}         min={0} max={30} step={1} onChange={update("weightIdle")}         />
        <SliderField label="SOS"            value={config.weightSos}          min={0} max={30} step={1} onChange={update("weightSos")}          />
      </section>

      {/* ESP32 thresholds */}
      <section
        className="rounded-[14px] p-5 flex flex-col gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}
      >
        <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-secondary)" }}>
          Seuils ESP32 (accéléromètre)
        </h2>
        <SliderField label="Freinage brusque (g)"     value={config.harshBrakingThresholdG}      min={0.1} max={1} onChange={update("harshBrakingThresholdG")}      />
        <SliderField label="Accél. brusque (g)"       value={config.harshAccelerationThresholdG} min={0.1} max={1} onChange={update("harshAccelerationThresholdG")} />
        <SliderField label="Embardée (g)"             value={config.swerveThresholdG}            min={0.1} max={1} onChange={update("swerveThresholdG")}            />
      </section>

      {/* GPS thresholds */}
      <section
        className="rounded-[14px] p-5 flex flex-col gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}
      >
        <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-secondary)" }}>
          Seuils GPS
        </h2>
        <SliderField label="Marge de vitesse (km/h)"  value={config.speedViolationExcessKmh} min={0} max={30} step={1} onChange={update("speedViolationExcessKmh")} />
        <SliderField label="Ralenti excessif (min)"   value={config.idleExcessMinutes}       min={1} max={30} step={1} onChange={update("idleExcessMinutes")}       />
      </section>

      {/* AI Camera thresholds */}
      <section
        className="rounded-[14px] p-5 flex flex-col gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}
      >
        <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-secondary)" }}>
          Seuils caméra IA (somnolence)
        </h2>
        <SliderField label="Seuil somnolence (EAR)"    value={config.earDrowsyThreshold}         min={0.1} max={0.5} onChange={update("earDrowsyThreshold")}         />
        <SliderField label="Seuil microsommeil (EAR)"  value={config.earMicrosleepThreshold}     min={0.05} max={0.4} onChange={update("earMicrosleepThreshold")}    />
        <SliderField label="Durée somnolence (s)"      value={config.drowsyDurationSeconds}      min={0.5} max={10} step={0.5} onChange={update("drowsyDurationSeconds")}    />
        <SliderField label="Durée microsommeil (s)"    value={config.microsleepDurationSeconds}  min={0.5} max={10} step={0.5} onChange={update("microsleepDurationSeconds")} />
        <SliderField label="Angle tête distraction (°)" value={config.headAngleDistractionDeg}  min={10} max={60} step={1} onChange={update("headAngleDistractionDeg")}  />
        <SliderField label="Durée distraction (s)"     value={config.distractionDurationSeconds} min={0.5} max={10} step={0.5} onChange={update("distractionDurationSeconds")} />
      </section>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center justify-center gap-2 rounded-[10px] bg-blue-600 px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        <Save className="h-4 w-4" />
        {saving ? "Enregistrement…" : "Sauvegarder"}
      </button>
    </div>
  );
}
