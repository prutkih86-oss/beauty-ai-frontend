import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Custom purple teardrop marker matching the Beauty AI design
// (white dot in the center is added purely via CSS ::after on .beauty-ai-pin)
const purpleIcon = L.divIcon({
  className: "beauty-ai-marker",
  html: `<div class="beauty-ai-pin"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -26],
});

type Salon = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

// Sample salons around Pechersk / central Kyiv — replace with real data from your API
const salons: Salon[] = [
  { id: "1", name: "Luna Beauty House", lat: 50.4380, lng: 30.5325 },
  { id: "2", name: "Nails Studio", lat: 50.4412, lng: 30.5401 },
  { id: "3", name: "Beauty Room", lat: 50.4465, lng: 30.5502 },
  { id: "4", name: "Mon Chéri Salon", lat: 50.4501, lng: 30.5218 },
  { id: "5", name: "Queen Studio", lat: 50.4340, lng: 30.5260 },
  { id: "6", name: "Shine Beauty", lat: 50.4325, lng: 30.5470 },
  { id: "7", name: "Beauty Point", lat: 50.4450, lng: 30.5350 },
];

const KYIV_CENTER: [number, number] = [50.4412, 30.5390];

type MapSectionProps = {
  lang: "ua" | "en";
};

export default function MapSection({ lang }: MapSectionProps) {
  return (
    <div className="map-section">
      <div className="map-canvas">
        <div className="map-district">
          <span className="label">
            {lang === "ua" ? "Ваш район" : "Your district"}
          </span>

          <span className="value">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a855f7"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>

            {lang === "ua" ? "Печерський" : "Pechersk"}
          </span>
        </div>

        <MapContainer
          center={KYIV_CENTER}
          zoom={13}
          scrollWheelZoom={true}
          zoomControl={false}
          style={{
            height: "100%",
            width: "100%",
            borderRadius: "12px",
          }}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          {salons.map((salon) => (
            <Marker
              key={salon.id}
              position={[salon.lat, salon.lng]}
              icon={purpleIcon}
            >
              <Popup>{salon.name}</Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}