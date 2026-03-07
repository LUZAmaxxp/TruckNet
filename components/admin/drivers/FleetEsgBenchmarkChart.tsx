"use client";

import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend, Tooltip } from "recharts";

interface FleetDriver {
  driverName: string;
  totalGhgKgco2eq: number | null;
  ghgIntensityPerKm: number | null;
  totalDistanceKm: number | null;
  emptyRunPct: number | null;
  trainingHours: number | null;
  incidentCount: number | null;
}

interface Props {
  /** The driver being benchmarked (highlighted in orange) */
  driver: FleetDriver;
  /** All other fleet drivers for averaging */
  fleet: FleetDriver[];
}

// Normalise to 0–100 scale for each axis (higher = better)
function norm(val: number | null, min: number, max: number, invert = false): number {
  if (val == null || max === min) return 50;
  const n = ((val - min) / (max - min)) * 100;
  return invert ? 100 - n : n;
}

function avg(arr: (number | null)[]): number {
  const valid = arr.filter((v): v is number => v != null);
  return valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : 0;
}

export function FleetEsgBenchmarkChart({ driver, fleet }: Props) {
  const all = [driver, ...fleet];

  const ghgVals = all.map((d) => d.ghgIntensityPerKm);
  const emptyVals = all.map((d) => d.emptyRunPct);
  const trainingVals = all.map((d) => d.trainingHours);
  const distVals = all.map((d) => d.totalDistanceKm);
  const incidentVals = all.map((d) => d.incidentCount);

  const minmax = (arr: (number | null)[]): [number, number] => {
    const v = arr.filter((x): x is number => x != null);
    return v.length ? [Math.min(...v), Math.max(...v)] : [0, 1];
  };

  const [ghgMin, ghgMax]         = minmax(ghgVals);
  const [emptyMin, emptyMax]     = minmax(emptyVals);
  const [trainMin, trainMax]     = minmax(trainingVals);
  const [distMin, distMax]       = minmax(distVals);
  const [incMin, incMax]         = minmax(incidentVals);

  const fleetAvg = {
    ghgIntensityPerKm: avg(fleet.map((d) => d.ghgIntensityPerKm)),
    emptyRunPct:       avg(fleet.map((d) => d.emptyRunPct)),
    trainingHours:     avg(fleet.map((d) => d.trainingHours)),
    totalDistanceKm:   avg(fleet.map((d) => d.totalDistanceKm)),
    incidentCount:     avg(fleet.map((d) => d.incidentCount)),
  };

  const toRadar = (d: { ghgIntensityPerKm: number | null; emptyRunPct: number | null; trainingHours: number | null; totalDistanceKm: number | null; incidentCount: number | null }) => [
    { axis: "GHG Intensity",   score: norm(d.ghgIntensityPerKm, ghgMin, ghgMax, true)  },
    { axis: "Empty Run %",     score: norm(d.emptyRunPct,      emptyMin, emptyMax, true) },
    { axis: "Training Hours",  score: norm(d.trainingHours,    trainMin, trainMax)       },
    { axis: "Distance",        score: norm(d.totalDistanceKm,  distMin, distMax)         },
    { axis: "Safety",          score: norm(d.incidentCount,    incMin, incMax, true)     },
  ];

  const driverData = toRadar(driver);
  const avgData    = toRadar(fleetAvg);

  // Recharts radar needs single array per subject, so merge by axis
  const chartData = driverData.map((d, i) => ({
    axis:   d.axis,
    Driver: Math.round(d.score),
    Fleet:  Math.round(avgData[i].score),
  }));

  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} outerRadius={100}>
          <PolarGrid />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
          <Radar name={driver.driverName} dataKey="Driver" stroke="#1c3a5e" fill="#1c3a5e" fillOpacity={0.25} />
          <Radar name="Fleet avg"         dataKey="Fleet"  stroke="#f97316" fill="#f97316" fillOpacity={0.15} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Tooltip formatter={(v: number) => `${v} / 100`} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
