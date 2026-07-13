import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";
import { getDb } from "./_db.js";

let ai: GoogleGenAI | null = null;
if (process.env.TPF_AI_Key) {
  ai = new GoogleGenAI({ apiKey: process.env.TPF_AI_Key, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

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
    return res.status(200).json({ markdown: mockOnepager, api_mocked: true });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Crée une fiche One-Pager complète et extrêmement professionnelle en français pour le fonds d'investissement suivant :
${JSON.stringify(payload, null, 2)}`,
      config: { systemInstruction: `You are a high-end financial analyst presentation builder. You format elegant, direct "One-Pager" sheets in Markdown.` },
    });
    res.status(200).json({ markdown: response.text, api_mocked: false });
  } catch (err: any) {
    console.error("Onepager generation error:", err);
    res.status(500).json({ error: err.message || "Erreur de génération du One-Pager" });
  }
}
