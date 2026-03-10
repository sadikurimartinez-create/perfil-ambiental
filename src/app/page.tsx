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
    const reader
