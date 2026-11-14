import { GoogleGenAI, Type } from "@google/genai";
import { getDb } from "./_db.js";
import { getCatalogForPrompt } from "./_identity.js";

let ai: GoogleGenAI | null = null;
if (process.env.TPF_AI_Key) {
  ai = new GoogleGenAI({
    apiKey: process.env.TPF_AI_Key,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
}

// Texte de l'email + texte des PDF joints (≈ 30 000 tokens max)
const MAX_TEXT_LENGTH = 120000;

// PDF envoyés tels quels à Gemini (PDF scannés sans texte extractible)
export interface PdfFileForAi {
  filename: string;
  base64: string;
}

// Journalise chaque tentative d'appel à Gemini pour permettre le suivi du quota gratuit (20/jour)
async function logUsage(success: boolean) {
  try {
    const sql = getDb();
    await sql`
      CREATE TABLE IF NOT EXISTS ai_usage_log (
        id SERIAL PRIMARY KEY,
        success BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`INSERT INTO ai_usage_log (success) VALUES (${success})`;
  } catch (err) {
    // La journalisation ne doit jamais faire échouer l'extraction elle-même
    console.error("Erreur de journalisation d'usage IA:", err);
  }
}

// Appel à Gemini avec relance automatique sur les erreurs temporaires (503 serveurs saturés, 500)
// et journalisation de chaque tentative pour le compteur de quota.
export async function generateWithRetry(params: any) {
  if (!ai) throw new Error("Clé Gemini non configurée");
  const RETRY_DELAYS_MS = [3000, 8000];
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await ai.models.generateContent(params);
      await logUsage(true);
      return response;
    } catch (err: any) {
      await logUsage(false);
      const msg = String(err?.message || "");
      const isTransient = err?.status === 503 || err?.status === 500 || /\b(503|500)\b|UNAVAILABLE|high demand|overloaded|INTERNAL/i.test(msg);
      if (isTransient && attempt < RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      if (isTransient) {
        throw new Error(`Gemini est temporairement saturé (erreur 503) après ${attempt + 1} tentatives. Réessaie dans quelques minutes.`);
      }
      throw new Error(`Erreur lors de l'appel à Gemini : ${msg || "erreur inconnue"}`);
    }
  }
}

export function isAiConfigured() {
  return !!ai;
}

export async function runExtraction(emailSubject: string, emailText: string, pdfFiles: PdfFileForAi[] = []) {
  const safeText = emailText.length > MAX_TEXT_LENGTH
    ? emailText.slice(0, MAX_TEXT_LENGTH) + "\n\n[...texte tronqué car trop long...]"
    : emailText;

  if (!ai) {
    const textLower = safeText.toLowerCase();

    const isEmergency = textLower.includes("urgent") || textLower.includes("départ") || textLower.includes("close") || textLower.includes("hard close");
    const assetManager = textLower.includes("robeco") ? "Robeco" : textLower.includes("amundi") ? "Amundi Asset Management" : textLower.includes("jpm") || textLower.includes("jorgan") ? "JP Morgan Asset Management" : "Robeco";
    const fundName = textLower.includes("water") ? "Robeco Sustainable Water" : textLower.includes("emerging") ? "Amundi Emerging Markets Equity" : "Robeco Global Premium Equities";

    return {
      raw_extraction: {
        is_noise: false,
        noise_reason: "",
        asset_manager: assetManager,
        fund_name: fundName,
        sales_email: "sales-expert@robeco.nl",
        report_date: "2026-07-01",
        cash_rate: textLower.includes("cash") ? 4.9 : 3.5,
        performance_pct: textLower.includes("perf") ? 1.4 : -0.2,
        aum_m: 1520,
        key_views: "Maintien des thématiques clés de croissance. Extraction simulée des perspectives fondamentales face à la volatilité de marché actuelle.",
        positioning: "Surpondération de l'Europe cyclique, sous-pondération technologique US.",
        is_emergency: isEmergency,
        emergency_reason: isEmergency ? "Alerte de gestion importante extraite de l'email" : "",
      },
      api_mocked: true,
    };
  }

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      asset_manager: { type: Type.STRING, description: "Name of the asset manager company (gérant)." },
      fund_name: { type: Type.STRING, description: "The official or common name of the investment fund analyzed. If no specific fund is named, use the strategy, team or product named in the subject (never return N/A)." },
      existing_manager_id: { type: Type.STRING, description: "If the asset manager matches one in the KNOWN CATALOG (even if spelled differently), its MANAGER id (e.g. mgr-123). Empty string if it is a new manager." },
      existing_fund_id: { type: Type.STRING, description: "If the fund matches one in the KNOWN CATALOG (same fund under a short, commercial or official name, with or without the manager prefix), its FUND id (e.g. fund-123). Empty string if it is a genuinely new fund." },
      isins: { type: Type.ARRAY, items: { type: Type.STRING }, description: "All ISIN codes of the fund found in the email or attachments (12 characters, e.g. LU0123456789). Empty array if none." },
      sales_email: { type: Type.STRING, description: "The contact/sales email of the emitter or sales representative if visible in text." },
      report_date: { type: Type.STRING, description: "Date of the report or update in YYYY-MM-DD format. Default to today if not clearly specified." },
      cash_rate: { type: Type.NUMBER, description: "The percentage level of cash/liquidity in the fund. Use null if not mentioned." },
      performance_pct: { type: Type.NUMBER, description: "The monthly performance percentage of the fund. Use null if not mentioned." },
      aum_m: { type: Type.NUMBER, description: "Assets Under Management (AUM) in millions. Use null if not mentioned." },
      key_views: { type: Type.STRING, description: "Synthesized fundamental, macro, or micro opinions of the fund manager. Max 3 concise sentences." },
      positioning: { type: Type.STRING, description: "Details of tactical positioning." },
      is_emergency: { type: Type.BOOLEAN, description: "True if the email reports a critical event: manager departure, hard/soft close, major process changes, or regulatory issues." },
      emergency_reason: { type: Type.STRING, description: "Detailed description of the emergency or priority alert, or empty string if none." },
    },
    required: ["asset_manager", "fund_name", "key_views", "positioning", "is_emergency"],
  };

  const systemInstruction = `You are an expert investment analyst AI. Your role is to ingest financial emails and PDF contents from investment fund managers (asset managers) and convert them into a structured database record.

Guidelines:
1. EVERY EMAIL IS RELEVANT: all emails received come from asset managers and must be recorded. Never discard an email. If some figures are missing, use null; if views or positioning are missing, summarize whatever information the email does contain (meeting, event, commentary, attachment mention…).
2. PDF ATTACHMENTS (factsheets, monthly reports, presentations, minutes) usually hold the key figures and views: read them carefully and prioritize their content over the short email cover text.
3. Always identify the asset manager and a fund/strategy name, using the subject, sender signature or forwarded headers if needed.
4. AVOID DUPLICATES: a KNOWN CATALOG of managers and funds already in the database is provided. The same fund is often written differently (e.g. "NinetyOne" vs "Ninety One", "Pan European Small Caps" vs "Horizon Pan European Smaller Companies Fund"). When the email is about a fund of the catalog, set existing_fund_id (and existing_manager_id) to its id. Only leave them empty for a genuinely new fund/manager. Do not match different strategies of the same manager (e.g. "Global Equity" vs "Emerging Markets Equity").
5. EMERGENCY DETECTION: Tag with is_emergency = true if there is an alert like "départ de gérant" (manager departure), "hard close", or "process change". Be highly sensitive to these risk factors.`;

  let catalog = "";
  try {
    catalog = await getCatalogForPrompt();
  } catch (err) {
    console.error("Impossible de charger le catalogue des fonds:", err);
  }

  const userPrompt = (catalog ? `KNOWN CATALOG (existing managers and funds):\n${catalog}\n\n---\n\n` : "") + `Subject: ${emailSubject || "No Subject"}\n\nEmail text (followed by the text of its PDF attachments, if any):\n${safeText}`
    + (pdfFiles.length ? `\n\nAdditional scanned PDF attachments are provided as files: ${pdfFiles.map((f) => f.filename).join(", ")}` : "");

  const contents = pdfFiles.length
    ? [{
        role: "user",
        parts: [
          { text: userPrompt },
          ...pdfFiles.map((f) => ({ inlineData: { mimeType: "application/pdf", data: f.base64 } })),
        ],
      }]
    : userPrompt;

  const response = await generateWithRetry({
    model: "gemini-3.5-flash",
    contents,
    config: { systemInstruction, responseMimeType: "application/json", responseSchema, temperature: 0.1 },
  });

  if (!response.text) {
    throw new Error("Gemini n'a renvoyé aucun contenu exploitable pour ce document.");
  }

  let parsedData;
  try {
    parsedData = JSON.parse(response.text.trim());
  } catch (err) {
    throw new Error("La réponse de Gemini n'était pas un JSON valide (le document est peut-être trop complexe ou mal structuré).");
  }

  // Plus de filtrage "bruit" : tous les emails reçus sont considérés comme pertinents
  parsedData.is_noise = false;
  parsedData.noise_reason = "";

  return { raw_extraction: parsedData, api_mocked: false };
}
