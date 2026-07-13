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
  const { managerIds } = req.body;
  if (!managerIds || !Array.isArray(managerIds) || managerIds.length === 0) {
    return res.status(400).json({ error: "Veuillez sélectionner au moins un gérant." });
  }

  const assetManagers = await sql`SELECT id, name FROM asset_managers WHERE id = ANY(${managerIds})`;
  const funds = await sql`SELECT id, manager_id AS "managerId", name FROM funds WHERE manager_id = ANY(${managerIds})`;

  const managerNames = (assetManagers as any[]).map((m) => m.name);
  const reportsContext = [];

  for (const fund of funds as any[]) {
    const reps = await sql`
      SELECT report_date AS "reportDate", key_views AS "keyViews", positioning
      FROM fund_reports WHERE fund_id = ${fund.id}
      ORDER BY report_date DESC LIMIT 1
    `;
    if (reps.length === 0) continue;
    const mgr = (assetManagers as any[]).find((m) => m.id === fund.managerId);
    reportsContext.push({
      managerName: mgr?.name,
      fundName: fund.name,
      date: reps[0].reportDate,
      keyViews: reps[0].keyViews,
      positioning: reps[0].positioning,
    });
  }

  if (reportsContext.length === 0) {
    return res.status(200).json({ summary: "Aucune donnée de rapport récente disponible pour les gérants sélectionnés afin d'effectuer la synthèse." });
  }

  if (!ai) {
    const mockSummary = [
      `• Consensus global : Prudence de rigueur sur la Tech US en raison de valorisations tendues.`,
      `• Divergence marquée entre les gérants sélectionnés sur le positionnement géographique.`,
      `• Gestion du cash variable selon les gérants.`,
      `• Biais Sectoriels : Préférence partagée pour le secteur de la santé.`,
    ].join("\n");
    return res.status(200).json({ summary: mockSummary, api_mocked: true });
  }

  const promptText = `Gérants sélectionnés : ${managerNames.join(", ")}

Données de marché & Vues de gestion actuelles :
${JSON.stringify(reportsContext, null, 2)}

Rédige une synthèse comparée en français de leurs vues de marché et de leur positionnement actuel sous la forme d'exactement 5 puces claires et synthétiques.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: { systemInstruction: "Tu es un adjoint d'analyse de fonds d'investissement." },
    });
    res.status(200).json({ summary: response.text, api_mocked: false });
  } catch (error: any) {
    console.error("Gemini Synthesis Error:", error);
    res.status(500).json({ error: error.message || "Erreur lors de la génération de la synthèse" });
  }
}
