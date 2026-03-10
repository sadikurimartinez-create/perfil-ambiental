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
    setLoadingStep
