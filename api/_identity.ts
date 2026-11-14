import { getDb } from "./_db.js";

// ---------------------------------------------------------------------------
// Identité des gérants et des fonds : évite de créer des doublons quand un même
// fonds est écrit différemment ("NinetyOne" / "Ninety One", nom court / officiel).
//
// Ordre de rapprochement d'un fonds :
//   1. ISIN (identifiant unique, extrait des factsheets)
//   2. Identifiant de fonds existant proposé par Gemini (qui reçoit la liste des fonds)
//   3. Alias enregistrés (anciens noms conservés lors des fusions)
//   4. Nom normalisé (sans espaces, accents, ponctuation ni mots génériques)
// ---------------------------------------------------------------------------

let schemaReady = false;

// Crée les colonnes/tables nécessaires si elles n'existent pas (sans toucher aux données)
export async function ensureIdentitySchema() {
  if (schemaReady) return;
  const sql = getDb();
  await sql`ALTER TABLE funds ADD COLUMN IF NOT EXISTS isins TEXT[] NOT NULL DEFAULT '{}'`;
  await sql`
    CREATE TABLE IF NOT EXISTS fund_aliases (
      alias_norm TEXT PRIMARY KEY,
      alias TEXT NOT NULL,
      fund_id TEXT NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS manager_aliases (
      alias_norm TEXT PRIMARY KEY,
      alias TEXT NOT NULL,
      manager_id TEXT NOT NULL REFERENCES asset_managers(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  schemaReady = true;
}

const FUND_STOPWORDS = new Set([
  "fund", "funds", "fonds", "sicav", "ucits", "fcp", "the", "of", "de", "du", "des", "la", "le", "les", "and", "et",
  "sa", "plc", "ltd", "llc", "inc", "class", "classe", "share", "shares", "part", "parts", "acc", "dist", "inc",
  "eur", "usd", "gbp", "chf", "hedged", "h",
]);

const MANAGER_STOPWORDS = new Set([
  "asset", "assets", "management", "managers", "manager", "investment", "investments", "investors", "am", "gestion",
  "group", "groupe", "the", "de", "sa", "plc", "ltd", "llc", "inc", "international", "funds", "fund",
]);

function tokens(value: string): string[] {
  return (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function normalizeManagerName(name: string): string {
  const t = tokens(name).filter((w) => !MANAGER_STOPWORDS.has(w));
  return t.join("") || tokens(name).join("");
}

// managerNorm : nom normalisé du gérant, retiré du début du nom du fonds s'il y figure
export function normalizeFundName(name: string, managerNorm = ""): string {
  let norm = tokens(name).filter((w) => !FUND_STOPWORDS.has(w)).join("");
  if (!norm) norm = tokens(name).join("");
  if (managerNorm && norm.startsWith(managerNorm) && norm.length > managerNorm.length + 3) {
    norm = norm.slice(managerNorm.length);
  }
  return norm;
}

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
export function cleanIsins(values: any): string[] {
  if (!Array.isArray(values)) return [];
  const out = new Set<string>();
  for (const v of values) {
    const s = String(v || "").toUpperCase().replace(/\s+/g, "");
    if (ISIN_RE.test(s)) out.add(s);
  }
  return [...out];
}

// Similarité simple (mots en commun) pour suggérer des fusions dans l'interface
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(tokens(a).filter((w) => !FUND_STOPWORDS.has(w)));
  const tb = new Set(tokens(b).filter((w) => !FUND_STOPWORDS.has(w)));
  if (!ta.size || !tb.size) return 0;
  let common = 0;
  ta.forEach((w) => tb.has(w) && common++);
  return common / Math.min(ta.size, tb.size);
}

// Liste compacte des gérants et fonds existants, envoyée à Gemini pour qu'il réutilise les bons identifiants
export async function getCatalogForPrompt(): Promise<string> {
  await ensureIdentitySchema();
  const sql = getDb();
  const managers = (await sql`SELECT id, name FROM asset_managers ORDER BY name`) as any[];
  const funds = (await sql`SELECT id, manager_id, name, isins FROM funds ORDER BY name LIMIT 600`) as any[];
  if (!managers.length) return "";
  const lines: string[] = [];
  for (const m of managers) {
    lines.push(`MANAGER ${m.id} | ${m.name}`);
    for (const f of funds.filter((x) => x.manager_id === m.id)) {
      lines.push(`  FUND ${f.id} | ${f.name}${f.isins?.length ? ` | ISIN: ${f.isins.join(", ")}` : ""}`);
    }
  }
  return lines.join("\n");
}

async function addManagerAlias(alias: string, managerId: string) {
  const norm = normalizeManagerName(alias);
  if (!norm) return;
  const sql = getDb();
  await sql`
    INSERT INTO manager_aliases (alias_norm, alias, manager_id) VALUES (${norm}, ${alias}, ${managerId})
    ON CONFLICT (alias_norm) DO UPDATE SET manager_id = EXCLUDED.manager_id, alias = EXCLUDED.alias
  `;
}

async function addFundAlias(alias: string, fundId: string, managerNorm = "") {
  const norm = normalizeFundName(alias, managerNorm);
  if (!norm) return;
  const sql = getDb();
  await sql`
    INSERT INTO fund_aliases (alias_norm, alias, fund_id) VALUES (${norm}, ${alias}, ${fundId})
    ON CONFLICT (alias_norm) DO UPDATE SET fund_id = EXCLUDED.fund_id, alias = EXCLUDED.alias
  `;
}

export async function findOrCreateManager(data: any, create = true): Promise<{ id: string; name: string; created: boolean } | null> {
  await ensureIdentitySchema();
  const sql = getDb();
  const managers = (await sql`SELECT id, name FROM asset_managers`) as any[];

  // 1. Identifiant proposé par Gemini
  const proposed = managers.find((m) => data.existing_manager_id && m.id === data.existing_manager_id);
  if (proposed) return { ...proposed, created: false };

  const name = String(data.asset_manager || "").trim();
  if (!name || name === "N/A") return null;
  const norm = normalizeManagerName(name);

  // 2. Alias
  const alias = (await sql`SELECT manager_id FROM manager_aliases WHERE alias_norm = ${norm}`) as any[];
  const byAlias = alias.length ? managers.find((m) => m.id === alias[0].manager_id) : null;
  if (byAlias) return { ...byAlias, created: false };

  // 3. Nom normalisé (égalité, ou l'un commence par l'autre : "robeco" / "robecoinstitutional")
  const byName = managers.find((m) => {
    const mn = normalizeManagerName(m.name);
    if (mn === norm) return true;
    const [short, long] = mn.length < norm.length ? [mn, norm] : [norm, mn];
    return short.length >= 4 && long.startsWith(short);
  });
  if (byName) return { ...byName, created: false };

  if (!create) return null;

  // 4. Création
  const id = `mgr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await sql`
    INSERT INTO asset_managers (id, name, sales_contacts)
    VALUES (${id}, ${name}, ${data.sales_email ? [data.sales_email] : []})
  `;
  await addManagerAlias(name, id);
  return { id, name, created: true };
}

// getManager n'est appelé que si le fonds n'est pas reconnu par ISIN ou par l'IA :
// un fonds reconnu garde son gérant actuel, sans créer de gérant en double.
export async function findOrCreateFund(
  data: any,
  getManager: () => Promise<{ id: string; name: string } | null>,
  assignAnalyst: (fundName: string) => Promise<string>,
  create = true
): Promise<{ id: string; name: string; created: boolean; matchedBy: string } | { error: string }> {
  await ensureIdentitySchema();
  const sql = getDb();
  const funds = (await sql`SELECT id, manager_id, name, isins FROM funds`) as any[];
  const isins = cleanIsins(data.isins);

  const finish = async (fund: any, matchedBy: string) => {
    if (!create) return { id: fund.id, name: fund.name, created: false, matchedBy };
    // Complète les ISIN connus du fonds
    const missing = isins.filter((i) => !(fund.isins || []).includes(i));
    if (missing.length) {
      await sql`UPDATE funds SET isins = (SELECT ARRAY(SELECT DISTINCT unnest(isins || ${missing}::text[]))) WHERE id = ${fund.id}`;
    }
    return { id: fund.id, name: fund.name, created: false, matchedBy };
  };

  // 1. ISIN
  if (isins.length) {
    const byIsin = funds.find((f) => (f.isins || []).some((i: string) => isins.includes(i)));
    if (byIsin) return finish(byIsin, "isin");
  }

  // 2. Identifiant proposé par Gemini
  const proposed = funds.find((f) => data.existing_fund_id && f.id === data.existing_fund_id);
  if (proposed) return finish(proposed, "ai");

  const manager = await getManager();
  if (!manager) return { error: "Société de gestion non identifiée par l'IA" };
  const managerNorm = normalizeManagerName(manager.name);

  const name = String(data.fund_name || "").trim();
  if (!name || name === "N/A") return { error: "Fonds non identifié par l'IA" };
  const norm = normalizeFundName(name, managerNorm);

  // 3. Alias
  const alias = (await sql`SELECT fund_id FROM fund_aliases WHERE alias_norm = ${norm}`) as any[];
  const byAlias = alias.length ? funds.find((f) => f.id === alias[0].fund_id) : null;
  if (byAlias) return finish(byAlias, "alias");

  // 4. Nom normalisé (le nom du gérant est retiré du début des deux côtés)
  const byName = funds.find((f) => normalizeFundName(f.name, managerNorm) === norm || normalizeFundName(f.name) === normalizeFundName(name));
  if (byName) return finish(byName, "name");

  if (!create) return { error: "Aucun fonds existant ne correspond" };

  // 5. Création
  const id = `fund-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const analyst = await assignAnalyst(name);
  await sql`
    INSERT INTO funds (id, manager_id, name, analyst_id, isins)
    VALUES (${id}, ${manager.id}, ${name}, ${analyst}, ${isins})
  `;
  await addFundAlias(name, id, managerNorm);
  return { id, name, created: true, matchedBy: "created" };
}

// Fusionne le fonds source dans le fonds cible : rapports, commentaire analyste, ISIN et alias
export async function mergeFunds(sourceId: string, targetId: string) {
  if (!sourceId || !targetId || sourceId === targetId) throw new Error("Fonds source et cible invalides");
  await ensureIdentitySchema();
  const sql = getDb();
  const rows = (await sql`
    SELECT f.id, f.name, f.isins, m.name AS manager_name
    FROM funds f JOIN asset_managers m ON m.id = f.manager_id
    WHERE f.id = ANY(${[sourceId, targetId]})
  `) as any[];
  const source = rows.find((r) => r.id === sourceId);
  const target = rows.find((r) => r.id === targetId);
  if (!source || !target) throw new Error("Fonds introuvable");

  const overrides = (await sql`SELECT fund_id, positioning_override, analyst_comment FROM analyst_overrides WHERE fund_id = ANY(${[sourceId, targetId]})`) as any[];
  const srcOv = overrides.find((o) => o.fund_id === sourceId);
  const tgtOv = overrides.find((o) => o.fund_id === targetId);
  const now = new Date().toISOString();

  const queries: any[] = [
    sql`UPDATE fund_reports SET fund_id = ${targetId} WHERE fund_id = ${sourceId}`,
    sql`UPDATE funds SET isins = (SELECT ARRAY(SELECT DISTINCT unnest(isins || ${source.isins || []}::text[]))) WHERE id = ${targetId}`,
    sql`UPDATE fund_aliases SET fund_id = ${targetId} WHERE fund_id = ${sourceId}`,
  ];

  if (srcOv && !tgtOv) {
    queries.push(sql`UPDATE analyst_overrides SET fund_id = ${targetId}, updated_at = ${now} WHERE fund_id = ${sourceId}`);
  } else if (srcOv && tgtOv) {
    const comment = [tgtOv.analyst_comment, srcOv.analyst_comment && `[Repris de « ${source.name} »] ${srcOv.analyst_comment}`].filter(Boolean).join("\n\n");
    const positioning = tgtOv.positioning_override || srcOv.positioning_override;
    queries.push(sql`UPDATE analyst_overrides SET analyst_comment = ${comment}, positioning_override = ${positioning}, updated_at = ${now} WHERE fund_id = ${targetId}`);
    queries.push(sql`DELETE FROM analyst_overrides WHERE fund_id = ${sourceId}`);
  }

  queries.push(sql`DELETE FROM funds WHERE id = ${sourceId}`);

  // L'ancien nom devient un alias du fonds cible : il sera reconnu automatiquement à l'avenir
  for (const n of [normalizeFundName(source.name, normalizeManagerName(source.manager_name)), normalizeFundName(source.name)]) {
    if (!n) continue;
    queries.push(sql`
      INSERT INTO fund_aliases (alias_norm, alias, fund_id) VALUES (${n}, ${source.name}, ${targetId})
      ON CONFLICT (alias_norm) DO UPDATE SET fund_id = EXCLUDED.fund_id, alias = EXCLUDED.alias
    `);
  }

  await sql.transaction(queries);
}

// Fusionne le gérant source dans le gérant cible : fonds, contacts et alias
export async function mergeManagers(sourceId: string, targetId: string) {
  if (!sourceId || !targetId || sourceId === targetId) throw new Error("Gérants source et cible invalides");
  await ensureIdentitySchema();
  const sql = getDb();
  const rows = (await sql`SELECT id, name, sales_contacts FROM asset_managers WHERE id = ANY(${[sourceId, targetId]})`) as any[];
  const source = rows.find((r) => r.id === sourceId);
  const target = rows.find((r) => r.id === targetId);
  if (!source || !target) throw new Error("Gérant introuvable");

  const contacts = [...new Set([...(target.sales_contacts || []), ...(source.sales_contacts || [])])];
  const norm = normalizeManagerName(source.name);

  await sql.transaction([
    sql`UPDATE funds SET manager_id = ${targetId} WHERE manager_id = ${sourceId}`,
    sql`UPDATE asset_managers SET sales_contacts = ${contacts} WHERE id = ${targetId}`,
    sql`UPDATE manager_aliases SET manager_id = ${targetId} WHERE manager_id = ${sourceId}`,
    sql`DELETE FROM asset_managers WHERE id = ${sourceId}`,
    sql`
      INSERT INTO manager_aliases (alias_norm, alias, manager_id) VALUES (${norm}, ${source.name}, ${targetId})
      ON CONFLICT (alias_norm) DO UPDATE SET manager_id = EXCLUDED.manager_id, alias = EXCLUDED.alias
    `,
  ]);
}

// Rattache explicitement une extraction à un fonds choisi par l'utilisateur :
// complète ses ISIN et retient le nom lu dans le texte comme alias de ce fonds.
export async function attachToFund(data: any, fundId: string): Promise<{ id: string; name: string } | null> {
  await ensureIdentitySchema();
  const sql = getDb();
  const rows = (await sql`
    SELECT f.id, f.name, f.isins, m.name AS manager_name
    FROM funds f JOIN asset_managers m ON m.id = f.manager_id WHERE f.id = ${fundId}
  `) as any[];
  const fund = rows[0];
  if (!fund) return null;

  const isins = cleanIsins(data.isins).filter((i) => !(fund.isins || []).includes(i));
  if (isins.length) {
    await sql`UPDATE funds SET isins = (SELECT ARRAY(SELECT DISTINCT unnest(isins || ${isins}::text[]))) WHERE id = ${fundId}`;
  }

  // N'enregistre l'alias que si ce nom ne désigne pas déjà un AUTRE fonds existant
  // (sinon un mauvais choix ponctuel détournerait les futurs emails de ce fonds)
  const name = String(data.fund_name || "").trim();
  if (name && name !== "N/A" && name !== fund.name) {
    const others = (await sql`
      SELECT f.id, f.name, m.name AS manager_name FROM funds f JOIN asset_managers m ON m.id = f.manager_id WHERE f.id <> ${fundId}
    `) as any[];
    const plain = normalizeFundName(name);
    const clash = others.some((o) => normalizeFundName(o.name) === plain || normalizeFundName(o.name, normalizeManagerName(o.manager_name)) === normalizeFundName(name, normalizeManagerName(o.manager_name)));
    if (!clash) await addFundAlias(name, fundId, normalizeManagerName(fund.manager_name));
  }
  return { id: fund.id, name: fund.name };
}
