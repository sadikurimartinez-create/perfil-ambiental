"use client";

import { useState, useMemo } from "react";
import exifr from "exifr";

type GpsData = {
  latitude: number;
  longitude: number;
};

type AnalyzeEnvironmentResponse = any; // podrás afinarlo más adelante

const CATEGORIES = [
  "Escuela",
  "Núcleo Habitacional",
  "Oxxo",
  "Terreno Baldío",
  "Terminal de Transporte Público",
  "Parque Recreativo",
  "Ruta",
  "Taller",
  "Comercio no registrado",
  "Banco",
  "Casa de empeño",
  "Restaurante de comida rápida",
  "Comida callejera",
  "Cantina",
  "Expendio de vino",
  "Otro",
] as const;

type Category = (typeof CATEGORIES)[number];

const CATEGORIES_REQUIRING_DETAIL: Category[] = [
  "Ruta",
  "Comercio no registrado",
  "Comida callejera",
  "Otro",
];

// Lee el archivo como base64 (sin redimensionar, pero con límite de 20 MB ya aplicado antes)
const readFileAsBase64 = (imageFile: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        const commaIndex = result.indexOf(",");
        if (commaIndex >= 0) {
          resolve(result.substring(commaIndex + 1));
        } else {
          resolve(result);
        }
      } else {
        reject(new Error("No se pudo leer el archivo como base64."));
      }
    };
    reader.onerror = () =>
      reject(reader.error || new Error("Error al leer la imagen."));
    reader.readAsDataURL(imageFile);
  });

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gps, setGps] = useState<GpsData | null>(null);

  const [category, setCategory] = useState<Category | "">("");
  const [detail, setDetail] = useState<string>("");

  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<
    "idle" | "extracting" | "callingApis" | "buildingProfile"
  >("idle");

  const [analysisResult, setAnalysisResult] =
    useState<AnalyzeEnvironmentResponse | null>(null);

  const requiresDetail = useMemo(
    () => category !== "" && CATEGORIES_REQUIRING_DETAIL.includes(category),
    [category]
  );

  const loadingLabel = useMemo(() => {
    if (!isLoading) return null;
    switch (loadingStep) {
      case "extracting":
        return "Extrayendo coordenadas y metadatos de la fotografía...";
      case "callingApis":
        return "Cruzando APIs de Google y DENUE (INEGI)...";
      case "buildingProfile":
        return "Generando Perfil Criminológico Ambiental...";
      default:
        return "Procesando solicitud...";
    }
  }, [isLoading, loadingStep]);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selected = event.target.files?.[0];
    if (!selected) return;

    // Limpiar estados previos
    setError(null);
    setInfoMessage(null);
    setAnalysisResult(null);
    setCategory("");
    setDetail("");
    setGps(null);

    // Rechazar fotos demasiado grandes (> 20 MB) para evitar errores de memoria
    const sizeInMb = selected.size / (1024 * 1024);
    if (sizeInMb > 20) {
      setError(
        "La fotografía es demasiado pesada (más de 20 MB). Redúzcala o tome una nueva con menor resolución."
      );
      setFile(null);
      setPreviewUrl(null);
      return;
    }

    setFile(selected);
    const url = URL.createObjectURL(selected);
    setPreviewUrl(url);

    setIsLoading(true);
    setLoadingStep("extracting");

    try {
      const exifGps = await exifr.gps(selected).catch(() => null);

      let latitude: number | null = null;
      let longitude: number | null = null;

      if (
        exifGps &&
        typeof exifGps.latitude === "number" &&
        typeof exifGps.longitude === "number"
      ) {
        latitude = exifGps.latitude;
        longitude = exifGps.longitude;
      }

      if (latitude === null || longitude === null) {
        setError(
          "Fotografía sin georreferencia. Active el GPS del dispositivo y tome la foto directamente desde la cámara."
        );
        setGps(null);
        return;
      }

      setGps({ latitude, longitude });
      setInfoMessage(
        "Coordenadas extraídas correctamente. Complete la clasificación del entorno antes de generar el perfil."
      );
    } catch (err) {
      console.error(err);
      setError(
        "Error al leer los metadatos EXIF de la fotografía. Intente con otra imagen tomada directamente desde el dispositivo."
      );
      setGps(null);
    } finally {
      setIsLoading(false);
      setLoadingStep("idle");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfoMessage(null);
    setAnalysisResult(null);

    if (!file || !gps) {
      setError(
        "Debe seleccionar una fotografía con coordenadas GPS válidas antes de generar el perfil."
      );
      return;
    }

    if (!category) {
      setError("Seleccione la clasificación del entorno/punto.");
      return;
    }

    if (requiresDetail && detail.trim().length === 0) {
      setError(
        "Este tipo de clasificación requiere especificar los detalles en el campo de texto."
      );
      return;
    }

    try {
      setIsLoading(true);
      setLoadingStep("extracting");

      const imageBase64 = await readFileAsBase64(file);

      setLoadingStep("callingApis");

      const response = await fetch("/api/analyze-environment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idPersonaInvestigadora: "00000000-0000-0000-0000-000000000000", // placeholder
          lat: gps.latitude,
          lng: gps.longitude,
          radiusMeters: 250,
          imageBase64,
          clasificacionEntorno: category,
          detallesClasificacion: requiresDetail ? detail.trim() : null,
        }),
      });

      setLoadingStep("buildingProfile");

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error("Error API /api/analyze-environment:", text);
        throw new Error(
          "El servidor no pudo generar el perfil ambiental. Intente nuevamente."
        );
      }

      const json = (await response.json()) as AnalyzeEnvironmentResponse;
      setAnalysisResult(json);
      setInfoMessage(
        "Perfil Ambiental generado correctamente. Revise los hallazgos en el panel de resultados."
      );
    } catch (err) {
      console.error(err);
      setError(
        "Ocurrió un error al procesar la información. Verifique su conexión y vuelva a intentarlo."
      );
    } finally {
      setIsLoading(false);
      setLoadingStep("idle");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-4 md:py-6">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6">
        {/* Encabezado */}
        <header className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Perfil Criminológico Ambiental
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Etapa 1 · Captura y georreferenciación de evidencia fotográfica
            para iniciar el análisis bajo los marcos de Actividades Rutinarias,
            Patrón Delictivo, Elección Racional y Ventanas Rotas.
          </p>
        </header>

        {/* Formulario principal */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-slate-950/70 border border-slate-800 rounded-xl p-4 shadow-lg"
        >
          {/* Selección / captura de fotografía */}
          <section className="space-y-3">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold">
                Captura / Subida de Evidencia Fotográfica
              </h2>
              <p className="text-xs text-slate-400">
                Sube una fotografía tomada in situ. El sistema intentará extraer las
                coordenadas GPS desde los metadatos EXIF para preparar el análisis
                geoespacial.
              </p>
            </header>

            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer border-slate-700 hover:border-sky-400 transition-colors bg-slate-900">
              <div className="flex flex-col items-center gap-1 text-sm text-slate-200">
                <span className="font-medium">
                  Toca o haz clic para capturar / seleccionar una imagen
                </span>
                <span className="text-xs text-slate-400 text-center">
                  Formatos: JPG, JPEG, HEIC. Idealmente tomada directamente
                  desde este dispositivo con GPS activado.
                </span>
              </div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            {previewUrl && (
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <p className="text-[11px] uppercase text-slate-400 mb-1">
                    Vista previa de la evidencia
                  </p>
                  <div className="rounded-lg overflow-hidden border border-slate-800 bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Vista previa de la evidencia"
                      className="w-full h-40 object-contain bg-black"
                    />
                  </div>
                </div>

                {gps && (
                  <div className="flex-1 space-y-1 text-sm bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                    <p className="text-[11px] uppercase text-slate-400">
                      Coordenadas extraídas
                    </p>
                    <p>
                      <span className="text-slate-400">Latitud:</span>{" "}
                      <span className="font-mono">
                        {gps.latitude.toFixed(6)}
                      </span>
                    </p>
                    <p>
                      <span className="text-slate-400">Longitud:</span>{" "}
                      <span className="font-mono">
                        {gps.longitude.toFixed(6)}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Estos datos se utilizarán para centrar el mapa y llamar a las
                      APIs de Google Maps, Google Places e INEGI en etapas
                      posteriores del flujo.
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Clasificación del entorno */}
          <section className="space-y-2">
            <label
              htmlFor="clasificacion-entorno"
              className="block text-sm font-semibold text-slate-200"
            >
              Clasificación del Entorno/Punto
            </label>
            <select
              id="clasificacion-entorno"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as Category | "")
              }
            >
              <option value="">Seleccione una opción</option>
              {CATEGORIES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            {requiresDetail && (
              <div className="space-y-1">
                <label
                  htmlFor="detalle-clasificacion"
                  className="block text-xs font-medium text-slate-300"
                >
                  Especificación obligatoria
                </label>
                <input
                  id="detalle-clasificacion"
                  type="text"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  placeholder="Precise los detalles (Ej. brecha que conecta X con Y, tipo de negocio, etc.)"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                />
              </div>
            )}
          </section>

          {/* Mensajes de estado */}
          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {infoMessage && !error && (
            <p className="text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-800 rounded-lg px-3 py-2">
              {infoMessage}
            </p>
          )}

          {/* Botón */}
          <div className="pt-3 border-t border-slate-800">
            <button
              type="submit"
              disabled={isLoading || !file || !gps}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm px-4 py-2.5 hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <span className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Generando Perfil Ambiental...</span>
                </>
              ) : (
                <span>Generar Perfil Ambiental</span>
              )}
            </button>

            {isLoading && loadingLabel && (
              <p className="text-[11px] text-slate-400 mt-1 text-center">
                {loadingLabel}
              </p>
            )}
          </div>
        </form>

        {/* Resultado mínimo (placeholder) */}
        {analysisResult && (
          <section className="mt-2 bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-1">
            <p className="text-xs font-semibold text-slate-200">
              Perfil Ambiental generado
            </p>
            <p className="text-[11px] text-slate-400">
              Los detalles completos del análisis se encuentran listos para ser
              mostrados en el dashboard criminológico.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
