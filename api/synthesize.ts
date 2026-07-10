import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";
import { initialAssetManagers, initialFunds, initialFundReports } from "./_data.js";

let ai: GoogleGenAI | null = null;
if (process.env.TPF_AI_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.TPF_AI_KEY, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { managerIds } = req.body;
  if (!managerIds || !Array.isArray(managerIds) || managerIds.length === 0) {
    return res.status(400).json({ error: "Veuillez sélectionner au moins un gérant." });
  }

  const selectedManagers = initialAssetManagers.filter((m) => managerIds.includes(m.id));
  const managerNames = selectedManagers.map((m) => m.name);
  const matchedFunds = initialFunds.filter((f) => managerIds.includes(f.managerId));

  const reportsContext = matchedFunds
    .map((fund) => {
      const fundReps = initialFundReports.filter((r) => r.fundId === fund.id);
      if (fundReps.length === 0) return null;
      const latestRep = fundReps.sort((a, b) => b.reportDate.localeCompare(a.reportDate))[0];
      const mgr = initialAssetManagers.find((m) => m.id === fund.managerId);
      return { managerName: mgr?.name, fundName: fund.name, date: latestRep.reportDate, keyViews: latestRep.keyViews, positioning: latestRep.positioning };
    })
    .filter(Boolean);

  if (reportsContext.length === 0) {
    return res.status(200).json({ summary: "Aucune donnée de rapport récente disponible pour les gérants sélectionnés afin d'effectuer la synthèse." });
  }

  if (!ai) {
    const mockSummary = [
      `• Consensus global : Prudence de rigueur sur la Tech US en raison de valorisations tendues.`,
      `• Divergence marquée : Robeco privilégie l'Europe Value et cyclique, tandis que JP Morgan maintient un biais offensif de leadership industriel mondial.`,
      `• Gestion du cash : Robeco augmente tactiquement ses liquidités (5.5%) alors que Amundi et JP Morgan restent pleinement investis (cash inférieur à 2.5%).`,
      `• Alerte Majeure : Transition d'équipe critique en cours chez Amundi Horizon suite au départ surprise du gérant historique Jean-Marc Dupuis.`,
      `• Biais Sectoriels : Préférence partagée pour le secteur de la santé, considéré comme un refuge défensif face aux incertitudes monétaires.`,
    ].join("\n");
    return res.status(200).json({ summary: mockSummary, api_mocked: true });
  }

  const promptText = `Gérants sélectionnés : ${managerNames.join(", ")}

Données de marché & Vues de gestion actuelles :
${JSON.stringify(reportsContext, null, 2)}

Rédige une synthèse comparée en français de leurs vues de marché et de leur positionnement actuel sous la forme d'exactement 5 puces claires et synthétiques (sans intro superflue, idéal pour des analystes financiers). Concentre-toi sur les consensus et les divergences d'opinion.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: { systemInstruction: "Tu es un adjoint d'analyse de fonds d'investissement. Tu rédiges des notes de synthèse financières directes, techniques et ultra-pertinentes." },
    });
    res.status(200).json({ summary: response.text, api_mocked: false });
  } catch (error: any) {
    console.error("Gemini Synthesis Error:", error);
    res.status(500).json({ error: error.message || "Erreur lors de la génération de la synthèse" });
  }
}
