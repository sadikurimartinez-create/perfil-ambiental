"use client";

import { useMemo, useState } from "react";
import {
  GoogleMap,
  Marker,
  InfoWindow,
  HeatmapLayer,
  useLoadScript,
} from "@react-google-maps/api";

// ----------------------
// Mock data (solo diseño)
// ----------------------

const MOCK_POLIGONOS = [
  "Todos los polígonos",
  "VNSA Sector Guadalupe",
  "Villa Montaña",
  "Insurgentes",
  "Zona Centro",
];

const MOCK_TEORIAS = [
  "Todas",
  "Ventanas Rotas",
  "Actividades Rutinarias",
  "Patrón Delictivo",
  "Elección Racional",
];

type MockLevantamiento = {
  id: string;
  lat: number;
  lng: number;
  etiqueta: string;
  poligono: string;
  fotoUrl: string;
  visionTags: string[];
  riesgo: "alto" | "medio" | "bajo";
};

const MOCK_LEVANTAMIENTOS: MockLevantamiento[] = [
  {
    id: "L-0001",
    lat: 21.8818,
    lng: -102.295,
    etiqueta: "Terreno Baldío",
    poligono: "Insurgentes",
    fotoUrl:
      "https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=640",
    visionTags: ["maleza_crecida", "basura", "falta_iluminacion"],
    riesgo: "alto",
  },
  {
    id: "L-0002",
    lat: 21.886,
    lng: -102.304,
    etiqueta: "Escuela",
    poligono: "VNSA Sector Guadalupe",
    fotoUrl:
      "https://images.pexels.com/photos/256490/pexels-photo-256490.jpeg?auto=compress&cs=tinysrgb&w=640",
    visionTags: ["entorno_escolar", "grafiti"],
    riesgo: "medio",
  },
  {
    id: "L-0003",
    lat: 21.8805,
    lng: -102.29,
    etiqueta: "Captación de desperdicios / Pepenadores",
    poligono: "Villa Montaña",
    fotoUrl:
      "https://images.pexels.com/photos/115089/pexels-photo-115089.jpeg?auto=compress&cs=tinysrgb&w=640",
    visionTags: ["basura", "estructuras_improvisadas"],
    riesgo: "alto",
  },
];

const MOCK_ALERTAS = [
  {
    id: "A-001",
    nivel: "critica" as const,
    mensaje:
      "Venta de alcohol a menos de 80m de institución educativa en Polígono Insurgentes.",
    fecha: "2026-03-10 10:21",
  },
  {
    id: "A-002",
    nivel: "alta" as const,
    mensaje:
      "Predio en breña sin iluminación reportado en ruta peatonal (VNSA Sector Guadalupe).",
    fecha: "2026-03-10 09:47",
  },
  {
    id: "A-003",
    nivel: "media" as const,
    mensaje:
      "Probable comercio irregular (chatarrera sin registro DENUE) en Villa Montaña.",
    fecha: "2026-03-10 09:10",
  },
];

// ----------------------
// Mapa y Dashboard
// ----------------------

const MAP_CONTAINER_STYLE: google.maps.MapOptions["styles"] | undefined =
  undefined; // puedes agregar estilos de mapa oscuro si lo deseas

const MAP_LIBRARIES: (
  | "places"
  | "drawing"
  | "geometry"
  | "visualization"
  | "localContext"
  | "routes"
)[] = ["visualization"];

const DEFAULT_CENTER = { lat: 21.883, lng: -102.295 };

export default function DashboardPage() {
  const [selectedPoligono, setSelectedPoligono] = useState(
    MOCK_POLIGONOS[0]
  );
  const [selectedTeoria, setSelectedTeoria] = useState(MOCK_TEORIAS[0]);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [heatmapEnabled, setHeatmapEnabled] = useState<boolean>(false);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: MAP_LIBRARIES,
  });

  const filteredLevantamientos = useMemo(() => {
    return MOCK_LEVANTAMIENTOS.filter((l) => {
      if (selectedPoligono !== MOCK_POLIGONOS[0] && l.poligono !== selectedPoligono) {
        return false;
      }
      // Por ahora, la teoría no filtra nada (mock) pero dejamos el hook listo
      return true;
    });
  }, [selectedPoligono, selectedTeoria]);

  const totalLevantamientos = filteredLevantamientos.length;
  const alertasCriticas = MOCK_ALERTAS.filter(
    (a) => a.nivel === "critica" || a.nivel === "alta"
  ).length;

  // Mock de proyección a 6 meses (simplemente un porcentaje fijo)
  const proyeccion6Meses = 68;

  const heatmapData = useMemo(
    () =>
      filteredLevantamientos.map((l) => ({
        location: new google.maps.LatLng(l.lat, l.lng),
        weight: l.riesgo === "alto" ? 3 : l.riesgo === "medio" ? 2 : 1,
      })),
    [filteredLevantamientos]
  );

  const selectedMarker = filteredLevantamientos.find(
    (l) => l.id === selectedMarkerId
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col md:flex-row">
      {/* PANEL IZQUIERDO */}
      <aside className="w-full md:w-80 border-b md:border-b-0 md:border-r border-gray-800 bg-gray-950/95 p-4 space-y-4">
        {/* Filtros */}
        <section className="space-y-3">
          <h1 className="text-sm font-semibold tracking-tight text-gray-100">
            Filtros Operativos
          </h1>
          <div className="space-y-2 text-xs">
            <div className="space-y-1">
              <label className="block text-gray-300">
                Polígono Prioritario
              </label>
              <select
                className="w-full rounded-lg border border-gray-700 bg-gray-900 text-gray-100 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={selectedPoligono}
                onChange={(e) => setSelectedPoligono(e.target.value)}
              >
                {MOCK_POLIGONOS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-gray-300">
                Teoría Criminológica
              </label>
              <select
                className="w-full rounded-lg border border-gray-700 bg-gray-900 text-gray-100 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={selectedTeoria}
                onChange={(e) => setSelectedTeoria(e.target.value)}
              >
                {MOCK_TEORIAS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-gray-300">
                Rango de Fechas
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 text-gray-100 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <input
                  type="date"
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 text-gray-100 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>
        </section>

        {/* KPIs */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
            Indicadores Clave
          </h2>
          <div className="space-y-2">
            <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
              <p className="text-[11px] text-gray-400">
                Total de levantamientos
              </p>
              <p className="text-xl font-semibold text-sky-400">
                {totalLevantamientos}
              </p>
            </div>
            <div className="bg-gray-900 border border-red-800/60 rounded-lg px-3 py-2">
              <p className="text-[11px] text-red-300">
                Alertas críticas / altas
              </p>
              <p className="text-xl font-semibold text-red-400">
                {alertasCriticas}
              </p>
            </div>
            <div className="bg-gray-900 border border-amber-700/70 rounded-lg px-3 py-2">
              <p className="text-[11px] text-amber-300">
                Proyección 6 meses (riesgo)
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-amber-400"
                    style={{ width: `${proyeccion6Meses}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-amber-300">
                  {proyeccion6Meses}%
                </span>
              </div>
            </div>
          </div>
        </section>
      </aside>

      {/* ÁREA CENTRAL - MAPA */}
      <main className="flex-1 flex flex-col bg-gray-950">
        <div className="flex-1 relative">
          {!isLoaded && !loadError && (
            <div className="flex items-center justify-center h-full text-xs text-gray-400">
              Cargando mapa táctico...
            </div>
          )}
          {loadError && (
            <div className="flex items-center justify-center h-full text-xs text-red-400">
              Error al cargar Google Maps. Verifique la API Key.
            </div>
          )}
          {isLoaded && (
            <GoogleMap
              mapContainerClassName="w-full h-full"
              center={DEFAULT_CENTER}
              zoom={13}
              options={{
                disableDefaultUI: true,
                zoomControl: true,
                styles: MAP_CONTAINER_STYLE,
                backgroundColor: "#020617",
              }}
              onClick={() => setSelectedMarkerId(null)}
            >
              {filteredLevantamientos.map((l) => (
                <Marker
                  key={l.id}
                  position={{ lat: l.lat, lng: l.lng }}
                  onClick={() => setSelectedMarkerId(l.id)}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: l.riesgo === "alto" ? 7 : 5,
                    fillColor:
                      l.riesgo === "alto"
                        ? "#f97373"
                        : l.riesgo === "medio"
                        ? "#facc15"
                        : "#22c55e",
                    fillOpacity: 1,
                    strokeWeight: 1,
                    strokeColor: "#020617",
                  }}
                />
              ))}

              {heatmapEnabled && (
                <HeatmapLayer
                  options={{
                    radius: 40,
                    dissipating: true,
                    opacity: 0.6,
                  }}
                  data={heatmapData as any}
                />
              )}

              {selectedMarker && (
                <InfoWindow
                  position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
                  onCloseClick={() => setSelectedMarkerId(null)}
                >
                  <div className="max-w-xs text-xs text-gray-900">
                    <p className="font-semibold mb-1">
                      {selectedMarker.etiqueta}
                    </p>
                    <p className="text-[11px] text-gray-600 mb-1">
                      Polígono: {selectedMarker.poligono}
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedMarker.fotoUrl}
                      alt="Evidencia in situ"
                      className="w-full h-32 object-cover rounded mb-2"
                    />
                    <p className="text-[11px] font-semibold text-gray-700">
                      Vulnerabilidades (Vision):
                    </p>
                    <ul className="list-disc list-inside text-[11px] text-gray-700">
                      {selectedMarker.visionTags.map((t) => (
                        <li key={t}>{t.replace(/_/g, " ")}</li>
                      ))}
                    </ul>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          )}

          {/* Botón flotante Heatmap */}
          <button
            type="button"
            onClick={() => setHeatmapEnabled((v) => !v)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 md:left-4 md:translate-x-0 inline-flex items-center gap-1 rounded-full bg-sky-500 text-gray-900 text-xs font-medium px-3 py-1.5 shadow-lg shadow-sky-500/40 hover:bg-sky-400"
          >
            {heatmapEnabled ? "Ocultar mapa de calor" : "Mostrar mapa de calor"}
          </button>
        </div>
      </main>

      {/* PANEL DERECHO - ALERTAS */}
      <aside className="w-full md:w-80 border-t md:border-t-0 md:border-l border-gray-800 bg-gray-950/95 p-4 flex flex-col">
        <h2 className="text-sm font-semibold text-gray-100 mb-2">
          Alertas Espaciales Infractoras
        </h2>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {MOCK_ALERTAS.map((a) => (
            <div
              key={a.id}
              className={`rounded-lg px-3 py-2 text-xs border ${
                a.nivel === "critica"
                  ? "border-red-700/70 bg-red-950/40"
                  : a.nivel === "alta"
                  ? "border-amber-700/70 bg-amber-950/40"
                  : "border-sky-700/70 bg-sky-950/40"
              }`}
            >
              <p className="font-semibold mb-1">
                {a.nivel === "critica"
                  ? "🔴 ALERTA CRÍTICA"
                  : a.nivel === "alta"
                  ? "🟡 ADVERTENCIA"
                  : "🔵 INFORMACIÓN"}
              </p>
              <p className="text-gray-100 mb-1">{a.mensaje}</p>
              <p className="text-[10px] text-gray-400">{a.fecha}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
