import React, { useState, useEffect } from "react";
import { 
  Building2, FolderSync, TrendingUp, User, UserCheck, FileText, 
  AlertTriangle, Mail, RefreshCw, Plus, Database, Sparkles, 
  ChevronRight, Code2, CheckCircle2, Trash2, UploadCloud, X, ArrowRight,
  Printer, Check, Edit3, HelpCircle, UserX
} from "lucide-react";
import SchemaAndArch from "./components/SchemaAndArch";
import AnalystPortal from "./components/AnalystPortal";
import { mockEmails, MockEmail } from "./data/mockEmails";
import { PortalData, PortalTab, AssetManager, Fund, FundReport, AnalystOverride, AssignmentRule } from "./types";

// SVG Line Chart Component for displaying trend data (React 19 Safe, no external dependency)
function SVGLineChart({ data, title, unit, colorClass = "indigo" }: { data: { label: string; value: number }[]; title: string; unit: string; colorClass?: string }) {
  if (data.length === 0) return <div className="text-xs text-slate-400 py-6 text-center">Aucune donnée historique disponible</div>;

  const height = 120;
  const width = 360;
  const padding = 24;

  const xMax = width - padding * 2;
  const yMax = height - padding * 2;

  const values = data.map(d => d.value);
  const minVal = Math.min(...values) * 0.92; // 8% cushion
  const maxVal = Math.max(...values) * 1.08;
  const valRange = maxVal - minVal === 0 ? 1 : maxVal - minVal;

  const getX = (index: number) => data.length <= 1 ? padding + xMax / 2 : padding + (index / (data.length - 1)) * xMax;
  const getY = (val: number) => height - padding - ((val - minVal) / valRange) * yMax;

  const points = data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(" ");
  const fillPoints = `${getX(0)},${height - padding} ` + points + ` ${getX(data.length - 1)},${height - padding}`;

  const strokeColor = colorClass === "indigo" ? "#6366f1" : colorClass === "emerald" ? "#10b981" : "#f59e0b";
  const gradientId = `grad-${title.replace(/\s+/g, "-")}`;

  return (
    <div className="bg-[#0b0e14]/60 border border-white/5 p-4 rounded-xl shadow-lg">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{title}</span>
        <span className="text-xs font-bold text-white bg-[#050608] px-2 py-0.5 rounded border border-white/10 font-mono">
          Dernier: {data[data.length - 1].value}{unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
        <line x1={padding} y1={height - padding - yMax / 2} x2={width - padding} y2={height - padding - yMax / 2} stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
        <line x1={padding} y1={height - padding - yMax} x2={width - padding} y2={height - padding - yMax} stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />

        {/* Gradient fill */}
        <polygon points={fillPoints} fill={`url(#${gradientId})`} />

        {/* Core Line */}
        <polyline fill="none" stroke={strokeColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" points={points} />

        {/* Data point markers */}
        {data.map((d, i) => (
          <g key={i} className="group">
            <circle cx={getX(i)} cy={getY(d.value)} r={4} fill="#050608" stroke={strokeColor} strokeWidth={2} />
            {/* Metric Value */}
            <text x={getX(i)} y={getY(d.value) - 8} textAnchor="middle" className="text-[10px] font-bold font-mono" fill="#f8fafc">
              {d.value > 0 ? `+${d.value}` : d.value}{unit}
            </text>
            {/* Label Date */}
            <text x={getX(i)} y={height - 6} textAnchor="middle" className="text-[9px] text-gray-500 font-medium font-sans">
              {d.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<PortalTab>("dashboard");
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);

  // Selections
  const [selectedManagerId, setSelectedManagerId] = useState<string>("mgr-2"); // Default Robeco
  const [selectedFundId, setSelectedFundId] = useState<string>("fund-2"); // Default Robeco Global Premium

  // Analyst overrides fields
  const [overridePositioning, setOverridePositioning] = useState("");
  const [overrideComment, setOverrideComment] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideFeedback, setOverrideFeedback] = useState(false);

  // Ingest playground fields
  const [selectedMockEmailId, setSelectedMockEmailId] = useState<string | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailText, setEmailText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [importingFile, setImportingFile] = useState(false);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<any | null>(null);

  // Multi-Gérant Synthesis Modal
  const [showSynthesizeModal, setShowSynthesizeModal] = useState(false);
  const [selectedManagersForSynthesis, setSelectedManagersForSynthesis] = useState<string[]>([]);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesisResult, setSynthesisResult] = useState<string | null>(null);

  // One-Pager Generator
  const [onepagerGenerating, setOnepagerGenerating] = useState(false);
  const [onepagerResult, setOnepagerResult] = useState<string | null>(null);

  // Quick Assignment modal / form
  const [assignmentFundId, setAssignmentFundId] = useState<string | null>(null);
  const [assignmentAnalystId, setAssignmentAnalystId] = useState<string>("Damien");
  const [assignmentPattern, setAssignmentPattern] = useState("");

  const teamAnalysts = ["Damien", "Maxime", "Benoit", "Antoine"];

  // Whether the server has a real Gemini API key configured (checked via /api/status)
  const [aiConfigured, setAiConfigured] = useState<boolean>(false);

  // Load Data
  const fetchData = async () => {
    try {
      const res = await fetch("/api/data");
      const json = await res.json();
      setPortalData(json);
      setLoading(false);
    } catch (err) {
      console.error("Error loading portal data:", err);
    }
  };

  useEffect(() => {
    fetchData();
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => setAiConfigured(!!data.aiConfigured))
      .catch(() => setAiConfigured(false));
  }, []);

  // Update Form overrides when selected fund changes
  useEffect(() => {
    if (portalData && selectedFundId) {
      const override = portalData.analystOverrides.find(o => o.fundId === selectedFundId);
      setOverridePositioning(override?.positioningOverride || "");
      setOverrideComment(override?.analystComment || "");
    }
  }, [selectedFundId, portalData]);

  // Load selected mock email text (only when the user explicitly picks one)
  useEffect(() => {
    if (!selectedMockEmailId) return;
    const email = mockEmails.find(e => e.id === selectedMockEmailId);
    if (email) {
      setEmailSubject(email.subject);
      setEmailText(email.body);
    }
  }, [selectedMockEmailId]);

  // Save analyst override
  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    setOverrideSaving(true);
    try {
      const res = await fetch("/api/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundId: selectedFundId,
          positioningOverride: overridePositioning,
          analystComment: overrideComment
        })
      });
      const resJson = await res.json();
      if (resJson.success) {
        setPortalData(prev => prev ? { ...prev, analystOverrides: resJson.analystOverrides } : prev);
        setOverrideFeedback(true);
        setTimeout(() => setOverrideFeedback(false), 3000);
      }
    } catch (err) {
      console.error("Error saving analyst override:", err);
    } finally {
      setOverrideSaving(false);
    }
  };

  // Perform Gemini email extraction
  const handleExtract = async () => {
    setExtracting(true);
    setExtractionResult(null);
    setExtractError(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailSubject, emailText })
      });
      const data = await res.json();

      if (!res.ok || !data.raw_extraction) {
        setExtractError(data.error || "Erreur inconnue lors de l'extraction. Le document est peut-être trop long ou mal formaté.");
        return;
      }

      setExtractionResult(data);

      // Auto-fill the subject field from what the AI detected, if it was left empty
      if (!emailSubject.trim() && data.raw_extraction) {
        const { asset_manager, fund_name } = data.raw_extraction;
        const autoSubject = [asset_manager, fund_name].filter((v) => v && v !== "N/A").join(" - ");
        if (autoSubject) setEmailSubject(autoSubject);
      }

      // reload dataset to display extracted funds instantly in the dashboard
      await fetchData();
    } catch (err) {
      console.error("Error running Gemini extraction:", err);
      setExtractError("Impossible de contacter le serveur d'extraction. Vérifiez votre connexion et réessayez.");
    } finally {
      setExtracting(false);
    }
  };

  // Import a real file (PDF or plain text/email) and populate the text area
  const handleFileImport = async (file: File) => {
    setImportError(null);
    setImportingFile(true);
    setExtractionResult(null);
    try {
      if (!emailSubject) setEmailSubject(file.name.replace(/\.[^.]+$/, ""));

      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        // Read the PDF as base64 then send it to the server for text extraction
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1] || "");
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await fetch("/api/parse-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileBase64: base64 })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur lors de la lecture du PDF");
        setEmailText(data.text);
      } else {
        // Plain text / .eml / .txt files can be read directly in the browser
        const text = await file.text();
        setEmailText(text);
      }

      setImportedFileName(file.name);
    } catch (err: any) {
      console.error("Error importing file:", err);
      setImportError(err.message || "Impossible de lire ce fichier.");
    } finally {
      setImportingFile(false);
    }
  };

  // Run Multi-Gérants Synthesis (RAG)
  const handleSynthesize = async () => {
    if (selectedManagersForSynthesis.length === 0) return;
    setSynthesizing(true);
    setSynthesisResult(null);
    try {
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerIds: selectedManagersForSynthesis })
      });
      const json = await res.json();
      setSynthesisResult(json.summary);
    } catch (err) {
      console.error("Error running market synthesis:", err);
    } finally {
      setSynthesizing(false);
    }
  };

  // Generate Fund One-Pager (Markdown)
  const handleGenerateOnepager = async (fundId: string) => {
    setOnepagerGenerating(true);
    setOnepagerResult(null);
    try {
      const res = await fetch("/api/onepager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fundId })
      });
      const json = await res.json();
      setOnepagerResult(json.markdown);
    } catch (err) {
      console.error("Error generating onepager sheet:", err);
    } finally {
      setOnepagerGenerating(false);
    }
  };

  // Assign Unknown Fund manually
  const handleAssignFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentFundId) return;
    try {
      const res = await fetch("/api/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundId: assignmentFundId,
          analystId: assignmentAnalystId,
          pattern: assignmentPattern || undefined
        })
      });
      const json = await res.json();
      if (json.success) {
        setPortalData(prev => prev ? { ...prev, funds: json.funds, assignmentRules: json.assignmentRules } : prev);
        setAssignmentFundId(null);
        setAssignmentPattern("");
      }
    } catch (err) {
      console.error("Error saving manual assignment:", err);
    }
  };

  // Quick inline reassignment directly from a fund card (dashboard)
  const handleQuickReassign = async (fundId: string, newAnalystId: string) => {
    // Optimistic UI update so the dropdown feels instant
    setPortalData(prev =>
      prev ? { ...prev, funds: prev.funds.map(f => f.id === fundId ? { ...f, analystId: newAnalystId } : f) } : prev
    );
    try {
      const res = await fetch("/api/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fundId, analystId: newAnalystId })
      });
      const json = await res.json();
      if (json.success) {
        setPortalData(prev => prev ? { ...prev, funds: json.funds, assignmentRules: json.assignmentRules } : prev);
      }
    } catch (err) {
      console.error("Error during quick reassignment:", err);
    }
  };

  // Delete a single fund (and its reports/overrides) directly from the dashboard
  const handleDeleteFund = async (fundId: string, fundName: string) => {
    if (!confirm(`Supprimer définitivement le fonds "${fundName}" et tous ses rapports associés ?`)) return;
    try {
      const res = await fetch("/api/manage-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_fund", id: fundId })
      });
      const json = await res.json();
      if (json.success) {
        setPortalData(json);
        if (selectedFundId === fundId) setSelectedFundId(null);
      }
    } catch (err) {
      console.error("Error deleting fund:", err);
    }
  };

  // Wipe the entire database (all managers, funds, reports, overrides)
  const handleWipeAllData = async () => {
    if (!confirm("⚠️ Ceci va supprimer DÉFINITIVEMENT toutes les données (gérants, fonds, rapports). Continuer ?")) return;
    if (!confirm("Dernière confirmation : voulez-vous vraiment tout effacer ?")) return;
    try {
      const res = await fetch("/api/manage-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "wipe_all" })
      });
      const json = await res.json();
      if (json.success) {
        setPortalData(json);
        setSelectedFundId(null);
      }
    } catch (err) {
      console.error("Error wiping data:", err);
    }
  };



  // Reset demo dataset
  const handleResetData = async () => {
    if (confirm("Réinitialiser toutes les données de simulation par défaut ?")) {
      setLoading(true);
      try {
        const res = await fetch("/api/reset", { method: "POST" });
        const json = await res.json();
        if (json.success) {
          await fetchData();
        }
      } catch (err) {
        console.error("Error resetting data:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Manually trigger the Gmail inbox synchronization from a button in the app
  const [syncingGmail, setSyncingGmail] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleManualGmailSync = async () => {
    setSyncingGmail(true);
    setSyncFeedback(null);
    try {
      const res = await fetch("/api/manual-sync", { method: "GET" });
      const json = await res.json();
      if (json.success) {
        setSyncFeedback(
          json.processedCount === 0
            ? "Aucun nouvel email à traiter."
            : `${json.processedCount} email(s) traité(s) avec succès.`
        );
        await fetchData();
      } else {
        setSyncFeedback(json.error || "Erreur lors de la synchronisation.");
      }
    } catch (err) {
      console.error("Error during manual Gmail sync:", err);
      setSyncFeedback("Impossible de contacter le serveur.");
    } finally {
      setSyncingGmail(false);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  // Simple Markdown Renderer
  const renderMarkdownText = (md: string) => {
    return md.split("\n").map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("# ")) {
        return <h1 key={idx} className="text-xl font-bold text-slate-900 mt-4 mb-2 border-b border-slate-100 pb-1">{trimmed.slice(2)}</h1>;
      }
      if (trimmed.startsWith("## ")) {
        return <h2 key={idx} className="text-base font-semibold text-slate-800 mt-4 mb-2 flex items-center gap-2">{trimmed.slice(3)}</h2>;
      }
      if (trimmed.startsWith("### ")) {
        return <h3 key={idx} className="text-sm font-semibold text-slate-700 mt-3 mb-1">{trimmed.slice(4)}</h3>;
      }
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        return <li key={idx} className="ml-4 list-disc text-xs text-slate-600 my-1">{trimmed.slice(2)}</li>;
      }
      if (trimmed.startsWith("> ")) {
        return <blockquote key={idx} className="border-l-4 border-indigo-400 pl-3 italic text-xs text-slate-500 bg-slate-50 py-1 my-1.5 rounded-r">{trimmed.slice(2)}</blockquote>;
      }
      if (trimmed === "---") {
        return <hr key={idx} className="my-3 border-slate-100" />;
      }
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        const cells = trimmed.split("|").slice(1, -1).map(c => c.trim());
        if (cells.some(c => c.includes("---"))) return null; // skip separators
        return (
          <div key={idx} className="grid grid-cols-3 border-b border-slate-100 py-1.5 text-[11px] px-2 bg-slate-50">
            {cells.map((cell, cidx) => (
              <span key={cidx} className="text-slate-700 font-medium">{cell.replace(/\*\*/g, '')}</span>
            ))}
          </div>
        );
      }
      if (!trimmed) return <div key={idx} className="h-2" />;
      return <p key={idx} className="text-xs text-slate-600 my-1 leading-relaxed">{trimmed}</p>;
    });
  };

  if (loading || !portalData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Chargement du portail d'analyse financière...</p>
        </div>
      </div>
    );
  }

  // Filter funds and metrics
  const activeManager = portalData.assetManagers.find(m => m.id === selectedManagerId) || portalData.assetManagers[0];
  const activeFunds = portalData.funds.filter(f => f.managerId === selectedManagerId);
  const selectedFund = portalData.funds.find(f => f.id === selectedFundId) || activeFunds[0] || portalData.funds[0];

  // Reports associated with active fund
  const selectedFundReports = portalData.fundReports
    .filter(r => r.fundId === selectedFund?.id)
    .sort((a, b) => a.reportDate.localeCompare(b.reportDate)); // oldest to newest for charts

  const latestReport = [...selectedFundReports].reverse()[0];

  // Active overridden values
  const activeOverride = portalData.analystOverrides.find(o => o.fundId === selectedFund?.id);

  // Count active priority alerts
  const alertCount = portalData.fundReports.filter(r => {
    // only count the latest report alert for each fund if it is Priority
    const fundReps = portalData.fundReports.filter(fr => fr.fundId === r.fundId);
    const latest = fundReps.sort((a, b) => b.reportDate.localeCompare(a.reportDate))[0];
    return latest && latest.id === r.id && r.urgencyLevel === "Prioritaire";
  }).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#050608] text-gray-200 antialiased font-sans selection:bg-indigo-500/30 selection:text-white" id="app-container">
      
      {/* 1. TOP HEADER & APP IDENTITY */}
      <header className="bg-[#080a0f] text-white border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            
            {/* Title & Brand */}
            <div>
              <div className="flex items-center gap-2.5">
                <div className="bg-indigo-600/30 border border-indigo-500/30 p-2 rounded-lg text-white shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                  <Building2 className="h-5 w-5 text-indigo-400" />
                </div>
                <h1 className="text-lg font-bold tracking-tight uppercase font-sans text-white">
                  Portail d'Intelligence Augmentée
                </h1>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-semibold px-2 py-0.5 rounded border border-indigo-500/20">
                  Fund Analysis Core
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Centralisation multimodale, structuration de rapports financiers et attribution d'analystes (Gmail + Gemini API)
              </p>
            </div>

            {/* Analyst Team Indicators */}
            <div className="flex items-center flex-wrap gap-3 self-stretch md:self-auto justify-between md:justify-end border-t border-white/10 md:border-0 pt-3 md:pt-0">
              <div className="text-right hidden sm:block">
                <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Équipe d'Analystes</div>
                <div className="text-xs text-gray-300 font-medium">4 Spécialistes Actifs</div>
              </div>
              
              <div className="flex items-center -space-x-2">
                {[
                  { name: "Damien", color: "bg-indigo-600", label: "D" },
                  { name: "Maxime", color: "bg-emerald-600", label: "M" },
                  { name: "Benoît", color: "bg-amber-600", label: "B" },
                  { name: "Antoine", color: "bg-pink-600", label: "A" }
                ].map((analyst, i) => (
                  <div 
                    key={i} 
                    title={`${analyst.name} (Analyste)`} 
                    className={`h-7 w-7 rounded-full ${analyst.color} text-white flex items-center justify-center font-bold text-xs border-2 border-[#080a0f] shadow-md`}
                  >
                    {analyst.label}
                  </div>
                ))}
              </div>

              {/* Manual Gmail sync button */}
              <div className="relative">
                <button
                  onClick={handleManualGmailSync}
                  disabled={syncingGmail}
                  title="Synchroniser la boîte Gmail maintenant"
                  className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white p-1.5 rounded-lg border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                  <Mail className={`h-4 w-4 ${syncingGmail ? "animate-pulse" : ""}`} />
                </button>
                {syncFeedback && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-[#0b0e14] border border-white/10 rounded-lg px-3 py-2 text-[11px] text-gray-300 shadow-xl z-50">
                    {syncFeedback}
                  </div>
                )}
              </div>

              {/* Reset simulator data button */}
              <button 
                onClick={handleResetData}
                title="Réinitialiser aux données de démonstration"
                className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white p-1.5 rounded-lg border border-white/10 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>

              {/* Wipe all data button */}
              <button
                onClick={handleWipeAllData}
                title="Vider toute la base de données"
                className="bg-red-950/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 p-1.5 rounded-lg border border-red-500/20 hover:border-red-500/30 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* 2. TAB NAVIGATION BAR */}
      <nav className="bg-[#0b0e14] border-b border-white/5 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12">
            <div className="flex space-x-1 sm:space-x-2 overflow-x-auto py-1">
              {[
                { id: "dashboard", label: "📊 Tableau de Bord", desc: "Suivi à 3 niveaux" },
                { id: "ingestion", label: "📥 Ingestion", desc: "Tester Gemini" },
                { id: "schema", label: "🗄️ Schéma BDD & Flux", desc: "Architecture" },
                { id: "resources", label: "👤 Fonds par Analyste", desc: "Fonds suivis" }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as PortalTab)}
                  className={`text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-lg transition-all duration-150 whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? "bg-indigo-600/20 border border-indigo-500/30 text-white shadow-[0_0_15px_rgba(99,102,241,0.15)] font-semibold"
                      : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Quick status banner */}
            <div className="hidden lg:flex items-center gap-4">
              {alertCount > 0 && (
                <div className="bg-red-950/30 border border-red-500/20 text-red-200 px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  <span>{alertCount} Alerte{alertCount > 1 ? 's' : ''} Prioritaire{alertCount > 1 ? 's' : ''} active{alertCount > 1 ? 's' : ''} !</span>
                </div>
              )}
              <div className="text-[11px] text-gray-500 font-medium">
                {aiConfigured ? (
                  <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Gemini Live connecté
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Mode simulation
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* 3. MAIN WORKSPACE */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* --- TAB A: TABLEAU DE BORD (THE 3-LEVEL UI) --- */}
        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Team summary and actions block */}
            <div className="bg-[#0b0e14] rounded-xl border border-white/5 p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white">Analyse Financière & Supervision</h2>
                <p className="text-xs text-gray-400 mt-0.5">Explorez les vues macro des gérants de fonds, tracez les tendances et appliquez vos corrections d'analystes.</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Multi-Gérant comparative synthesis trigger */}
                <button
                  onClick={() => {
                    setSelectedManagersForSynthesis([]);
                    setSynthesisResult(null);
                    setShowSynthesizeModal(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors shadow-lg shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Synthèse Multi-Gérants
                </button>
              </div>
            </div>

            {/* The 3-Levels Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* LEVEL 1: ASSET MANAGERS (3 Cols) */}
              <div className="lg:col-span-3 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h3 className="font-bold text-xs uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-indigo-400" />
                    Niveau 1 : Les Gérants
                  </h3>
                  <span className="bg-white/5 text-gray-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/5">
                    {portalData.assetManagers.length}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {portalData.assetManagers.map((mgr) => {
                    const mgrFundsCount = portalData.funds.filter(f => f.managerId === mgr.id).length;
                    const isSelected = selectedManagerId === mgr.id;
                    return (
                      <button
                        key={mgr.id}
                        onClick={() => {
                          setSelectedManagerId(mgr.id);
                          // Auto select first fund of this manager
                          const mFunds = portalData.funds.filter(f => f.managerId === mgr.id);
                          if (mFunds.length > 0) {
                            setSelectedFundId(mFunds[0].id);
                          }
                        }}
                        className={`w-full text-left p-4 rounded-xl border transition-all duration-150 flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-[#0b0e14] border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.15)] text-white"
                            : "bg-[#0b0e14]/40 border-white/5 hover:border-white/10 hover:bg-[#0b0e14]/70 text-gray-300"
                        }`}
                      >
                        <div className="space-y-1 pr-2">
                          <h4 className={`text-xs font-bold leading-snug ${isSelected ? "text-white" : "text-gray-300"}`}>{mgr.name}</h4>
                          <p className="text-[10px] text-gray-400 font-mono">
                            {mgr.salesContacts[0] || "Aucun email"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            isSelected 
                              ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                              : "bg-white/5 text-gray-400 border-white/5"
                          }`}>
                            {mgrFundsCount} f.
                          </span>
                          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isSelected ? "text-indigo-400 translate-x-0.5" : "text-gray-500"}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* LEVEL 2: FUNDS LIST (3 Cols) */}
              <div className="lg:col-span-3 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h3 className="font-bold text-xs uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
                    <FolderSync className="h-3.5 w-3.5 text-indigo-400" />
                    Niveau 2 : Les Fonds
                  </h3>
                  <span className="bg-white/5 text-gray-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/5">
                    {activeFunds.length}
                  </span>
                </div>

                {activeFunds.length === 0 ? (
                  <div className="bg-[#0b0e14]/40 border border-white/5 rounded-xl p-6 text-center text-xs text-gray-500">
                    Aucun fonds pour ce gérant
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {activeFunds.map((fund) => {
                      const isSelected = selectedFundId === fund.id;
                      const hasOverride = portalData.analystOverrides.some(o => o.fundId === fund.id);
                      
                      // Get latest report to check priority
                      const fundReps = portalData.fundReports.filter(r => r.fundId === fund.id);
                      const latestRep = fundReps.sort((a, b) => b.reportDate.localeCompare(a.reportDate))[0];
                      const isPriority = latestRep?.urgencyLevel === "Prioritaire";

                      return (
                        <div
                          key={fund.id}
                          className={`group relative rounded-xl border transition-all duration-150 p-4 ${
                            isSelected
                              ? "bg-[#0b0e14] border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.15)] text-white"
                              : "bg-[#0b0e14]/40 border-white/5 hover:border-white/10"
                          }`}
                        >
                          <div className="space-y-2">
                            {/* Fund click block */}
                            <button
                              onClick={() => setSelectedFundId(fund.id)}
                              className="w-full text-left focus:outline-none cursor-pointer"
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <h4 className={`text-xs font-bold leading-snug transition-colors ${
                                  isSelected ? "text-white" : "text-gray-300 group-hover:text-indigo-400"
                                }`}>
                                  {fund.name}
                                </h4>
                                {isPriority && (
                                  <span className="shrink-0 h-2 w-2 rounded-full bg-red-500 animate-pulse mt-1" title="Alerte Prioritaire" />
                                )}
                              </div>
                            </button>

                            {/* Analyst assignment row */}
                            <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2.5" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <User className="h-3 w-3 text-gray-500 shrink-0" />
                                <select
                                  value={fund.analystId}
                                  onChange={(e) => handleQuickReassign(fund.id, e.target.value)}
                                  className={`text-[10px] font-medium bg-transparent border border-white/10 rounded px-1.5 py-0.5 cursor-pointer focus:outline-none focus:border-indigo-500/50 hover:border-white/20 transition-colors ${
                                    fund.analystId === "Unknown" ? "text-amber-400" : "text-gray-300"
                                  }`}
                                >
                                  <option value="Unknown" className="bg-[#0b0e14] text-amber-400">Non affecté ⚠️</option>
                                  {teamAnalysts.map(name => (
                                    <option key={name} value={name} className="bg-[#0b0e14] text-gray-200">{name}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {hasOverride && (
                                  <span className="text-[9px] bg-emerald-500/10 text-emerald-300 font-semibold px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    Corrigé 👤
                                  </span>
                                )}
                                <button
                                  onClick={() => handleDeleteFund(fund.id, fund.name)}
                                  title="Supprimer ce fonds"
                                  className="text-gray-600 hover:text-red-400 transition-colors p-0.5 cursor-pointer"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* LEVEL 3: DETAILED FUND SUMMARY & ACTIONS (6 Cols) */}
              <div className="lg:col-span-6 space-y-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h3 className="font-bold text-xs uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-indigo-400" />
                    Niveau 3 : Fiche du Fonds & Historique
                  </h3>
                  {selectedFund && (
                    <span className="text-[10px] bg-white/5 text-gray-400 font-bold px-2 py-0.5 rounded border border-white/5">
                      ID: {selectedFund.id}
                    </span>
                  )}
                </div>

                {!selectedFund ? (
                  <div className="bg-[#0b0e14]/40 border border-white/5 rounded-xl p-8 text-center text-xs text-gray-500 shadow-lg">
                    Sélectionnez un fonds pour consulter l'analyse
                  </div>
                ) : (
                  <div className="space-y-6 animate-fade-in">
                    
                    {/* Upper title card with analyst name and export actions */}
                    <div className="bg-[#0b0e14] rounded-xl border border-white/5 p-5 shadow-lg space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-white">{selectedFund.name}</h3>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Gérant : {activeManager.name} &bull; Analyste : <strong className="text-indigo-400">{selectedFund.analystId === "Unknown" ? "Non affecté ⚠️" : selectedFund.analystId}</strong>
                          </p>
                        </div>
                        
                        <div className="flex gap-2 shrink-0">
                          {/* One-Pager generation trigger */}
                          <button
                            onClick={() => handleGenerateOnepager(selectedFund.id)}
                            disabled={onepagerGenerating}
                            className="bg-white/5 hover:bg-white/10 text-gray-300 font-semibold text-[11px] px-3 py-2 rounded-lg border border-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            <Printer className="h-3.5 w-3.5 text-gray-400" />
                            {onepagerGenerating ? "Génération..." : "Exporter One-Pager"}
                          </button>
                        </div>
                      </div>

                      {/* Display warning banner if the latest report is an Emergency! */}
                      {latestReport?.urgencyLevel === "Prioritaire" && (
                        <div className="bg-red-950/20 border border-red-500/20 rounded-lg p-3.5 text-xs text-red-200 flex items-start gap-2.5 shadow-lg shadow-red-500/5">
                          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                          <div>
                            <span className="font-bold uppercase tracking-wider text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded inline-block mb-1">
                              ALERTE PRIORITAIRE DE SÉCURITÉ 🚨
                            </span>
                            <p className="font-semibold leading-relaxed">
                              Raison extraite par Gemini : <strong className="underline decoration-red-500/40">{latestReport.urgencyReason}</strong>
                            </p>
                            <p className="text-[11px] text-red-400/80 mt-1 leading-normal">
                              Veuillez vérifier immédiatement la composition d'actifs et réaffecter si nécessaire.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Historical Trends Graphs (Cash level, performance, AUM) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <SVGLineChart
                        data={selectedFundReports.map(r => ({
                          label: r.reportDate.substring(5, 7) + "/" + r.reportDate.substring(2, 4), // format MM/YY
                          value: r.cashRate || 0
                        }))}
                        title="Évolution du Taux de Cash"
                        unit="%"
                        colorClass="indigo"
                      />
                      <SVGLineChart
                        data={selectedFundReports.map(r => ({
                          label: r.reportDate.substring(5, 7) + "/" + r.reportDate.substring(2, 4),
                          value: r.performancePct || 0
                        }))}
                        title="Performance Mensuelle"
                        unit="%"
                        colorClass={latestReport?.performancePct && latestReport.performancePct >= 0 ? "emerald" : "indigo"}
                      />
                    </div>

                    {/* Latest Extraction insights from Gemini (Niveau 3 core views) */}
                    <div className="bg-[#0b0e14] rounded-xl border border-white/5 p-5 shadow-lg space-y-4">
                      <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                        <h4 className="font-bold text-xs text-white flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-indigo-400" />
                          CONGRUENCE IA - Dernières Perspectives (Rapport du {latestReport?.reportDate || "N/A"})
                        </h4>
                        {latestReport?.extractedByAi && (
                          <span className="text-[9px] bg-indigo-500/10 text-indigo-300 font-semibold px-2 py-0.5 rounded border border-indigo-500/20">
                            Extrait par Gemini API
                          </span>
                        )}
                      </div>

                      <div className="space-y-3.5 text-xs">
                        <div className="space-y-1">
                          <span className="font-bold text-gray-500 uppercase tracking-wider text-[9px]">🔮 Perspectives Fondamentales (Gérant)</span>
                          <p className="text-gray-300 leading-relaxed font-sans bg-[#050608] p-3 rounded-lg border border-white/5">
                            {latestReport?.keyViews || "Aucune donnée de vue de gestion récente."}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <span className="font-bold text-gray-500 uppercase tracking-wider text-[9px]">🗺️ Positionnement Tactique Extrait</span>
                          <p className="text-gray-300 leading-relaxed font-sans bg-[#050608] p-3 rounded-lg border border-white/5">
                            {latestReport?.positioning || "Aucune donnée de positionnement récent."}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* LE COIN DE L'ANALYSTE: MANUAL OVERRIDES (PERSISTENT DATA OVER AI) */}
                    <div className="bg-[#0b0e14] rounded-xl border border-white/5 p-5 shadow-lg space-y-4">
                      <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                        <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                          <UserCheck className="h-4 w-4 text-indigo-400" />
                          👤 Le Coin de l'Analyste (Surcharge Manuelle & Notes)
                        </h4>
                        <span className="text-[10px] text-gray-400 font-medium">Prioritaire sur l'IA</span>
                      </div>

                      <form onSubmit={handleSaveOverride} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            Positionnement Corrigé / Surcharge d'Arbitrage
                          </label>
                          <textarea
                            value={overridePositioning}
                            onChange={(e) => setOverridePositioning(e.target.value)}
                            placeholder="Saisissez ici le positionnement validé définitivement par l'analyste responsable (écrase le positionnement brut extrait par l'IA dans vos rapports de synthèse)..."
                            className="w-full text-xs p-3 border border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-[#050608] text-white"
                            rows={2}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            Commentaires Internes & Notes de Recherche de l'Analyste
                          </label>
                          <textarea
                            value={overrideComment}
                            onChange={(e) => setOverrideComment(e.target.value)}
                            placeholder="Renseignez vos notes de recherche interne, points de vigilance, ou comptes-rendus d'appels gérants spécifiques à l'équipe d'analyse financière..."
                            className="w-full text-xs p-3 border border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-[#050608] text-white"
                            rows={3}
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div className="text-[11px] text-gray-400 font-mono">
                            {activeOverride ? (
                              <span>Dernière mise à jour : {new Date(activeOverride.updatedAt).toLocaleDateString()}</span>
                            ) : (
                              <span>Aucun override saisi actuellement</span>
                            )}
                          </div>
                          
                          <button
                            type="submit"
                            disabled={overrideSaving}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors shadow-lg shadow-indigo-600/10 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            {overrideFeedback ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-300 animate-bounce" />
                                Modifications Sauvegardées !
                              </>
                            ) : (
                              <>
                                <Edit3 className="h-3.5 w-3.5" />
                                {overrideSaving ? "Enregistrement..." : "Sauvegarder Surcharges"}
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>

                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* --- TAB B: INGESTION PLAYGROUND (GMAIL & PDF EXTRACT SIMULATOR) --- */}
        {activeTab === "ingestion" && (
          <div className="space-y-8 animate-fade-in text-gray-200">
            
            {/* Context introduction */}
            <div className="bg-[#0b0e14] rounded-xl border border-white/5 p-5 shadow-lg">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Mail className="h-5 w-5 text-indigo-400" />
                Ingestion Multimodale & Playground d'Extraction IA (Gemini)
              </h2>
              <p className="text-xs text-gray-400 mt-1 max-w-4xl">
                Simulez la réception de flux Gmail d'asset managers ou l'extraction brute de rapports PDF. 
                Gemini applique un filtrage du bruit pour éliminer le spam publicitaire, décèle les urgences, 
                et structure les informations quantitatives et qualitatives pour votre base de données.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Email input fields (5 Cols) */}
              <div className="lg:col-span-5 bg-[#0b0e14] rounded-xl border border-white/5 p-5 shadow-lg flex flex-col justify-between">
                <div className="space-y-4">
                  
                  {/* Real file import: PDF, email export (.eml), or plain text */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                      1. Importer un fichier réel (PDF, .eml, .txt)
                    </label>
                    <label
                      htmlFor="real-file-import"
                      className={`block border-2 border-dashed rounded-lg p-4 text-center cursor-pointer bg-[#050608]/40 transition-colors ${
                        importingFile
                          ? "border-indigo-500/40 bg-indigo-950/10"
                          : "border-white/10 hover:border-indigo-500/40 hover:bg-[#050608]/80"
                      }`}
                    >
                      <input
                        id="real-file-import"
                        type="file"
                        accept=".pdf,.txt,.eml,application/pdf,text/plain"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileImport(file);
                          e.target.value = "";
                        }}
                      />
                      {importingFile ? (
                        <>
                          <RefreshCw className="h-5 w-5 text-indigo-400 mx-auto mb-1 animate-spin" />
                          <p className="text-[10px] font-bold text-indigo-300">Lecture du fichier en cours...</p>
                        </>
                      ) : importedFileName ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
                          <p className="text-[10px] font-bold text-emerald-300 truncate">{importedFileName}</p>
                          <p className="text-[9px] text-gray-500 mt-0.5">Cliquez pour importer un autre fichier</p>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="h-5 w-5 text-gray-500 mx-auto mb-1" />
                          <p className="text-[10px] font-bold text-gray-300">Importer un rapport PDF ou un email</p>
                          <p className="text-[9px] text-gray-500 mt-0.5">Le texte sera automatiquement extrait ci-dessous</p>
                        </>
                      )}
                    </label>
                    {importError && (
                      <p className="text-[10px] text-red-400 font-medium">{importError}</p>
                    )}
                  </div>

                  {/* Input form for Subject & Text */}
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Sujet de l'E-mail / Titre du Rapport
                      </label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="w-full text-xs p-2.5 border border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-medium bg-[#050608] text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Texte brut extrait (Email / PDF)
                      </label>
                      <textarea
                        value={emailText}
                        onChange={(e) => setEmailText(e.target.value)}
                        className="w-full text-xs p-3 border border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono bg-[#050608] text-white"
                        rows={8}
                      />
                    </div>
                  </div>

                </div>

                <div className="pt-4 border-t border-white/5 mt-4">
                  <button
                    onClick={handleExtract}
                    disabled={extracting || !emailText}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-lg transition-colors shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {extracting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Analyse Gemini en cours...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Lancer l'Extraction par l'IA (Gemini API)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column: AI Extraction Breakdown & DB Mapping (7 Cols) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Loader screen when extracting */}
                {extracting && (
                  <div className="bg-[#0b0e14] rounded-xl border border-white/5 p-8 text-center space-y-4 shadow-lg">
                    <div className="relative h-12 w-12 mx-auto">
                      <span className="absolute inset-0 rounded-full border-4 border-indigo-500/10 animate-pulse" />
                      <span className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-white">Orchestration Gemini Active...</p>
                      <p className="text-xs text-indigo-400 font-mono animate-pulse">Filtering noise / extracting vectors / matching attributes</p>
                    </div>
                    <div className="max-w-md mx-auto bg-[#050608] rounded-lg p-3 text-[10px] text-gray-500 leading-normal border border-white/5">
                      Un prompt d'instruction strict combiné à un schéma de sortie structuré garantit que 
                      l'extraction s'insère sans rupture dans la base de données SQL.
                    </div>
                  </div>
                )}

                {/* Extraction error display */}
                {extractError && !extracting && (
                  <div className="bg-red-950/20 rounded-xl border border-red-500/30 p-6 text-center space-y-2 shadow-lg">
                    <AlertTriangle className="h-8 w-8 text-red-400 mx-auto" />
                    <h3 className="text-sm font-bold text-red-300">Échec de l'extraction</h3>
                    <p className="text-xs text-red-200/80 max-w-md mx-auto">{extractError}</p>
                    <p className="text-[10px] text-gray-500 mt-2">
                      Astuce : si le document est très long, essayez de réduire le texte collé ou de ne garder que les sections pertinentes.
                    </p>
                  </div>
                )}

                {/* Empty state when no extraction is run */}
                {!extractionResult && !extracting && !extractError && (
                  <div className="bg-[#0b0e14] rounded-xl border border-white/5 p-12 text-center space-y-3 shadow-lg">
                    <div className="bg-indigo-500/10 h-12 w-12 rounded-full flex items-center justify-center mx-auto text-indigo-400">
                      <Database className="h-6 w-6" />
                    </div>
                    <h3 className="text-sm font-bold text-white">En attente d'Ingestion</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      Sélectionnez l'un de nos exemples à gauche ou collez votre propre texte de rapport financier, 
                      puis cliquez sur le bouton d'extraction pour voir l'IA structurer la donnée en temps réel.
                    </p>
                  </div>
                )}

                {/* Structured Extraction Results */}
                {extractionResult && !extracting && (
                  <div className="space-y-6 animate-fade-in">
                    
                    {/* Header summary of extraction */}
                    <div className="bg-[#0b0e14] rounded-xl border border-white/5 p-5 shadow-lg space-y-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <h3 className="font-bold text-xs uppercase text-gray-500 tracking-wider">
                          Résultats d'Extraction IA Structurée
                        </h3>
                        {extractionResult.api_mocked ? (
                          <span className="text-[10px] bg-amber-500/10 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/20">
                            Simulateur Local Actif
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/20">
                            Direct Gemini Live API
                          </span>
                        )}
                      </div>

                      {/* Case 1: Noise Detected */}
                      {extractionResult.raw_extraction.is_noise ? (
                        <div className="bg-[#050608] border border-white/5 rounded-xl p-6 text-center space-y-3 shadow-inner">
                          <div className="bg-white/5 h-10 w-10 rounded-full flex items-center justify-center mx-auto text-gray-400">
                            <X className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="text-[10px] bg-white/5 text-gray-300 border border-white/10 font-bold px-2.5 py-0.5 rounded uppercase tracking-wider inline-block">
                              🔇 BRUIT DÉTECTÉ ET REJETÉ
                            </span>
                            <p className="text-xs font-semibold text-gray-300 mt-2">
                              Raison du filtrage : <strong className="text-indigo-400">{extractionResult.raw_extraction.noise_reason}</strong>
                            </p>
                            <p className="text-[10px] text-gray-500 max-w-md mx-auto mt-1 leading-normal">
                              Le modèle a identifié que cet e-mail n'apporte aucune valeur fondamentale au portefeuille. 
                              Il est filtré et ne pollue pas votre base de données ni votre tableau de bord d'analystes.
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* Case 2: Valid Ingestion Extraction display */
                        <div className="space-y-4">
                          
                          {/* Alert if Emergency */}
                          {extractionResult.raw_extraction.is_emergency && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3.5 text-xs text-red-200 flex items-start gap-2.5">
                              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                              <div>
                                <span className="font-bold text-[9px] uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">
                                  URGENCE DÉCELÉE 🚨
                                </span>
                                <p className="font-semibold mt-1 leading-normal">
                                  Alerte : {extractionResult.raw_extraction.emergency_reason}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Info Grid Card */}
                          <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4 space-y-3.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-indigo-500/20 pb-2.5 gap-2">
                              <div>
                                <h4 className="text-xs font-bold text-white">
                                  Fonds : {extractionResult.raw_extraction.fund_name}
                                </h4>
                                <p className="text-[10px] text-gray-400">
                                  Gérant d'Actifs : <strong className="text-gray-300">{extractionResult.raw_extraction.asset_manager}</strong>
                                </p>
                              </div>

                              <div className="text-[10px] bg-[#050608] border border-white/5 text-indigo-400 font-bold px-2.5 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                                <UserCheck className="h-3 w-3" />
                                Routé vers : {portalData.funds.find(f => f.name.toLowerCase().includes(extractionResult.raw_extraction.fund_name.toLowerCase()))?.analystId || "Antoine (Nouveau Fonds Auto-Match)"}
                              </div>
                            </div>

                            {/* Core Financial Indicators */}
                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-[#050608] border border-white/5 p-2.5 rounded-lg text-center shadow-inner">
                                <span className="block text-[9px] text-gray-500 uppercase font-bold tracking-wider">Actifs (AUM)</span>
                                <span className="text-xs font-extrabold text-indigo-400 font-mono">
                                  {extractionResult.raw_extraction.aum_m ? `${extractionResult.raw_extraction.aum_m}M` : "N/A"}
                                </span>
                              </div>
                              <div className="bg-[#050608] border border-white/5 p-2.5 rounded-lg text-center shadow-inner">
                                <span className="block text-[9px] text-gray-500 uppercase font-bold tracking-wider">Taux Cash</span>
                                <span className="text-xs font-extrabold text-indigo-400 font-mono">
                                  {extractionResult.raw_extraction.cash_rate ? `${extractionResult.raw_extraction.cash_rate}%` : "N/A"}
                                </span>
                              </div>
                              <div className="bg-[#050608] border border-white/5 p-2.5 rounded-lg text-center shadow-inner">
                                <span className="block text-[9px] text-gray-500 uppercase font-bold tracking-wider">Perf. Mensuelle</span>
                                <span className={`text-xs font-extrabold font-mono ${extractionResult.raw_extraction.performance_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {extractionResult.raw_extraction.performance_pct ? `${extractionResult.raw_extraction.performance_pct > 0 ? '+' : ''}${extractionResult.raw_extraction.performance_pct}%` : "N/A"}
                                </span>
                              </div>
                            </div>

                            {/* Qual text */}
                            <div className="space-y-2 text-xs">
                              <div>
                                <span className="font-bold text-gray-400 text-[9px] uppercase tracking-wider block">🔮 Vues Clés (IA)</span>
                                <p className="text-gray-300 leading-normal bg-[#050608]/80 p-2.5 rounded border border-white/5 mt-0.5">
                                  {extractionResult.raw_extraction.key_views}
                                </p>
                              </div>
                              <div>
                                <span className="font-bold text-gray-400 text-[9px] uppercase tracking-wider block">🗺️ Positionnement Tactique (IA)</span>
                                <p className="text-gray-300 leading-normal bg-[#050608]/80 p-2.5 rounded border border-white/5 mt-0.5">
                                  {extractionResult.raw_extraction.positioning}
                                </p>
                              </div>
                            </div>

                          </div>
                        </div>
                      )}
                    </div>

                    {/* Raw Expandable JSON block */}
                    <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Response JSON Payload</span>
                        <span className="text-[9px] text-slate-500">Structured Schema Compliant</span>
                      </div>
                      <pre className="text-[10px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-56">
                        {JSON.stringify(extractionResult.raw_extraction, null, 2)}
                      </pre>
                    </div>

                  </div>
                )}

              </div>

            </div>
          </div>
        )}

        {/* --- TAB C: DATABASE SCHEMA & FLOW --- */}
        {activeTab === "schema" && (
          <SchemaAndArch portalData={portalData} />
        )}

        {/* --- TAB D: DEVELOPER RESOURCES --- */}
        {activeTab === "resources" && portalData && (
          <AnalystPortal portalData={portalData} />
        )}

      </main>

      {/* 4. DIALOG MODALS CONTAINER */}

      {/* A. MULTI-GÉRANTS COMPARATIVE SYNTHESIS GENERATOR MODAL */}
      {showSynthesizeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="synthesis-modal">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">Générer Synthèse Multi-Gérants (RAG)</h3>
              </div>
              <button 
                onClick={() => setShowSynthesizeModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-normal">
              Cochez plusieurs sociétés de gestion d'actifs ci-dessous. Gemini effectuera un point de 
              recherche croisé pour confronter leurs vues actuelles et synthétiser un comparatif direct en 
              5 puces analytiques d'une pertinence absolue.
            </p>

            {/* Checkbox selector */}
            <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-100 space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Asset Managers Disponibles
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {portalData.assetManagers.map((mgr) => {
                  const isChecked = selectedManagersForSynthesis.includes(mgr.id);
                  return (
                    <label 
                      key={mgr.id} 
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked 
                          ? "bg-indigo-50/50 border-indigo-200 font-medium text-indigo-900" 
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedManagersForSynthesis(prev => [...prev, mgr.id]);
                          } else {
                            setSelectedManagersForSynthesis(prev => prev.filter(id => id !== mgr.id));
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{mgr.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Actions & loader */}
            <div className="space-y-4">
              <button
                onClick={handleSynthesize}
                disabled={synthesizing || selectedManagersForSynthesis.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-lg transition-colors shadow-2xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {synthesizing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Extraction des rapports & Génération de la synthèse comparative...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Confronter les Opinions & Générer les 5 Puces Clés
                  </>
                )}
              </button>

              {/* Display generated text */}
              {synthesisResult && (
                <div className="bg-slate-50 rounded-lg p-4 border border-indigo-100 animate-fade-in space-y-2.5 shadow-3xs max-h-72 overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-indigo-100/60 pb-1.5">
                    <span className="text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                      📄 Synthèse Comparative de Recherche (Français)
                    </span>
                    <span className="text-[9px] text-slate-400 font-semibold font-mono">Consensus vs Divergences</span>
                  </div>
                  <div className="text-xs text-slate-700 leading-relaxed space-y-2.5 font-sans whitespace-pre-line">
                    {synthesisResult}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* B. DETAILED SYNTHESIS EXPORT ONE-PAGER MODAL */}
      {onepagerResult && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="onepager-modal">
          <div className="bg-[#0b0e14] rounded-xl border border-white/10 shadow-2xl max-w-3xl w-full p-6 space-y-5">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">One-Pager de Recherche Exporté</h3>
              </div>
              <button 
                onClick={() => setOnepagerResult(null)}
                className="text-gray-400 hover:text-white hover:bg-white/5 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-gray-400 leading-normal">
              Cette fiche au format Markdown combine l'état quantitatif issu des rapports financiers, 
              le positionnement IA, et les surcharges d'arbitrage de l'analyste. Prêt à imprimer ou à coller.
            </p>

            <div className="bg-[#050608] border border-white/5 rounded-lg p-5 overflow-y-auto max-h-[380px] space-y-2.5 shadow-inner font-sans text-xs text-gray-300">
              {renderMarkdownText(onepagerResult)}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(onepagerResult);
                  alert("One-Pager copié dans le presse-papier !");
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors shadow-lg shadow-indigo-600/15 cursor-pointer"
              >
                Copier le Markdown
              </button>
              <button
                onClick={() => setOnepagerResult(null)}
                className="bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* C. INTEL ASSIGNMENT / ATTRIBUTION RULE MODAL */}
      {assignmentFundId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="assignment-modal">
          <div className="bg-[#0b0e14] rounded-xl border border-white/10 shadow-2xl max-w-md w-full p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-indigo-400" />
                Attribuer l'analyste responsable
              </h3>
              <button 
                onClick={() => setAssignmentFundId(null)}
                className="text-gray-400 hover:text-white hover:bg-white/5 p-1 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-gray-400 leading-normal">
              Associez ce fonds à l'un de vos 4 analystes d'équipe. Vous pouvez également déclarer un 
              pattern textuel d'attribution intelligente (ex: "Water") pour que les prochains e-mails 
              portant ce nom soient affectés automatiquement à cet analyste !
            </p>

            <form onSubmit={handleAssignFund} className="space-y-4 text-xs">
              
              <div className="space-y-1.5">
                <label className="block font-bold text-gray-500 uppercase tracking-wider text-[9px]">Fonds Cible</label>
                <input 
                  type="text" 
                  disabled 
                  value={portalData.funds.find(f => f.id === assignmentFundId)?.name || ""} 
                  className="w-full p-2 border border-white/5 rounded-lg bg-[#050608] text-gray-400 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-gray-500 uppercase tracking-wider text-[9px]">Analyste Responsable</label>
                <select
                  value={assignmentAnalystId}
                  onChange={(e) => setAssignmentAnalystId(e.target.value)}
                  className="w-full p-2.5 border border-white/5 rounded-lg bg-[#050608] text-white focus:outline-none focus:border-indigo-500/50"
                >
                  {teamAnalysts.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-gray-500 uppercase tracking-wider text-[9px]">Pattern de Détection Automatique (Intelligent Assignment)</label>
                <input 
                  type="text" 
                  value={assignmentPattern} 
                  onChange={(e) => setAssignmentPattern(e.target.value)}
                  placeholder="ex: Water (détectera automatiquement 'Sustainable Water', 'Water Equities')" 
                  className="w-full p-2.5 border border-white/5 rounded-lg bg-[#050608] text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50"
                />
                <span className="text-[10px] text-gray-500 leading-normal">
                  L'application s'en souviendra pour toutes les futures extractions de rapports !
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setAssignmentFundId(null)}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs px-4 py-2 rounded-lg cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-lg shadow-indigo-600/15 cursor-pointer"
                >
                  Sauvegarder l'Attribution
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* 5. FOOTER STICKER */}
      <footer className="bg-[#080a0f] border-t border-white/5 py-5 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-[10px] text-gray-500 font-medium">
            &copy; 2026 Asset Management Augmented Intelligence Portal &bull; Conçu pour Damien, Maxime, Benoît, et Antoine.
          </p>
          <p className="text-[10px] text-gray-500 font-medium flex items-center justify-center gap-1">
            <Code2 className="h-3 w-3 text-indigo-400" />
            Vite + React 19 + Express + Gemini 3.5 Flash
          </p>
        </div>
      </footer>

    </div>
  );
}
