"use client";

import { useState, useMemo } from "react";
import exifr from "exifr";

type GpsData = {
  latitude: number;
  longitude: number;
};

type AnalyzeEnvironmentResponse = any; // puedes afinarlo luego

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

// Redimensiona la imagen en el navegador a un máximo de 1024px de ancho/alto
async function resizeImageToBase64(
  file: File,
  maxSize = 1024
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("No se pudo leer la imagen."));
        return;
      }
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Calcular nuevo tamaño manteniendo proporción
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > width && height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        } else if (width > maxSize || height > maxSize) {
          const scale = maxSize / Math.max(width, height);
          width = width * scale;
          height = height * scale;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo crear el contexto de dibujo."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // 70% de calidad para reducir peso
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        const commaIndex = dataUrl.indexOf(",");
        resolve(commaIndex >= 0 ? dataUrl.substring(commaIndex + 1) : dataUrl);
      };
      img.onerror = () => reject(new Error("No se pudo cargar la imagen."));
      img.src = reader.result;
    };

    reader.onerror = () =>
      reject(reader.error || new Error("Error al leer la imagen."));

    reader.readAsDataURL(file);
  });
}

const readFileAsBase64 = (imageFile: File): Promise<string> => {
  // Redimensionamos antes de enviar para evitar usar demasiada memoria
  return resizeImageToBase64(imageFile, 1024);
};

export default function Home() {
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
    <div className="min-h-screen bg-gray-900 text-gray-100 px-4 py-4 md:py-6">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Encabezado */}
        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Captura de Evidencia Ambiental
          </h1>
          <p className="text-xs text-gray-400">
            Operación in situ · Active el GPS del dispositivo antes de tomar la
            fotografía.
          </p>
        </header>

        {/* Formulario principal */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-gray-950/70 border border-gray-800 rounded-xl p-4 shadow-lg max-h-[80vh] overflow-y-auto"
        >
          {/* Selección / captura de fotografía */}
          <section className="space-y-3">
            <label className="block text-sm font-medium text-gray-200">
              Evidencia fotográfica
            </label>
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer border-gray-700 hover:border-sky-400 transition-colors bg-gray-900">
              <div className="flex flex-col items-center gap-1 text-sm text-gray-200">
                <span className="font-medium">
                  Toca o haz clic para capturar / seleccionar una imagen
                </span>
                <span className="text-xs text-gray-400 text-center">
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
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="text-[11px] uppercase text-gray-400 mb-1">
                    Vista previa
                  </p>
                  <div className="rounded-lg overflow-hidden border border-gray-800 bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Vista previa de la evidencia"
                      className="w-full h-40 object-contain bg-black"
                    />
                  </div>
                </div>

                {gps && (
                  <div className="flex-1 space-y-1 text-sm bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
                    <p className="text-[11px] uppercase text-gray-400">
                      Coordenadas extraídas
                    </p>
                    <p>
                      <span className="text-gray-400">Latitud:</span>{" "}
                      <span className="font-mono">
                        {gps.latitude.toFixed(6)}
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-400">Longitud:</span>{" "}
                      <span className="font-mono">
                        {gps.longitude.toFixed(6)}
                      </span>
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
              className="block text-sm font-medium text-gray-200"
            >
              Clasificación del Entorno/Punto
            </label>
            <select
              id="clasificacion-entorno"
              className="w-full rounded-lg border border-gray-700 bg-gray-900 text-sm text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
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
                  className="block text-xs font-medium text-gray-300"
                >
                  Especificación obligatoria
                </label>
                <input
                  id="detalle-clasificacion"
                  type="text"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 text-sm text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
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

          {/* Botón siempre visible al final del formulario */}
          <div className="pt-3 border-t border-gray-800 sticky bottom-0 bg-gray-950/95">
            <button
              type="submit"
              disabled={isLoading || !file || !gps}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 text-gray-900 font-medium text-sm px-4 py-2.5 hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <span className="h-4 w-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                  <span>Generando Perfil Ambiental...</span>
                </>
              ) : (
                <span>Generar Perfil Ambiental</span>
              )}
            </button>

            {isLoading && loadingLabel && (
              <p className="text-[11px] text-gray-400 mt-1 text-center">
                {loadingLabel}
              </p>
            )}
          </div>
        </form>

        {/* Resultado mínimo (placeholder) */}
        {analysisResult && (
          <section className="mt-2 bg-gray-950/70 border border-gray-800 rounded-xl p-3 space-y-1">
            <p className="text-xs font-semibold text-gray-200">
              Perfil Ambiental generado
            </p>
            <p className="text-[11px] text-gray-400">
              Los detalles completos del análisis se encuentran listos para ser
              mostrados en el dashboard criminológico.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
