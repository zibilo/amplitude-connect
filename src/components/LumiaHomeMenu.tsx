import { useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Upload,
  Wand2,
  GitCompare,
  ShieldCheck,
  Wallet,
  Users,
  Database,
  FileText,
  Building2,
  Landmark,
  Split,
  CalendarClock,
  AlertTriangle,
  ServerCog,
  CheckCircle2,
  History,
  Hash,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

interface Tile {
  id: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  wide?: boolean;
}

const TILES: Tile[] = [
  { id: "dashboard", label: "Tableau de bord", desc: "Vue globale", icon: LayoutDashboard, color: "bg-[#0078d7]", wide: true },
  { id: "import-wizard", label: "Assistant Import", desc: "7 étapes guidées", icon: Wand2, color: "bg-[#e60012]" },
  { id: "import", label: "Import paie", desc: "Excel rapide", icon: Upload, color: "bg-[#107c10]" },
  { id: "generate", label: "Génération", desc: "ISO 20022 / MUCODEC", icon: FileText, color: "bg-[#6a1b9a]", wide: true },
  { id: "reconciliation", label: "Réconciliation", desc: "Compensation & RCP", icon: GitCompare, color: "bg-[#ff8c00]" },
  { id: "credits-debts", label: "Crédits & Dettes", desc: "Engagements clients", icon: Wallet, color: "bg-[#008b8b]" },
  { id: "validation", label: "Validation", desc: "Triple check", icon: CheckCircle2, color: "bg-[#0078d7]" },
  { id: "alerts", label: "Alertes", desc: "Intégrité données", icon: AlertTriangle, color: "bg-[#e60012]" },
  { id: "flux", label: "Flux mensuels", desc: "Compteurs & cycles", icon: CalendarClock, color: "bg-[#107c10]" },
  { id: "audit", label: "Audit", desc: "Journal complet", icon: ShieldCheck, color: "bg-[#6a1b9a]" },
  { id: "history", label: "Historique", desc: "Imports passés", icon: History, color: "bg-[#008b8b]" },
  { id: "referentiel", label: "Référentiel", desc: "Sociétaires", icon: Database, color: "bg-[#0078d7]" },
  { id: "reference-table", label: "Table Référence", desc: "Corrections", icon: FileText, color: "bg-[#ff8c00]" },
  { id: "caisses", label: "Caisses", desc: "Agences & guichets", icon: Landmark, color: "bg-[#107c10]" },
  { id: "companies", label: "Sociétés", desc: "Profils facturation", icon: Building2, color: "bg-[#6a1b9a]" },
  { id: "clm", label: "CLM", desc: "Agences spéciales", icon: Building2, color: "bg-[#008b8b]" },
  { id: "splitting", label: "Règles Split", desc: "Courant / Épargne", icon: Split, color: "bg-[#0078d7]" },
  { id: "matricule", label: "Matricules", desc: "Normalisation", icon: Hash, color: "bg-[#ff8c00]" },
  { id: "oracle", label: "Oracle", desc: "Configuration DB", icon: ServerCog, color: "bg-[#e60012]" },
  { id: "users", label: "Utilisateurs", desc: "Comptes & rôles", icon: Users, color: "bg-[#107c10]" },
  { id: "guide", label: "Guide", desc: "Documentation PDF", icon: BookOpen, color: "bg-[#6a1b9a]", wide: true },
];

interface Props {
  onTileSelect: (id: string) => void;
}

export function LumiaHomeMenu({ onTileSelect }: Props) {
  const tilesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = tilesRef.current;
    if (!container) return;
    // generate floating decorative tiles
    const items: HTMLDivElement[] = [];
    for (let i = 0; i < 14; i++) {
      const t = document.createElement("div");
      const size = 30 + Math.random() * 80;
      t.className = "absolute opacity-10";
      t.style.width = `${size}px`;
      t.style.height = `${size}px`;
      t.style.left = `${Math.random() * 100}%`;
      t.style.background = Math.random() > 0.5 ? "#0078d7" : "#e60012";
      t.style.animation = `floatTile ${15 + Math.random() * 12}s linear ${Math.random() * -18}s infinite`;
      container.appendChild(t);
      items.push(t);
    }
    return () => items.forEach((i) => i.remove());
  }, []);

  return (
    <div className="relative -m-6 min-h-[calc(100vh-3rem)] overflow-hidden bg-[#0A1A2A] text-white">
      <style>{`
        @keyframes lumiaDrift { 0% { background-position: 0 0; } 100% { background-position: 72px 72px; } }
        @keyframes floatTile {
          0% { transform: translateY(110vh) rotate(0deg); opacity: 0; }
          10% { opacity: 0.18; }
          90% { opacity: 0.08; }
          100% { transform: translateY(-20vh) rotate(6deg); opacity: 0; }
        }
      `}</style>
      {/* radial bg */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(circle at 30% 40%, #0a2a3a, #000000)" }}
      />
      {/* dot grid */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#0089ff 1.2px, transparent 1.2px)",
          backgroundSize: "36px 36px",
          animation: "lumiaDrift 28s linear infinite",
        }}
      />
      {/* floating decorative tiles */}
      <div ref={tilesRef} className="absolute inset-0 overflow-hidden pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 px-4 py-8">
        <header className="text-center pb-6">
          <h1 className="text-3xl md:text-4xl font-light tracking-[0.2em] uppercase">MUCO-AMPLITUDE</h1>
          <p className="text-[#0078d7] text-xs uppercase tracking-widest mt-2">
            Middleware sécurisé — Menu principal
          </p>
        </header>

        <div
          className="grid gap-4 mx-auto max-w-6xl"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          }}
        >
          {TILES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => onTileSelect(t.id)}
                className={`${t.color} ${
                  t.wide ? "sm:col-span-2 aspect-[2/1]" : "aspect-square"
                } flex flex-col items-center justify-center text-center p-4 text-white transition-all duration-200 hover:opacity-85 active:scale-[0.97] border-0 cursor-pointer shadow-lg`}
                style={{ fontFamily: "'Segoe UI', 'Inter', sans-serif" }}
              >
                <Icon className="w-10 h-10 mb-2" strokeWidth={1.5} />
                <div className="text-sm font-semibold uppercase tracking-wider">{t.label}</div>
                <div className="text-[10px] opacity-80 mt-1">{t.desc}</div>
              </button>
            );
          })}
        </div>

        <div className="text-center text-[10px] text-white/60 mt-8 uppercase tracking-widest">
          Windows 8 / Lumia Style • Sécurisé SSL
        </div>
      </div>
    </div>
  );
}