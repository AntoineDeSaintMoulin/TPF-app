import React, { useState } from "react";
import { FileCode, Terminal, Copy, Check, Info, Cpu, Sparkles, BookOpen } from "lucide-react";

export default function ResourcesPortal() {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const systemPrompt = `=== SYSTEM INSTRUCTION FOR GEMINI PROMPT ===

ROLE:
You are an expert investment analyst AI supporting a multi-manager investment research team. Your goal is to parse financial emails, bulletins, and PDF report contents from asset management companies, filter out non-essential commercial noise, and extract key views, positioning and metrics into a precise, structured JSON.

strict_guidelines:
1. INVITS, ADS & NOISE: Webinar invitations, sales pitches with no specific fund figures, newsletters with general summaries and NO fund-specific figures or managers' fundamental views, or out-of-office autoreplies must have is_noise = true.
2. FUND UPDATES: Emails or documents containing specific monthly reports, actual key views, fund positioning, or figures (AUM, cash rate, performance) must have is_noise = false.
3. EMERGENCY DETECTION: You must tag with is_emergency = true if there is an alert regarding:
   - Departure of a fund manager (départ de gérant)
   - Hard close or soft close of the fund (fermeture de fonds)
   - Fundamental changes in the investment process (changement de processus)
   - Major regulatory, compliance, or liquidity warnings.
   Be highly sensitive to these risk factors. Give a clear, explicit explanation in emergency_reason.

OUTPUT_FORMAT:
You must output a single JSON object adhering strictly to this JSON schema:

{
  "is_noise": boolean, /* True if webinar invitation, spam, general commercial ad, OOO. */
  "noise_reason": string, /* Explanation of noise classification (or empty string if not noise) */
  "asset_manager": string, /* The name of the Asset Management company (e.g., 'Robeco', 'Amundi Asset Management') */
  "fund_name": string, /* Official name of the fund. Set to 'N/A' if is_noise is true. */
  "sales_email": string, /* Contact or sender email for sales representatives if mentioned in text */
  "report_date": string, /* Format YYYY-MM-DD. Use the end date of the report or the email send date. */
  "cash_rate": number | null, /* Percentage of cash/liquidity in the fund, e.g., 5.5 for 5.5%. null if not found. */
  "performance_pct": number | null, /* Monthly performance percentage, e.g., 2.40 for +2.4%, -1.25 for -1.25%. null if not found. */
  "aum_m": number | null, /* Assets Under Management (AUM) in millions (EUR/USD), e.g., 1450.5 for 1450.5M. null if not found. */
  "key_views": string, /* Synthesized macro, micro, and fundamental opinions of the fund manager. Max 3 concise sentences. */
  "positioning": string, /* Details of tactical positioning (overweights, underweights, styles, sector allocations). */
  "is_emergency": boolean, /* True if there is a critical alert (manager departure, close, process change, etc.) */
  "emergency_reason": string /* Detailed description of the emergency or alert, or empty string if none. */
}`;

  const pythonStreamlitCode = `import streamlit as st
import sqlite3
import pandas as pd
import json
import os
from google import genai
from google.genai import types

# --- 1. INITIALISATION DE L'API GEMINI & DE LA BDD ---
# Remarque : La bibliothèque @google/genai s'initialise via genai.Client()
# qui lit automatiquement la variable d'environnement GEMINI_API_KEY.
def get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        st.warning("⚠️ Clé GEMINI_API_KEY non détectée. Veuillez la configurer dans vos variables d'environnement.")
        return None
    return genai.Client()

def init_db():
    conn = sqlite3.connect("asset_management_intel.db")
    c = conn.cursor()
    # Création des tables conformes
    c.execute("""
    CREATE TABLE IF NOT EXISTS asset_managers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        sales_contacts TEXT
    )""")
    c.execute("""
    CREATE TABLE IF NOT EXISTS funds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        manager_id INTEGER,
        name TEXT UNIQUE,
        analyst_id TEXT DEFAULT 'Unknown',
        FOREIGN KEY(manager_id) REFERENCES asset_managers(id)
    )""")
    c.execute("""
    CREATE TABLE IF NOT EXISTS fund_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fund_id INTEGER,
        report_date TEXT,
        cash_rate REAL,
        performance_pct REAL,
        aum_m REAL,
        key_views TEXT,
        positioning TEXT,
        urgency_level TEXT DEFAULT 'Normal',
        urgency_reason TEXT,
        raw_subject TEXT,
        extracted_by_ai INTEGER DEFAULT 1,
        FOREIGN KEY(fund_id) REFERENCES funds(id)
    )""")
    c.execute("""
    CREATE TABLE IF NOT EXISTS analyst_overrides (
        fund_id INTEGER PRIMARY KEY,
        positioning_override TEXT,
        analyst_comment TEXT,
        FOREIGN KEY(fund_id) REFERENCES funds(id)
    )""")
    c.execute("""
    CREATE TABLE IF NOT EXISTS assignment_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT UNIQUE,
        analyst_id TEXT
    )""")
    
    # Insertion de quelques règles par défaut si vides
    c.execute("SELECT COUNT(*) FROM assignment_rules")
    if c.fetchone()[0] == 0:
        rules = [("Horizon Global", "Benoit"), ("Global Premium", "Damien"), 
                 ("Global Focus", "Maxime"), ("Water", "Antoine")]
        c.executemany("INSERT INTO assignment_rules (pattern, analyst_id) VALUES (?, ?)", rules)
        
    conn.commit()
    return conn

# --- 2. FONCTION DE PARSING AVEC LE SDK GOOGLE GEN AI ---
def extract_email_data_with_gemini(client, text_content, subject=""):
    system_instruction = """Tu es un expert en finance de marché. Ingeste cet email d'un gérant de fonds. 
Filtre le bruit (webinaires, pubs) avec is_noise = true.
Extrais les chiffres clés (Cash, Performance, AUM), les vues macro (key_views), le positionnement et les alertes (is_emergency = true en cas de départ de gérant, hard close, etc.).
Fournis obligatoirement un objet JSON conforme au schéma."""

    # Définition rigoureuse du schéma pour la réponse structurée
    response_schema = types.Schema(
        type=types.Type.OBJECT,
        properties={
            "is_noise": types.Schema(type=types.Type.BOOLEAN, description="True si invitation webinaire, pub générale, newsletter commerciale sans valeur."),
            "noise_reason": types.Schema(type=types.Type.STRING, description="Raison du rejet si noise"),
            "asset_manager": types.Schema(type=types.Type.STRING, description="Société de gestion (ex: Amundi, Robeco)"),
            "fund_name": types.Schema(type=types.Type.STRING, description="Nom complet du fonds d'investissement"),
            "sales_email": types.Schema(type=types.Type.STRING, description="Email commercial de l'émetteur"),
            "report_date": types.Schema(type=types.Type.STRING, description="Date du rapport au format AAAA-MM-JJ"),
            "cash_rate": types.Schema(type=types.Type.NUMBER, description="Taux de cash en % (ex: 5.5)"),
            "performance_pct": types.Schema(type=types.Type.NUMBER, description="Performance mensuelle en % (ex: 1.8)"),
            "aum_m": types.Schema(type=types.Type.NUMBER, description="Actifs sous gestion en millions (ex: 1450)"),
            "key_views": types.Schema(type=types.Type.STRING, description="Vues de gestion fondamentales (max 3 phrases)"),
            "positioning": types.Schema(type=types.Type.STRING, description="Positionnement sectoriel/géographique"),
            "is_emergency": types.Schema(type=types.Type.BOOLEAN, description="True si départ de gérant, hard close ou changement fondamental de process."),
            "emergency_reason": types.Schema(type=types.Type.STRING, description="Description de l'urgence si is_emergency est True")
        },
        required=["is_noise", "asset_manager", "fund_name", "key_views", "positioning", "is_emergency"]
    )

    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=f"Subject: {subject}\\n\\nText:\\n{text_content}",
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=response_schema,
                temperature=0.1
            )
        )
        # Parse la réponse JSON
        return json.loads(response.text)
    except Exception as e:
        st.error(f"Erreur d'extraction : {str(e)}")
        return None

# --- 3. CONCEPTION DE L'INTERFACE STREAMLIT (3 NIVEAUX) ---
def main():
    st.set_page_config(page_title="AM Augmented Intelligence Portal", layout="wide")
    st.title("💼 Portail d'Intelligence Augmentée - Analyse de Fonds")
    
    conn = init_db()
    client = get_gemini_client()
    
    # Navigation latérale
    menu = ["Tableau de Bord", "Ingestion In-Box", "Règles d'Attribution"]
    choice = st.sidebar.selectbox("Navigation", menu)
    
    # --- ONGLET 1 : TABLEAU DE BORD (3 NIVEAUX) ---
    if choice == "Tableau de Bord":
        st.subheader("📊 Supervision Générale des Fonds & Analystes")
        
        # Récupération des données globales
        df_mgr = pd.read_sql_query("SELECT * FROM asset_managers", conn)
        
        if df_mgr.empty:
            st.info("ℹ️ Aucune donnée disponible. Veuillez ingérer des emails dans l'onglet 'Ingestion In-Box'.")
            return

        # NIVEAU 1 : Choix de l'Asset Manager
        col1, col2 = st.columns([1, 3])
        with col1:
            st.markdown("### 🏛️ Niveau 1 : Le Gérant")
            selected_mgr_name = st.selectbox("Sélectionner un Asset Manager", df_mgr["name"].tolist())
            mgr_row = df_mgr[df_mgr["name"] == selected_mgr_name].iloc[0]
            st.info(f"📧 Sales Contacts : {mgr_row['sales_contacts']}")
            
        with col2:
            st.markdown("### 📈 Niveau 2 : Les Fonds du Gérant")
            df_funds = pd.read_sql_query(f"SELECT * FROM funds WHERE manager_id = {mgr_row['id']}", conn)
            
            if df_funds.empty:
                st.write("Aucun fonds enregistré pour ce gérant.")
            else:
                st.dataframe(df_funds, use_container_width=True)
                
                # NIVEAU 3 : Visualisation & Actions d'un Fonds
                st.markdown("### 🔍 Niveau 3 : Fiche Détail & Historique")
                selected_fund_name = st.selectbox("Choisir un fonds pour analyse approfondie", df_funds["name"].tolist())
                fund_row = df_funds[df_funds["name"] == selected_fund_name].iloc[0]
                fund_id = fund_row['id']
                
                st.write(f"Analyste Affecté : **{fund_row['analyst_id']}**")
                
                # Affichage des graphes de tendances
                df_reps = pd.read_sql_query(f"SELECT * FROM fund_reports WHERE fund_id = {fund_id} ORDER BY report_date ASC", conn)
                
                if not df_reps.empty:
                    # Graphes interactifs
                    col_graph1, col_graph2 = st.columns(2)
                    with col_graph1:
                        st.line_chart(df_reps.set_index("report_date")[["cash_rate"]], y_label="Taux de Cash (%)")
                    with col_graph2:
                        st.line_chart(df_reps.set_index("report_date")[["performance_pct"]], y_label="Performance Mensuelle (%)")
                    
                    # Dernières vues IA
                    latest_rep = df_reps.iloc[-1]
                    st.success(f"🤖 **Dernières Vues IA (Rapport du {latest_rep['report_date']})** : {latest_rep['key_views']}")
                    st.text(f"Positionnement Tactique IA : {latest_rep['positioning']}")
                    
                    if latest_rep["urgency_level"] == "Prioritaire":
                        st.error(f"🚨 **ALERTE PRIORITAIRE :** {latest_rep['urgency_reason']}")
                
                # LE COIN DE L'ANALYSTE (Override Manuel)
                st.markdown("---")
                st.markdown("### 👤 Le Coin de l'Analyste")
                
                # Charger l'override existant
                cur = conn.cursor()
                cur.execute("SELECT positioning_override, analyst_comment FROM analyst_overrides WHERE fund_id = ?", (int(fund_id),))
                override = cur.fetchone()
                
                init_override = override[0] if override else ""
                init_comment = override[1] if override else ""
                
                with st.form("override_form"):
                    pos_over = st.text_area("Positionnement Révisé par l'Analyste", value=init_override)
                    analyst_com = st.text_area("Vos Commentaires Internes / Notes de Recherche", value=init_comment)
                    submitted = st.form_submit_button("Enregistrer mes modifications")
                    
                    if submitted:
                        cur.execute("""
                        INSERT INTO analyst_overrides (fund_id, positioning_override, analyst_comment)
                        VALUES (?, ?, ?)
                        ON CONFLICT(fund_id) DO UPDATE SET
                        positioning_override = excluded.positioning_override,
                        analyst_comment = excluded.analyst_comment
                        """, (int(fund_id), pos_over, analyst_com))
                        conn.commit()
                        st.success("✅ Vos modifications d'analyste ont été sauvegardées avec succès.")
                        st.rerun()

    # --- ONGLET 2 : INGESTION (EMAIL / PDF INGEST) ---
    elif choice == "Ingestion In-Box":
        st.subheader("📥 Ingestion de Données - Gmail / PDF Ingestion Simulator")
        
        email_subj = st.text_input("Sujet du Message / Nom de Fichier")
        email_text = st.text_area("Contenu textuel de l'email ou extraction brute de PDF", height=250)
        
        if st.button("🚀 Lancer l'Analyse d'Extraction par l'IA (Gemini)"):
            if not email_text:
                st.error("Veuillez renseigner le contenu.")
            elif client is None:
                st.error("API Gemini non configurée.")
            else:
                with st.spinner("Analyse Gemini en cours..."):
                    result = extract_email_data_with_gemini(client, email_text, email_subj)
                    
                    if result:
                        st.write("📊 **Résultat d'Extraction Brute IA :**")
                        st.json(result)
                        
                        if result["is_noise"]:
                            st.warning(f"🔇 Message catégorisé comme BRUIT COMMERCIAL : {result['noise_reason']}")
                        else:
                            st.success("✅ Message valide extrait avec succès ! Enregistrement en base de données.")
                            
                            # Sauvegarde sécurisée en BDD
                            cur = conn.cursor()
                            # 1. Enregistrement de l'Asset Manager
                            cur.execute("INSERT OR IGNORE INTO asset_managers (name, sales_contacts) VALUES (?, ?)", 
                                        (result["asset_manager"], result.get("sales_email", "")))
                            cur.execute("SELECT id FROM asset_managers WHERE name = ?", (result["asset_manager"],))
                            mgr_id = cur.fetchone()[0]
                            
                            # 2. Vérification attribution intelligente de fonds
                            cur.execute("SELECT analyst_id FROM funds WHERE name = ?", (result["fund_name"],))
                            existing_fund = cur.fetchone()
                            
                            analyst = "Unknown"
                            if existing_fund:
                                analyst = existing_fund[0]
                            else:
                                # Recherche d'un pattern d'attribution
                                cur.execute("SELECT pattern, analyst_id FROM assignment_rules")
                                rules = cur.fetchall()
                                for pat, anal in rules:
                                    if pat.lower() in result["fund_name"].lower():
                                        analyst = anal
                                        break
                                
                                cur.execute("INSERT INTO funds (manager_id, name, analyst_id) VALUES (?, ?, ?)",
                                            (mgr_id, result["fund_name"], analyst))
                            
                            cur.execute("SELECT id FROM funds WHERE name = ?", (result["fund_name"],))
                            fund_id = cur.fetchone()[0]
                            
                            # 3. Insertion du Rapport
                            urgency = "Prioritaire" if result["is_emergency"] else "Normal"
                            cur.execute("""
                            INSERT INTO fund_reports 
                            (fund_id, report_date, cash_rate, performance_pct, aum_m, key_views, positioning, urgency_level, urgency_reason, raw_subject)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """, (fund_id, result["report_date"], result.get("cash_rate"), result.get("performance_pct"), 
                                  result.get("aum_m"), result["key_views"], result["positioning"], urgency, result.get("emergency_reason"), email_subj))
                            
                            conn.commit()
                            st.info(f"Fonds affecté à l'analyste : **{analyst}**")

    # --- ONGLET 3 : ATTRIBUTION INTÉLLIGENTE ---
    elif choice == "Règles d'Attribution":
        st.subheader("⚙️ Système d'Attribution Intelligent & Règles de Routage")
        
        # ... Gestion des règles d'attribution (Damien, Antoine, Benoit, Maxime) ...
        df_rules = pd.read_sql_query("SELECT * FROM assignment_rules", conn)
        st.dataframe(df_rules, use_container_width=True)
        
        with st.form("add_rule"):
            new_pat = st.text_input("Pattern textuel dans le nom du fonds (ex: Water, Global)")
            new_anal = st.selectbox("Analyste responsable", ["Benoit", "Damien", "Maxime", "Antoine"])
            add_sub = st.form_submit_button("Ajouter la règle d'attribution")
            
            if add_sub and new_pat:
                cur = conn.cursor()
                cur.execute("INSERT OR REPLACE INTO assignment_rules (pattern, analyst_id) VALUES (?, ?)", (new_pat, new_anal))
                conn.commit()
                st.success("Règle ajoutée !")
                st.rerun()

if __name__ == "__main__":
    main()
`;

  return (
    <div className="space-y-8 animate-fade-in text-gray-300" id="resources-portal-container">
      {/* Description header */}
      <div className="bg-[#0b0e14] rounded-xl border border-white/10 p-6 shadow-xl">
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-400" />
          Ressources d'Intégration & Code Sources
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Vous trouverez ci-dessous les livrables clés prêts à être déployés : le prompt système structuré 
          pour l'extraction JSON et le code Python Streamlit complet utilisant le nouveau SDK Google Gen AI.
        </p>
      </div>

      {/* Grid of deliverables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Prompt deliverable */}
        <div className="bg-[#0b0e14] rounded-xl border border-white/10 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Cpu className="h-4 w-4 text-indigo-400" />
                Prompt Système de Filtrage & d'Extraction (JSON)
              </h3>
              <button
                onClick={() => handleCopy(systemPrompt, "prompt")}
                className="text-xs bg-white/5 hover:bg-white/10 text-white font-semibold px-2.5 py-1.5 rounded-md border border-white/10 hover:border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copiedText === "prompt" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Copié !
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copier le Prompt
                  </>
                )}
              </button>
            </div>
            
            <p className="text-xs text-gray-400 mb-3 leading-normal">
              Ce prompt utilise la fonctionnalité de <strong>Structured JSON Schema</strong> de Gemini. 
              En transmettant ce schéma de réponse, le modèle renvoie systématiquement un JSON 
              valide et typé, éliminant tout risque d'erreur de parsing en production.
            </p>

            <div className="bg-[#050608] rounded-lg p-4 font-mono text-[11px] text-gray-300 overflow-y-auto max-h-[380px] leading-relaxed border border-white/5 shadow-inner">
              <pre className="whitespace-pre-wrap">{systemPrompt}</pre>
            </div>
          </div>

          <div className="mt-6 p-4 bg-indigo-950/20 rounded-lg border border-indigo-500/20 text-xs text-indigo-300 leading-normal">
            <div className="flex gap-2 items-start">
              <Sparkles className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
              <span>
                <strong>Astuce :</strong> En production avec le SDK Python <code>google-genai</code>, 
                passez ce prompt comme argument <code>system_instruction</code> et déclarez le dictionnaire 
                comme un objet <code>types.Schema</code> pour forcer le typage strict.
              </span>
            </div>
          </div>
        </div>

        {/* Python Streamlit script deliverable */}
        <div className="bg-[#0b0e14] rounded-xl border border-white/10 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Terminal className="h-4 w-4 text-emerald-400" />
                Script Python Streamlit complet (Google Gen AI SDK)
              </h3>
              <button
                onClick={() => handleCopy(pythonStreamlitCode, "python")}
                className="text-xs bg-white/5 hover:bg-white/10 text-white font-semibold px-2.5 py-1.5 rounded-md border border-white/10 hover:border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copiedText === "python" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Copié !
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copier le Code
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-3 leading-normal">
              Ce script complet intègre une base SQL locale SQLite, implémente le routage d'attribution intelligente, 
              le "Coin de l'Analyste" avec overrides persistants, et utilise le tout dernier SDK Google Gen AI (v2) 
              avec typage <code>types.Schema</code>.
            </p>

            <div className="bg-[#050608] rounded-lg p-4 font-mono text-[11px] text-gray-300 overflow-y-auto max-h-[380px] leading-relaxed border border-white/5 shadow-inner">
              <pre className="whitespace-pre-wrap">{pythonStreamlitCode}</pre>
            </div>
          </div>

          <div className="mt-6 p-4 bg-amber-950/20 rounded-lg border border-amber-500/20 text-xs text-amber-300 leading-normal">
            <div className="flex gap-2 items-start">
              <Info className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <span>
                <strong>Instructions d'exécution :</strong> <br />
                <div className="mt-1 space-y-0.5 font-mono text-[10px] text-gray-400">
                  1. Installez les paquets : pip install streamlit google-genai pandas <br />
                  2. Définissez votre clé : export GEMINI_API_KEY="votre_cle" <br />
                  3. Lancez l'application : streamlit run app.py
                </div>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
