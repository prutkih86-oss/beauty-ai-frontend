import React, { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

const KYIV_SALONS: Salon[] = [
  { id: "1", name: "Luna Beauty House", lat: 50.4380, lng: 30.5325 },
  { id: "2", name: "Nails Studio", lat: 50.4412, lng: 30.5401 },
  { id: "3", name: "Beauty Room", lat: 50.4465, lng: 30.5502 },
  { id: "4", name: "Mon Chéri Salon", lat: 50.4501, lng: 30.5218 },
  { id: "5", name: "Queen Studio", lat: 50.4340, lng: 30.5260 },
  { id: "6", name: "Shine Beauty", lat: 50.4325, lng: 30.5470 },
  { id: "7", name: "Beauty Point", lat: 50.4450, lng: 30.5350 },
];

// Ті самі декоративні pin-и, але розкидані по різних районах Львова —
// без хоч одного київського значення координат.
const LVIV_SALONS: Salon[] = [
  { id: "1", name: "Luna Beauty House", lat: 49.8419, lng: 24.0315 },
  { id: "2", name: "Nails Studio", lat: 49.8452, lng: 24.0389 },
  { id: "3", name: "Beauty Room", lat: 49.8290, lng: 24.0668 },
  { id: "4", name: "Mon Chéri Salon", lat: 49.8598, lng: 24.0112 },
  { id: "5", name: "Queen Studio", lat: 49.8108, lng: 24.0148 },
  { id: "6", name: "Shine Beauty", lat: 49.7958, lng: 24.0451 },
  { id: "7", name: "Beauty Point", lat: 49.8424, lng: 23.9958 },
];

const KYIV_CENTER: [number, number] = [50.4412, 30.5390];
// Demo current-user position around Pechersk. Later this can come from geolocation/API.
const USER_LOCATION: [number, number] = [50.4395, 30.5355];

type CityName = "Київ" | "Львів";

// Стартова/дефолтна точка для Львова — приблизно площа Ринок. Використовується
// і як center мапи, і як origin для маршруту/відстані, коли city === "Львів".
const LVIV_DEFAULT_ORIGIN = {
  lat: 49.8419,
  lng: 24.0315,
};
const LVIV_CENTER: [number, number] = [LVIV_DEFAULT_ORIGIN.lat, LVIV_DEFAULT_ORIGIN.lng];
const LVIV_ORIGIN: [number, number] = [LVIV_DEFAULT_ORIGIN.lat, LVIV_DEFAULT_ORIGIN.lng];


type SelectedMapLocation = {
  name: string;
  district: string;
  distance: string;
  lat: number;
  lng: number;
};

type MapSectionProps = {
  lang: "ua" | "en";
  selectedLocation?: SelectedMapLocation | null;
  city?: CityName;
};

function haversineKm(
  from: [number, number],
  to: [number, number]
): number {
  const R = 6371;
  const dLat = ((to[0] - from[0]) * Math.PI) / 180;
  const dLng = ((to[1] - from[1]) * Math.PI) / 180;
  const lat1 = (from[0] * Math.PI) / 180;
  const lat2 = (to[0] * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function FocusSelectedLocation({
  origin,
  selectedLocation,
}: {
  origin: [number, number];
  selectedLocation?: SelectedMapLocation | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedLocation) return;

    const target: [number, number] = [selectedLocation.lat, selectedLocation.lng];
    const bounds = L.latLngBounds([origin, target]);

    map.fitBounds(bounds, {
      padding: [55, 55],
      maxZoom: 15,
      animate: true,
      duration: 0.8,
    });
  }, [map, origin, selectedLocation]);

  return null;
}

export default function MapSection({ lang, selectedLocation, city = "Київ" }: MapSectionProps) {
  const isLviv = city === "Львів";
  const origin: [number, number] = isLviv ? LVIV_ORIGIN : USER_LOCATION;
  const mapCenter: [number, number] = isLviv ? LVIV_CENTER : KYIV_CENTER;

  const target: [number, number] | null = selectedLocation
    ? [selectedLocation.lat, selectedLocation.lng]
    : null;

  const distanceKm = target ? haversineKm(origin, target) : null;
  const mapSalons = isLviv ? LVIV_SALONS : KYIV_SALONS;

  return (
    <div className="map-section" id="map">
      <div className="map-canvas">
        <div className="map-district">
          <span className="label">
            {selectedLocation
              ? lang === "ua"
                ? "Обрана локація"
                : "Selected location"
              : lang === "ua"
                ? "Ваш район"
                : "Your district"}
          </span>

          <span className="value">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#51359b"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>

            {selectedLocation
              ? selectedLocation.name
              : isLviv
                ? (lang === "ua" ? "Галицький" : "Halytskyi")
                : (lang === "ua" ? "Печерський" : "Pechersk")}
          </span>
        </div>

        <MapContainer
          center={mapCenter}
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
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FocusSelectedLocation origin={origin} selectedLocation={selectedLocation} />

          {!selectedLocation &&
            mapSalons.map((salon) => (
            <Marker
              key={salon.id}
              position={[salon.lat, salon.lng]}
              icon={purpleIcon}
            >
              <Popup>{salon.name}</Popup>
            </Marker>
          ))}

          {target && selectedLocation && (
            <>
              <CircleMarker
                center={origin}
                radius={7}
                pathOptions={{
                  color: "#ffffff",
                  weight: 3,
                  fillColor: "#241a3d",
                  fillOpacity: 1,
                }}
                className="map-user-dot"
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="map-user-location-label"
                >
                  {lang === "ua" ? "Ви тут" : "You are here"}
                </Tooltip>
              </CircleMarker>

              <Polyline
                positions={[origin, target]}
                pathOptions={{
                  color: "#735a92",
                  weight: 3,
                  opacity: 0.82,
                  dashArray: "7 7",
                }}
              />

              <Marker position={target} icon={purpleIcon}>
                <Popup>
                  <strong>{selectedLocation.name}</strong>
                  <br />
                  {selectedLocation.district}
                  <br />
                  {lang === "ua" ? "Від вас: " : "From you: "}
                  {distanceKm?.toFixed(1)} {lang === "ua" ? "км" : "km"}
                </Popup>
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -28]}
                  className="map-route-distance"
                >
                  {distanceKm?.toFixed(1)} {lang === "ua" ? "км" : "km"}
                </Tooltip>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
