import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractPdfText } from "./_pdf.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  try {
    const { fileBase64 } = req.body;
    if (!fileBase64) return res.status(400).json({ error: "Fichier manquant" });

    const buffer = Buffer.from(fileBase64, "base64");
    const text = await extractPdfText(new Uint8Array(buffer));

    res.status(200).json({ text });
  } catch (error: any) {
    console.error("PDF parse error:", error);
    res.status(500).json({ error: error.message || "Erreur lors de l'extraction du texte du PDF" });
  }
}
