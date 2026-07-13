import React, { useState } from "react";
import { Database, GitFork, Copy, Check, FileCode, Server, Shield, Share2, Clock, Mail, FileText, AlertTriangle } from "lucide-react";
import { PortalData } from "../types";

interface SchemaAndArchProps {
  portalData?: PortalData | null;
}

export default function SchemaAndArch({ portalData }: SchemaAndArchProps) {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const sqlSchema = `--- SCHÉMA DE BASE DE DONNÉES POSTGRESQL (HISTORISÉ ET ADAPTÉ AUX LLM) ---

-- 1. Table des Sociétés de Gestion (Asset Managers)
CREATE TABLE asset_managers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    sales_contacts TEXT[] DEFAULT '{}', -- Emails des contacts commerciaux
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table des Fonds d'Investissement (Funds)
CREATE TABLE funds (
    id SERIAL PRIMARY KEY,
    manager_id INT REFERENCES asset_managers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL UNIQUE,
    analyst_id VARCHAR(50) NOT NULL DEFAULT 'Unknown', -- Damien, Maxime, Benoit, Antoine ou Unknown
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table Historisée des Rapports de Fonds (Fund Reports)
-- Cette table stocke l'historique de chaque rapport pour tracer l'évolution des métriques (Cash, Perf, AUM)
CREATE TABLE fund_reports (
    id SERIAL PRIMARY KEY,
    fund_id INT REFERENCES funds(id) ON DELETE CASCADE,
    report_date DATE NOT NULL, -- Date d'arrêté des données du rapport
    cash_rate NUMERIC(5, 2), -- ex: 4.50 pour 4.5%
    performance_pct NUMERIC(5, 2), -- ex: -1.20 pour -1.2%
    aum_m NUMERIC(12, 2), -- Actifs sous gestion en millions (EUR/USD)
    key_views TEXT NOT NULL, -- Extraction IA des perspectives fondamentales du gérant
    positioning TEXT NOT NULL, -- Extraction IA des surpondérations/sous-pondérations tactiques
    urgency_level VARCHAR(20) NOT NULL DEFAULT 'Normal', -- Normal ou Prioritaire
    urgency_reason TEXT, -- Raison si prioritaire (ex: départ de gérant)
    raw_email_subject TEXT, -- Sujet de l'email d'origine
    raw_email_body TEXT, -- Corps de l'email pour traçabilité/RAG
    extracted_by_ai BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_fund_report_date UNIQUE (fund_id, report_date)
);

-- 4. Table des Surcharges Manuelles (Analyst Overrides - Le Coin de l'Analyste)
-- Stocke les modifications manuelles et commentaires internes saisis par les analystes
CREATE TABLE analyst_overrides (
    fund_id INT PRIMARY KEY REFERENCES funds(id) ON DELETE CASCADE,
    positioning_override TEXT, -- Ajustement du positionnement par l'analyste
    analyst_comment TEXT, -- Note de recherche interne / analyse de l'analyste
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Table des Règles d'Attribution Intelligente (Assignment Patterns)
-- Permet de faire correspondre un pattern de nom à un analyste par défaut
CREATE TABLE assignment_rules (
    id SERIAL PRIMARY KEY,
    pattern VARCHAR(100) NOT NULL UNIQUE, -- ex: 'Water' ou 'Global Premium'
    analyst_id VARCHAR(50) NOT NULL, -- Damien, Maxime, Benoit, Antoine
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

--- INDEX CLÉS POUR LES REQUÊTES ET GRAPHES DE TENDANCE ---
CREATE INDEX idx_reports_fund_date ON fund_reports(fund_id, report_date DESC);
CREATE INDEX idx_funds_manager ON funds(manager_id);
`;

  return (
    <div className="space-y-8 animate-fade-in text-gray-300" id="schema-arch-container">
      {/* Upper header */}
      <div className="bg-[#0b0e14] rounded-xl border border-white/10 p-6 shadow-xl">
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <GitFork className="h-5 w-5 text-indigo-400" />
          Architecture Technique & Modélisation des Données
        </h2>
        <p className="text-sm text-gray-400 mt-1 max-w-4xl">
          Voici la modélisation complète du système pour votre équipe d'analystes. Ce socle assure 
          l'historisation rigoureuse de la donnée, l'arbitrage manuel, et le traitement intelligent par IA.
        </p>
      </div>

      {/* Recent ingestion history */}
      <div className="bg-[#0b0e14] rounded-xl border border-white/10 p-6 shadow-xl">
        <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-indigo-400" />
          Historique des 5 derniers documents ingérés
        </h3>

        {(() => {
          const recent = (portalData?.fundReports || [])
            .filter((r) => r.extractedByAi)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 5);

          if (recent.length === 0) {
            return (
              <p className="text-xs text-gray-500 italic py-6 text-center">
                Aucun document n'a encore été ingéré par l'IA.
              </p>
            );
          }

          return (
            <div className="space-y-2">
              {recent.map((report) => {
                const fund = portalData?.funds.find((f) => f.id === report.fundId);
                const isEmail = !!report.rawEmailBody;
                return (
                  <div
                    key={report.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      report.urgencyLevel === "Prioritaire"
                        ? "bg-red-950/10 border-red-500/20"
                        : "bg-[#050608] border-white/5"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isEmail ? (
                        <Mail className="h-4 w-4 text-indigo-400" />
                      ) : (
                        <FileText className="h-4 w-4 text-indigo-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-white truncate">
                          {report.rawEmailSubject || "Document sans sujet"}
                        </p>
                        {report.urgencyLevel === "Prioritaire" && (
                          <span className="shrink-0 flex items-center gap-1 text-[9px] font-bold bg-red-500/15 text-red-300 px-1.5 py-0.5 rounded-full border border-red-500/30">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            Prioritaire
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {fund ? fund.name : "Fonds non identifié"} · {new Date(report.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Grid of Architecture Visual & Explanation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Visual Architecture flowchart in 7 cols */}
        <div className="lg:col-span-7 bg-[#0b0e14] rounded-xl border border-white/10 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
              <Server className="h-4 w-4 text-indigo-400" />
              1. Flux de Données Global & Orchestration
            </h3>
            
            {/* Diagram container */}
            <div className="bg-[#050608] rounded-lg p-5 border border-white/5 space-y-4">
              {/* Box 1: Sources */}
              <div className="flex flex-col items-center">
                <div className="bg-[#0b0e14] border border-white/10 px-4 py-2 rounded-lg text-center shadow-inner max-w-sm w-full">
                  <div className="text-xs font-semibold text-indigo-400 tracking-wider">SOURCES ENTRANTES</div>
                  <div className="text-sm font-medium text-white mt-1">📧 Gmail API & Pièces jointes PDF</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Rapports de gestion mensuels (Robeco, Amundi, JPM)</div>
                </div>
                <div className="h-6 w-0.5 bg-indigo-500/30"></div>
              </div>

              {/* Box 2: Filter and Ingestion */}
              <div className="flex flex-col items-center">
                <div className="bg-indigo-600/20 border border-indigo-500/30 px-4 py-2.5 rounded-lg text-center text-white shadow-inner max-w-sm w-full">
                  <div className="text-xs font-semibold text-indigo-400 tracking-wider">INGESTION & FILTRAGE (GEMINI AI)</div>
                  <div className="text-sm font-medium mt-1">Prompt d'Extraction Strict (Format JSON)</div>
                  <div className="text-[10px] text-indigo-300 mt-0.5">Filtre du Bruit (Spam, Pub) & Détection des Urgences 🚨</div>
                </div>
                <div className="h-6 w-0.5 bg-indigo-500/30"></div>
              </div>

              {/* Split: DB & Assignment */}
              <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
                {/* Left: DB */}
                <div className="bg-[#0b0e14] border border-white/5 p-3 rounded-lg text-center shadow-inner">
                  <div className="text-xs font-semibold text-emerald-400 tracking-wider">STOCKAGE SQL</div>
                  <div className="text-xs font-medium text-gray-300 mt-1">Historique des Rapports (Cash, Perf, AUM)</div>
                  <div className="text-[9px] text-gray-500 mt-0.5">Permet l'analyse des tendances</div>
                </div>

                {/* Right: Attribution */}
                <div className="bg-[#0b0e14] border border-white/5 p-3 rounded-lg text-center shadow-inner">
                  <div className="text-xs font-semibold text-amber-400 tracking-wider">ATTRIBUTION INTÉLLIGENTE</div>
                  <div className="text-xs font-medium text-gray-300 mt-1">Patterns d'Attribution</div>
                  <div className="text-[9px] text-gray-500 mt-0.5">Définit l'analyste responsable (Damien, Antoine, etc.)</div>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <div className="h-6 w-0.5 bg-indigo-500/30"></div>
                <div className="bg-[#0b0e14] border border-white/10 px-4 py-2 rounded-lg text-center shadow-inner max-w-sm w-full">
                  <div className="text-xs font-semibold text-indigo-400 tracking-wider">UI & RECHERCHE DE CONTEXTE (RAG)</div>
                  <div className="text-sm font-medium mt-1 text-white">Le Coin de l'Analyste & Synthèse Multi-Gérants</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Overrides manuels + Générateur PDF One-Pager</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-2.5 text-xs text-gray-400">
            <div className="flex items-start gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
              <span><strong>Gestion du Bruit :</strong> Lors de l'ingestion, Gemini analyse l'objet et le corps de l'email pour déterminer s'il s'agit d'une communication commerciale sans valeur d'analyse.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
              <span><strong>Historisation :</strong> Contrairement à un système qui écrase les données, la table <code>fund_reports</code> stocke chaque nouveau point daté pour tracer des graphiques.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
              <span><strong>Override :</strong> La table <code>analyst_overrides</code> assure une séparation claire entre l'extraction brute de l'IA et l'évaluation finale de votre équipe.</span>
            </div>
          </div>
        </div>

        {/* SQL Schema viewer in 5 cols */}
        <div className="lg:col-span-5 bg-[#0b0e14] rounded-xl border border-white/10 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-400" />
                2. Schéma SQL de la Base de Données
              </h3>
              <button
                onClick={() => handleCopy(sqlSchema, "sql")}
                className="text-xs bg-white/5 hover:bg-white/10 text-white font-semibold px-2.5 py-1.5 rounded-md border border-white/10 hover:border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copiedText === "sql" ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    Copié !
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copier SQL
                  </>
                )}
              </button>
            </div>

            <div className="bg-[#050608] rounded-lg p-4 font-mono text-[11px] text-gray-300 overflow-y-auto max-h-[360px] leading-relaxed border border-white/5 shadow-inner">
              <pre className="whitespace-pre-wrap">{sqlSchema}</pre>
            </div>
          </div>

          <div className="mt-6 p-4 bg-emerald-950/20 rounded-lg border border-emerald-500/20 text-emerald-300">
            <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              Conformité Historique & Analyse Temporelle
            </h4>
            <p className="text-[11px] text-emerald-300/90 mt-1 leading-normal">
              La contrainte d'unicité sur <code>(fund_id, report_date)</code> empêche les doublons pour une même date 
              tout en permettant l'empilement infini des rapports mensuels successifs pour chaque fonds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
