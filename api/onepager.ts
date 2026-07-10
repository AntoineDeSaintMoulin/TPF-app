import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";
import { initialAssetManagers, initialFunds, initialFundReports, initialAnalystOverrides } from "./_data";

let ai: GoogleGenAI | null = null;
if (process.env.TPF_AI_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.TPF_AI_KEY, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { fundId } = req.body;
  const fund = initialFunds.find((f) => f.id === fundId);
  if (!fund) return res.status(404).json({ error: "Fonds non trouvé" });

  const mgr = initialAssetManagers.find((m) => m.id === fund.managerId);
  const fundReps = initialFundReports.filter((r) => r.fundId === fund.id).sort((a, b) => b.reportDate.localeCompare(a.reportDate));
  const latestRep = fundReps[0];
  const override = initialAnalystOverrides.find((o) => o.fundId === fund.id);

  if (!latestRep) return res.status(400).json({ error: "Aucun rapport disponible pour ce fonds" });

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

## 📈 Indicateurs Clés (Dernière Période)
| Indicateur | Valeur | Statut |
| :--- | :---: | :---: |
| **Actifs sous Gestion (AUM)** | **${payload.aum}** | Stable |
| **Taux de Cash** | **${payload.cash}** | ${latestRep.cashRate && latestRep.cashRate > 4 ? "Élevé (Prudent)" : "Normal"} |
| **Performance Mensuelle** | **${payload.perf}** | ${latestRep.performancePct && latestRep.performancePct > 0 ? "Positive 🟢" : "Négative 🔴"} |

---

## 🤖 Vues Extrayées par l'IA (Gemini)
### 🔮 Perspectives Fondamentales
*${payload.aiViews}*

### 🗺️ Positionnement Tactique
*${payload.aiPositioning}*

---

## 👤 Le Coin de l'Analyste (Commentaire Interne)
> **Positionnement validé par l'analyste :**
> *${payload.analystPositioning}*

> **Notes de recherche internes :**
> *${payload.analystComment}*

---
*Ce document est à usage strictement interne - Équipe d'Analyse Multi-Gérance.*`;
    return res.status(200).json({ markdown: mockOnepager, api_mocked: true });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Crée une fiche One-Pager complète et extrêmement professionnelle en français pour le fonds d'investissement suivant :
${JSON.stringify(payload, null, 2)}

Inclus un titre élégant, un tableau d'indicateurs clés (AUM, Cash, Performance), un résumé structuré des vues de gestion de l'IA, et de manière bien mise en évidence, la section "Le Coin de l'Analyste" (avec le commentaire interne de l'analyste et son override). Rédige cela avec brio et professionnalisme.`,
      config: { systemInstruction: `You are a high-end financial analyst presentation builder. You format elegant, direct "One-Pager" sheets in Markdown.` },
    });
    res.status(200).json({ markdown: response.text, api_mocked: false });
  } catch (err: any) {
    console.error("Onepager generation error:", err);
    res.status(500).json({ error: err.message || "Erreur de génération du One-Pager" });
  }
}
