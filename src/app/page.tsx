import { ImageUpload } from "@/components/ImageUpload";

export default function HomePage() {
  return (
    <div className="space-y-6">
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

      <ImageUpload />
    </div>
  );
}

