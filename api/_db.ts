import { neon } from "@neondatabase/serverless";

export function getDb() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("Variable d'environnement POSTGRES_URL manquante");
  }
  return neon(connectionString);
}
