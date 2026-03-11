import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Falta la variable de entorno DATABASE_URL para conectar a PostgreSQL."
  );
}

export const pool = new Pool({
  connectionString,
  max: 10,
});

