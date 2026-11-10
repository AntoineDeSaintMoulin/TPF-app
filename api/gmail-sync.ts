import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getGmailClient, extractPlainTextBody, getHeader } from "./_gmail.js";
import { runExtraction } from "./_extract-logic.js";
import { saveExtractedReport } from "./_persist.js";

// Événements envoyés au navigateur en mode "stream" (un objet JSON par ligne)
type SyncEvent =
  | { type: "step"; message: string }
  | { type: "found"; count: number }
  | { type: "email_start"; index: number; total: number; id: string; subject: string }
  | { type: "email_step"; index: number; message: string }
  | { type: "email_result"; index: number; result: any }
  | { type: "done"; processedCount: number; results: any[] }
  | { type: "error"; message: string };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Cette route est appelée à la fois par le Cron Job automatique (avec le header
  // CRON_SECRET envoyé automatiquement par Vercel) et par le bouton manuel dans l'app
  // (sans ce header, puisque l'app tourne côté navigateur). On accepte donc les deux.
  const authHeader = req.headers.authorization;
  const isCronCall = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isManualCall = !authHeader; // appel depuis le bouton de l'app, sans header d'autorisation

  if (!isCronCall && !isManualCall) {
    return res.status(401).json({ error: "Non autorisé" });
  }

  // Mode "stream" : utilisé par le bouton de l'app pour afficher la progression en direct.
  // Sans ce paramètre (Cron), on renvoie une réponse JSON unique comme avant.
  const streaming = req.query.stream === "1";

  if (streaming) {
    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    (res as any).flushHeaders?.();
  }

  const emit = (event: SyncEvent) => {
    if (streaming) res.write(JSON.stringify(event) + "\n");
  };

  try {
    emit({ type: "step", message: "Connexion à Gmail…" });
    const gmail = getGmailClient();

    emit({ type: "step", message: "Recherche des emails non lus dans la boîte de réception…" });
    const listRes = await gmail.users.messages.list({
      userId: "me",
      // Exclut les alertes de sécurité automatiques de Google (connexion de l'app, etc.)
      q: "is:unread in:inbox -from:no-reply@accounts.google.com",
      maxResults: 20,
    });

    const messages = (listRes.data.messages || []).filter((m) => !!m.id);
    emit({ type: "found", count: messages.length });

    const results: any[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const id = msg.id as string;

      const pushResult = (result: any) => {
        results.push(result);
        emit({ type: "email_result", index: i, result });
      };

      const fullMsg = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "full",
      });

      const headers = fullMsg.data.payload?.headers || [];
      const subject = getHeader(headers, "Subject");
      emit({ type: "email_start", index: i, total: messages.length, id, subject });

      const body = extractPlainTextBody(fullMsg.data.payload);

      if (!body || body.trim().length === 0) {
        pushResult({ id, subject, status: "skipped_empty_body" });
        continue;
      }

      emit({ type: "email_step", index: i, message: "Analyse par l'IA (Gemini)…" });
      let extraction;
      try {
        extraction = await runExtraction(subject, body);
      } catch (err: any) {
        pushResult({ id, subject, status: "extraction_failed", error: err.message });
        continue;
      }

      emit({ type: "email_step", index: i, message: "Enregistrement en base de données…" });
      let saveResult: { saved: boolean; reason?: string };
      try {
        saveResult = await saveExtractedReport(extraction.raw_extraction, subject, body);
      } catch (err: any) {
        pushResult({ id, subject, status: "save_failed", error: err.message });
        continue;
      }

      emit({ type: "email_step", index: i, message: "Marquage de l'email comme lu…" });
      await gmail.users.messages.modify({
        userId: "me",
        id,
        requestBody: { removeLabelIds: ["UNREAD"] },
      });

      pushResult({
        id,
        subject,
        status: saveResult.saved ? "processed" : "not_saved",
        reason: saveResult.reason,
        fund_name: extraction.raw_extraction.fund_name,
        is_emergency: extraction.raw_extraction.is_emergency,
        api_mocked: extraction.api_mocked,
      });
    }

    if (streaming) {
      emit({ type: "done", processedCount: results.length, results });
      res.end();
    } else {
      res.status(200).json({ success: true, processedCount: results.length, results });
    }
  } catch (error: any) {
    console.error("Gmail Sync Error:", error);
    const message = error.message || "Erreur lors de la synchronisation Gmail";
    if (streaming) {
      emit({ type: "error", message });
      res.end();
    } else {
      res.status(500).json({ error: message });
    }
  }
}
