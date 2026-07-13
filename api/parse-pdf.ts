import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  try {
    const { fileBase64 } = req.body;
    if (!fileBase64) return res.status(400).json({ error: "Fichier manquant" });

    const buffer = Buffer.from(fileBase64, "base64");

    // Import dynamique pour éviter les soucis de bundling au démarrage
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);

    res.status(200).json({ text: data.text });
  } catch (error: any) {
    console.error("PDF parse error:", error);
    res.status(500).json({ error: error.message || "Erreur lors de l'extraction du texte du PDF" });
  }
}
