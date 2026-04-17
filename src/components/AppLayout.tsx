import { 
  LayoutDashboard, 
  FileInput, 
  FileOutput, 
  FileCheck2, 
  ClipboardList,
  Building2,
  Menu,
  X,
  Landmark,
  GitBranch,
  Calendar,
  AlertTriangle,
  Hash,
  Settings,
  Upload,
  BookOpen,
  MapPin,
  History,
  Search,
  PiggyBank,
  BarChart3,
  Database,
  ShieldCheck,
  Users,
  LogOut
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard, section: 'principal' },
  { id: 'import-wizard', label: 'Importation', icon: Upload, section: 'principal' },
  { id: 'import', label: 'Import Excel', icon: FileInput, section: 'principal' },
  { id: 'generate', label: 'Génération', icon: FileOutput, section: 'principal' },
  { id: 'reconciliation', label: 'Réconciliation', icon: FileCheck2, section: 'principal' },
  { id: 'history', label: 'Historique', icon: History, section: 'principal' },
  { id: 'audit', label: 'Journal d\'Audit', icon: ClipboardList, section: 'principal' },
  { id: 'referentiel', label: 'Référentiel', icon: PiggyBank, section: 'config' },
  { id: 'reference-table', label: 'Table Référence', icon: BookOpen, section: 'config' },
  { id: 'caisses', label: 'Table Caisses', icon: MapPin, section: 'config' },
  { id: 'companies', label: 'Entreprises', icon: Building2, section: 'config' },
  { id: 'clm', label: 'Agences CLM', icon: Landmark, section: 'config' },
  { id: 'splitting', label: 'Règles Splitting', icon: GitBranch, section: 'config' },
  { id: 'flux', label: 'Compteur Flux', icon: Calendar, section: 'suivi' },
  { id: 'alerts', label: 'Alertes', icon: AlertTriangle, section: 'suivi' },
  { id: 'matricule', label: 'Outil Matricule', icon: Hash, section: 'outils' },
  { id: 'oracle', label: 'Oracle Amplitude', icon: Database, section: 'config' },
  { id: 'validation', label: 'Validation Paies', icon: ShieldCheck, section: 'admin' },
  { id: 'users', label: 'Utilisateurs', icon: Users, section: 'admin' },
];

export function AppLayout({ children, activeTab, onTabChange }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { profile, isSuperAdmin, isAdmin, signOut } = useAuth();

  const villeLabel = profile?.ville === 'POINTE_NOIRE' ? 'Pointe-Noire' : 'Brazzaville';
  const roleLabel = isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Utilisateur';

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "hidden lg:flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-sidebar-border">
          <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <Building2 className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          {sidebarOpen && (
            <div className="animate-fade-in flex-1 min-w-0">
              <h1 className="font-bold text-sm">MUCO-AMPLITUDE</h1>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-sidebar-foreground/30 text-sidebar-foreground/80">
                  {villeLabel}
                </Badge>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-sidebar-foreground/30 text-sidebar-foreground/80">
                  {roleLabel}
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {/* Principal */}
          <div className="space-y-1">
            {sidebarOpen && <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase">Principal</p>}
            {navItems.filter(i => i.section === 'principal').map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
                </button>
              );
            })}
          </div>

          {/* Configuration */}
          <div className="space-y-1">
            {sidebarOpen && <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase">Configuration</p>}
            {navItems.filter(i => i.section === 'config').map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
                </button>
              );
            })}
          </div>

          {/* Suivi */}
          <div className="space-y-1">
            {sidebarOpen && <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase">Suivi</p>}
            {navItems.filter(i => i.section === 'suivi').map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
                </button>
              );
            })}
          </div>

          {/* Outils */}
          <div className="space-y-1">
            {sidebarOpen && <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase">Outils</p>}
            {navItems.filter(i => i.section === 'outils').map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
                </button>
              );
            })}
          </div>

          {/* Admin (filtré par rôle) */}
          {(isAdmin || isSuperAdmin) && (
            <div className="space-y-1">
              {sidebarOpen && <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase">Administration</p>}
              {navItems
                .filter((i) => i.section === 'admin')
                .filter((i) => (i.id === 'users' ? isSuperAdmin : isAdmin))
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
                    </button>
                  );
                })}
            </div>
          )}
        </nav>

        {/* Footer Buttons */}
        <div className="p-3 border-t border-sidebar-border space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-5 w-5" />
            {sidebarOpen && <span className="ml-2 text-sm">Déconnexion</span>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Menu className="h-5 w-5" />
            {sidebarOpen && <span className="ml-2 text-sm">Réduire</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar text-sidebar-foreground z-50 flex items-center justify-between px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Building2 className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-sm">MUCO-AMPLITUDE</h1>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-sidebar-foreground"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-16 bg-sidebar z-40 animate-fade-in">
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "text-sidebar-foreground/70"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:p-6 p-4 pt-20 lg:pt-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
