import { GoogleGenAI, Type } from "@google/genai";

let ai: GoogleGenAI | null = null;
if (process.env.TPF_AI_Key) {
  ai = new GoogleGenAI({
    apiKey: process.env.TPF_AI_Key,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
}

// Limite de sécurité pour éviter de dépasser les capacités du modèle sur de très longs documents
const MAX_TEXT_LENGTH = 25000;

export async function runExtraction(emailSubject: string, emailText: string) {
  const safeText = emailText.length > MAX_TEXT_LENGTH
    ? emailText.slice(0, MAX_TEXT_LENGTH) + "\n\n[...texte tronqué car trop long...]"
    : emailText;

  if (!ai) {
    const textLower = safeText.toLowerCase();

    if (textLower.includes("webinaire") || textLower.includes("newsletter d'été") || textLower.includes("offre d'abonnement")) {
      return {
        raw_extraction: {
          is_noise: true,
          noise_reason: "Détecté comme invitation publicitaire ou webinaire commercial sans valeur d'analyse fondamentale.",
          asset_manager: textLower.includes("robeco") ? "Robeco" : "Gérant Inconnu",
          fund_name: "N/A",
          sales_email: "marketing@assetmanager.com",
          report_date: new Date().toISOString().split("T")[0],
          cash_rate: null,
          performance_pct: null,
          aum_m: null,
          key_views: "",
          positioning: "",
          is_emergency: false,
          emergency_reason: "",
        },
        api_mocked: true,
      };
    }

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
      is_noise: { type: Type.BOOLEAN, description: "True if this email is a webinar invitation, generic commercial newsletter, spam, or out-of-office message with NO fundamental or quantitative fund metrics." },
      noise_reason: { type: Type.STRING, description: "Explanation of why the email is categorized as noise, or empty string if not noise." },
      asset_manager: { type: Type.STRING, description: "Name of the asset manager company (gérant)." },
      fund_name: { type: Type.STRING, description: "The official or common name of the investment fund analyzed." },
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
    required: ["is_noise", "asset_manager", "fund_name", "key_views", "positioning", "is_emergency"],
  };

  const systemInstruction = `You are an expert investment analyst AI. Your role is to ingest financial emails and PDF contents from investment fund managers (asset managers) and convert them into a structured database record.

Strict filtering guidelines:
1. INVITS & NEWSLETTERS: Commercial webinar invitations, product marketing newsletters with no specific fund figures, and OOO messages must have is_noise = true.
2. FUND UPDATES: Emails/documents with actual key views, fund positioning, or figures (AUM, cash rate, performance) must have is_noise = false.
3. EMERGENCY DETECTION: Tag with is_emergency = true if there is an alert like "départ de gérant" (manager departure), "hard close", or "process change". Be highly sensitive to these risk factors.`;

  const userPrompt = `Subject: ${emailSubject || "No Subject"}\n\nEmail Text:\n${safeText}`;

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: { systemInstruction, responseMimeType: "application/json", responseSchema, temperature: 0.1 },
    });
  } catch (err: any) {
    throw new Error(`Erreur lors de l'appel à Gemini : ${err.message || "erreur inconnue"}`);
  }

  if (!response.text) {
    throw new Error("Gemini n'a renvoyé aucun contenu exploitable pour ce document.");
  }

  let parsedData;
  try {
    parsedData = JSON.parse(response.text.trim());
  } catch (err) {
    throw new Error("La réponse de Gemini n'était pas un JSON valide (le document est peut-être trop complexe ou mal structuré).");
  }

  return { raw_extraction: parsedData, api_mocked: false };
}
