import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getGmailClient, extractPlainTextBody, getHeader } from "./_gmail.js";
import { runExtraction } from "./_extract-logic.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Sécurise l'endpoint : seul le Cron Job Vercel (ou toi manuellement avec le bon secret) peut le déclencher
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Non autorisé" });
  }

  try {
    const gmail = getGmailClient();

    // 1. Récupère les emails non lus dans la boîte de réception
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread in:inbox",
      maxResults: 20,
    });

    const messages = listRes.data.messages || [];
    const results: any[] = [];

    for (const msg of messages) {
      if (!msg.id) continue;

      // 2. Récupère le contenu complet de chaque email
      const fullMsg = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      });

      const headers = fullMsg.data.payload?.headers || [];
      const subject = getHeader(headers, "Subject");
      const body = extractPlainTextBody(fullMsg.data.payload);

      if (!body || body.trim().length === 0) {
        results.push({ id: msg.id, subject, status: "skipped_empty_body" });
        continue;
      }

      // 3. Passe l'email dans la même logique d'extraction IA que /api/extract
      let extraction;
      try {
        extraction = await runExtraction(subject, body);
      } catch (err: any) {
        results.push({ id: msg.id, subject, status: "extraction_failed", error: err.message });
        continue;
      }

      // 4. Marque l'email comme lu pour ne pas le retraiter au prochain cycle
      await gmail.users.messages.modify({
        userId: "me",
        id: msg.id,
        requestBody: { removeLabelIds: ["UNREAD"] },
      });

      results.push({
        id: msg.id,
        subject,
        status: "processed",
        is_noise: extraction.raw_extraction.is_noise,
        fund_name: extraction.raw_extraction.fund_name,
      });
    }

    res.status(200).json({
      success: true,
      processedCount: results.length,
      results,
    });
  } catch (error: any) {
    console.error("Gmail Sync Error:", error);
    res.status(500).json({ error: error.message || "Erreur lors de la synchronisation Gmail" });
  }
}
