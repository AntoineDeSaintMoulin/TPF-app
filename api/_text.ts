// Nettoie un texte avant de l'enregistrer dans Postgres.
// Certains PDF contiennent l'octet nul (\u0000) ou des caractères de contrôle que Postgres refuse
// (« invalid byte sequence for encoding "UTF8": 0x00 »).
export function cleanText(value: string): string {
  if (typeof value !== "string") return value;
  return value
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    // Moitiés de caractères (surrogates isolés), invalides en UTF-8
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

// Applique cleanText à toutes les chaînes d'un objet (résultat d'extraction de l'IA)
export function cleanDeep<T>(value: T): T {
  if (typeof value === "string") return cleanText(value) as any;
  if (Array.isArray(value)) return value.map((v) => cleanDeep(v)) as any;
  if (value && typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) out[k] = cleanDeep(v);
    return out;
  }
  return value;
}
