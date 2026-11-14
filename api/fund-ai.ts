import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";
import { getDb } from "./_db.js";
import { generateWithRetry, isAiConfigured } from "./_extract-logic.js";
import { ensureIdentitySchema } from "./_identity.js";

// Fonctions d'IA sur un fonds, regroupées dans une seule route (limite de 12 routes du plan Vercel) :
//   action "onepager" (par défaut) : fiche One-Pager en Markdown
//   action "ask"                   : question libre sur le fonds, réponse fondée sur ses rapports

let ai: GoogleGenAI | null = null;
if (process.env.TPF_AI_Key) {
  ai = new GoogleGenAI({ apiKey: process.env.TPF_AI_Key, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  if (req.body?.action === "ask") return handleAsk(req, res);
  return handleOnepager(req, res);
}

const MAX_BODY_CHARS_PER_REPORT = 20000;
const MAX_CONTEXT_CHARS = 180000;

async function handleAsk(req: VercelRequest, res: VercelResponse) {
  const { fundId, question, history } = req.body || {};
  if (!fundId) return res.status(400).json({ error: "Fonds manquant" });
  if (!question || !String(question).trim()) return res.status(400).json({ error: "Question vide" });

  try {
    await ensureIdentitySchema();
    const sql = getDb();
    const funds = (await sql`
      SELECT f.id, f.name, f.analyst_id, f.isins, m.name AS manager_name
      FROM funds f JOIN asset_managers m ON m.id = f.manager_id
      WHERE f.id = ${fundId}
    `) as any[];
    if (funds.length === 0) return res.status(404).json({ error: "Fonds non trouvé" });
    const fund = funds[0];

    const reports = (await sql`
      SELECT report_date, cash_rate, performance_pct, aum_m, key_views, positioning,
             urgency_level, urgency_reason, raw_email_subject, raw_email_body
      FROM fund_reports WHERE fund_id = ${fundId}
      ORDER BY report_date DESC, created_at DESC
    `) as any[];
    const overrides = (await sql`SELECT positioning_override, analyst_comment FROM analyst_overrides WHERE fund_id = ${fundId}`) as any[];

    if (reports.length === 0) {
      return res.status(200).json({ answer: "Je n'ai encore aucun rapport pour ce fonds : impossible de répondre sans source.", sources: 0 });
    }

    if (!isAiConfigured()) {
      return res.status(200).json({
        answer: `(Mode simulé, clé Gemini absente) ${reports.length} rapport(s) disponibles pour ${fund.name}. Dernières vues : ${reports[0].key_views || "—"}`,
        sources: reports.length,
        api_mocked: true,
      });
    }

    // Contexte : tous les rapports du fonds (du plus récent au plus ancien), avec le texte des emails et PDF
    let context = "";
    let included = 0;
    for (const r of reports) {
      const body = String(r.raw_email_body || "");
      const block = [
        `### Rapport du ${r.report_date}${r.raw_email_subject ? ` — « ${r.raw_email_subject} »` : ""}`,
        `Cash : ${r.cash_rate ?? "n.c."} % | Performance : ${r.performance_pct ?? "n.c."} % | Encours : ${r.aum_m ?? "n.c."} M`,
        r.urgency_level === "Prioritaire" ? `ALERTE : ${r.urgency_reason || ""}` : "",
        `Vues de gestion (résumé IA) : ${r.key_views || "—"}`,
        `Positionnement (résumé IA) : ${r.positioning || "—"}`,
        body ? `Texte source (email + PDF joints) :\n${body.length > MAX_BODY_CHARS_PER_REPORT ? body.slice(0, MAX_BODY_CHARS_PER_REPORT) + "\n[...tronqué...]" : body}` : "",
      ].filter(Boolean).join("\n");
      if (context.length + block.length > MAX_CONTEXT_CHARS && included > 0) break;
      context += block + "\n\n";
      included++;
    }

    const ov = overrides[0];
    const header = [
      `Fonds : ${fund.name}`,
      `Société de gestion : ${fund.manager_name}`,
      `Analyste interne : ${fund.analyst_id}`,
      fund.isins?.length ? `ISIN : ${fund.isins.join(", ")}` : "",
      ov?.analyst_comment ? `Commentaire de l'analyste interne : ${ov.analyst_comment}` : "",
      ov?.positioning_override ? `Positionnement corrigé par l'analyste : ${ov.positioning_override}` : "",
      `${reports.length} rapport(s) au total, ${included} fourni(s) ci-dessous.`,
    ].filter(Boolean).join("\n");

    const pastTurns = Array.isArray(history)
      ? history.slice(-6).map((h: any) => `${h.role === "user" ? "Question" : "Réponse"} : ${String(h.text || "").slice(0, 2000)}`).join("\n")
      : "";

    const prompt = `${header}

=== RAPPORTS DU FONDS ===
${context}
${pastTurns ? `=== ÉCHANGES PRÉCÉDENTS ===\n${pastTurns}\n\n` : ""}=== QUESTION ===
${String(question).slice(0, 2000)}`;

    const response = await generateWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.2,
        systemInstruction: `Tu es l'assistant d'une équipe de sélection de fonds. Tu réponds en français, de façon concise et factuelle, à des questions sur UN fonds, uniquement à partir des rapports fournis (emails, PDF joints, chiffres extraits, commentaires internes).
Règles :
- Cite la date du rapport d'où vient chaque information importante, par exemple « (rapport du 2026-09-15) ».
- Si l'information n'est pas dans les rapports, dis-le clairement (« Je ne trouve pas cette information dans les rapports reçus ») et n'invente rien.
- Pour les évolutions dans le temps (cash, performance, positionnement), compare les rapports successifs.
- Format : Markdown simple (puces, gras), sans titre.`,
      },
    });

    res.status(200).json({ answer: response.text || "Pas de réponse.", sources: included, totalReports: reports.length });
  } catch (err: any) {
    console.error("Fund ask error:", err);
    res.status(500).json({ error: err.message || "Erreur lors de la question à l'IA" });
  }
}

async function handleOnepager(req: VercelRequest, res: VercelResponse) {
  const sql = getDb();
  const { fundId } = req.body;

  const funds = await sql`SELECT id, manager_id AS "managerId", name, analyst_id AS "analystId" FROM funds WHERE id = ${fundId}`;
  if (funds.length === 0) return res.status(404).json({ error: "Fonds non trouvé" });
  const fund = funds[0] as any;

  const managers = await sql`SELECT name FROM asset_managers WHERE id = ${fund.managerId}`;
  const mgr = managers[0] as any;

  const reps = await sql`
    SELECT report_date AS "reportDate", cash_rate AS "cashRate", performance_pct AS "performancePct", aum_m AS "aumM", key_views AS "keyViews", positioning
    FROM fund_reports WHERE fund_id = ${fundId} ORDER BY report_date DESC LIMIT 1
  `;
  if (reps.length === 0) return res.status(400).json({ error: "Aucun rapport disponible pour ce fonds" });
  const latestRep = reps[0] as any;

  const overrides = await sql`SELECT positioning_override AS "positioningOverride", analyst_comment AS "analystComment" FROM analyst_overrides WHERE fund_id = ${fundId}`;
  const override = overrides[0] as any;

  const payload = {
    manager: mgr?.name,
    fundName: fund.name,
    analyst: fund.analystId,
    latestDate: latestRep.reportDate,
    aum: latestRep.aumM ? `${latestRep.aumM}M` : "N/A",
    cash: latestRep.cashRate ? `${latestRep.cashRate}%` : "N/A",
    perf: latestRep.performancePct ? `${latestRep.performancePct}%` : "N/A",
    aiViews: latestRep.keyViews,
    aiPositioning: latestRep.positioning,
    analystComment: override?.analystComment || "Aucun commentaire interne renseigné.",
    analystPositioning: override?.positioningOverride || "Identique aux vues IA (pas d'override).",
  };

  if (!ai) {
    const mockOnepager = `# 📄 Fiche Synthèse : ${payload.fundName}

## 🏛️ Informations Générales
- **Société de Gestion :** ${payload.manager}
- **Analyste Responsable :** **${payload.analyst}**
- **Date de mise à jour :** ${payload.latestDate}

---

## 📈 Indicateurs Clés
| Indicateur | Valeur |
| :--- | :---: |
| **AUM** | **${payload.aum}** |
| **Cash** | **${payload.cash}** |
| **Performance** | **${payload.perf}** |

---

## 🤖 Vues IA
*${payload.aiViews}*

### Positionnement
*${payload.aiPositioning}*

---

## 👤 Coin de l'Analyste
> *${payload.analystPositioning}*
> *${payload.analystComment}*`;
    return res.status(200).json({ markdown: mockOnepager, fundName: payload.fundName, managerName: payload.manager, api_mocked: true });
  }

  try {
    const response = await generateWithRetry({
      model: "gemini-3.5-flash",
      contents: `Crée une fiche One-Pager complète et extrêmement professionnelle en français pour le fonds d'investissement suivant :
${JSON.stringify(payload, null, 2)}`,
      config: {
        temperature: 0.3,
        systemInstruction: `You are a high-end financial analyst presentation builder. You write elegant, direct "One-Pager" fund sheets in French, exported to a Word document that must fit on ONE A4 page.
Strict Markdown format (it is converted to Word):
- Start with a single "# " title (fund name).
- Use "## " for 4 to 6 sections (e.g. Informations générales, Indicateurs clés, Vues de gestion, Positionnement, Avis de l'analyste, Points de vigilance).
- Use "- " bullets and **bold** for emphasis; key figures in a Markdown table (| Indicateur | Valeur |).
- No emojis, no HTML, no code blocks, no images. Be concise.`,
      },
    });
    res.status(200).json({ markdown: response.text, fundName: payload.fundName, managerName: payload.manager, api_mocked: false });
  } catch (err: any) {
    console.error("Onepager generation error:", err);
    res.status(500).json({ error: err.message || "Erreur de génération du One-Pager" });
  }
}
