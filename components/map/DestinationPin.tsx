"use client";

// Must be rendered inside a react-leaflet <MapContainer>
import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

interface DestinationPinProps {
  lat: number;
  lng: number;
  label?: string;
  /** Callback when user wants to clear/cancel this route */
  onClear?: () => void;
}

function makeDestinationIcon() {
  // Terra-colored flag pin
  const svgHtml = `
    <div style="
      display:flex;
      align-items:center;
      justify-content:center;
      width:32px;height:32px;
      background:var(--terra, #c07850);
      border:2.5px solid #fff;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 3px 8px rgba(0,0,0,0.35);
    ">
      <span style="
        display:block;
        width:10px;height:10px;
        background:#fff;
        border-radius:50%;
        transform:rotate(45deg);
      "></span>
    </div>
  `;
  return L.divIcon({
    html: svgHtml,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -36],
  });
}

/**
 * DestinationPin — terra-colored teardrop marker for the route destination.
 * Renders a popup with the destination label and an optional "Clear route" button.
 */
export function DestinationPin({ lat, lng, label, onClear }: DestinationPinProps) {
  const icon = useMemo(() => makeDestinationIcon(), []);

  return (
    <Marker position={[lat, lng]} icon={icon}>
      <Popup minWidth={180}>
        <div style={{ fontFamily: "inherit" }}>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: label ? 6 : 0 }}>
            🏁 Destination
          </p>
          {label && (
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: onClear ? 8 : 0, lineHeight: 1.4 }}>
              {label}
            </p>
          )}
          {onClear && (
            <button
              onClick={onClear}
              style={{
                width: "100%",
                padding: "6px 10px",
                background: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Clear Route
            </button>
          )}
        </div>
      </Popup>
    </Marker>
  );
}
