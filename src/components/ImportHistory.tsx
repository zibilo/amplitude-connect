import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FolderOpen, Eye, Loader2, ChevronRight, ChevronDown, Building2, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportSession {
  id: string;
  mois: number;
  annee: number;
  entreprise: string | null;
  file_name: string;
  total_lignes: number;
  lignes_valides: number;
  lignes_rejetees: number;
  montant_total: number;
  status: string;
  corrections_applied: number;
  created_at: string;
}

interface ImportEntry {
  id: string;
  periode: string;
  matricule: string;
  nom: string;
  prenom: string | null;
  code_caisse: string;
  cco: string;
  montant: number;
}

interface CaisseInfo {
  code_caisse: string;
  nom_caisse: string;
}

type GroupedByCompany = Map<string, Map<string, ImportSession[]>>;

const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

export function ImportHistory() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ImportSession | null>(null);
  const [entries, setEntries] = useState<ImportEntry[]>([]);
  const [caisses, setCaisses] = useState<CaisseInfo[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [openCompanies, setOpenCompanies] = useState<Set<string>>(new Set());
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSessions();
    fetchCaisses();
  }, []);

  const fetchSessions = async () => {
    const { data } = await supabase.from('import_sessions').select('*').order('created_at', { ascending: false });
    if (data) setSessions(data as ImportSession[]);
  };

  const fetchCaisses = async () => {
    const { data } = await supabase.from('caisses').select('code_caisse, nom_caisse');
    if (data) setCaisses(data);
  };

  const groupByCompanyAndMonth = (): GroupedByCompany => {
    const grouped: GroupedByCompany = new Map();
    sessions.forEach(s => {
      const company = s.entreprise || 'Non classé';
      const monthKey = `${String(s.mois).padStart(2, '0')}/${s.annee}`;
      if (!grouped.has(company)) grouped.set(company, new Map());
      const companyMap = grouped.get(company)!;
      if (!companyMap.has(monthKey)) companyMap.set(monthKey, []);
      companyMap.get(monthKey)!.push(s);
    });
    return grouped;
  };

  const toggleCompany = (company: string) => {
    setOpenCompanies(prev => {
      const next = new Set(prev);
      if (next.has(company)) next.delete(company); else next.add(company);
      return next;
    });
  };

  const toggleMonth = (key: string) => {
    setOpenMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const viewDetails = async (session: ImportSession) => {
    setSelectedSession(session);
    const { data } = await supabase
      .from('import_entries')
      .select('*')
      .eq('session_id', session.id)
      .order('code_caisse')
      .limit(5000);
    if (data) setEntries(data as ImportEntry[]);
    setDetailOpen(true);
  };

  const getCaisseName = (code: string) => {
    return caisses.find(c => c.code_caisse === code)?.nom_caisse || code;
  };

  const generateFolderStructure = async (session: ImportSession) => {
    setGenerating(session.id);
    try {
      const { data: sessionEntries, error } = await supabase
        .from('import_entries')
        .select('*')
        .eq('session_id', session.id)
        .limit(10000);

      if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
      if (!sessionEntries || sessionEntries.length === 0) { toast({ title: 'Aucune donnée', description: 'Pas d\'entrées trouvées.', variant: 'destructive' }); return; }

      const byCaisse = new Map<string, typeof sessionEntries>();
      sessionEntries.forEach(entry => {
        const key = entry.code_caisse;
        if (!byCaisse.has(key)) byCaisse.set(key, []);
        byCaisse.get(key)!.push(entry);
      });

      const moisStr = String(session.mois).padStart(2, '0');
      const companyName = (session.entreprise || 'INCONNU').replace(/[^a-zA-Z0-9_-]/g, '_');
      const folderName = `${companyName}/${moisStr}_${session.annee}`;

      const allFiles: { name: string; entries: typeof sessionEntries }[] = [];
      byCaisse.forEach((caisseEntries, code) => {
        const nom = getCaisseName(code).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        allFiles.push({
          name: `${folderName}/${nom}/integration_${nom}_${moisStr}_${session.annee}.xlsx`,
          entries: caisseEntries,
        });
      });

      for (const file of allFiles) {
        const wb = XLSX.utils.book_new();
        const wsData = file.entries.map(e => ({
          PERIODE: e.periode,
          MATRICULE: e.matricule,
          NOM: e.nom,
          PRENOM: e.prenom || '',
          'CODE CAISSE': e.code_caisse,
          CCO: e.cco,
          MONTANT: e.montant,
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'Données');
        const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name.split('/').pop() || 'export.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      }

      toast({ title: 'Fichiers générés', description: `${allFiles.length} fichier(s) pour ${folderName}` });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de générer les fichiers', variant: 'destructive' });
    } finally {
      setGenerating(null);
    }
  };

  const grouped = groupByCompanyAndMonth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Historique des Imports</h1>
        <p className="text-muted-foreground mt-1">Organisé par entreprise et période · Génération d'arborescence par caisse</p>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucun import effectué
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {Array.from(grouped.entries()).map(([company, monthsMap]) => {
            const isCompanyOpen = openCompanies.has(company);
            const totalSessions = Array.from(monthsMap.values()).reduce((s, arr) => s + arr.length, 0);
            const totalAmount = Array.from(monthsMap.values()).flat().reduce((s, sess) => s + (sess.montant_total || 0), 0);

            return (
              <Card key={company}>
                <Collapsible open={isCompanyOpen} onOpenChange={() => toggleCompany(company)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                      <CardTitle className="flex items-center justify-between text-base">
                        <div className="flex items-center gap-2">
                          {isCompanyOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <Building2 className="h-4 w-4 text-primary" />
                          <span>{company}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{totalSessions} import(s)</Badge>
                          <Badge variant="outline" className="font-mono">{totalAmount.toLocaleString('fr-FR')} FCFA</Badge>
                        </div>
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-2">
                      {Array.from(monthsMap.entries())
                        .sort(([a], [b]) => b.localeCompare(a))
                        .map(([monthKey, monthSessions]) => {
                          const fullKey = `${company}|${monthKey}`;
                          const isMonthOpen = openMonths.has(fullKey);
                          const [mm, yyyy] = monthKey.split('/');
                          const monthName = MONTH_NAMES[parseInt(mm) - 1] || mm;
                          const monthTotal = monthSessions.reduce((s, sess) => s + (sess.montant_total || 0), 0);

                          return (
                            <Collapsible key={fullKey} open={isMonthOpen} onOpenChange={() => toggleMonth(fullKey)}>
                              <CollapsibleTrigger asChild>
                                <div className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors">
                                  <div className="flex items-center gap-2">
                                    {isMonthOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium text-sm">{monthName} {yyyy}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs">{monthSessions.length} fichier(s)</Badge>
                                    <span className="text-xs font-mono text-muted-foreground">{monthTotal.toLocaleString('fr-FR')}</span>
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="ml-6 mt-1 rounded-lg border overflow-hidden">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Fichier</TableHead>
                                        <TableHead className="text-right">Lignes</TableHead>
                                        <TableHead className="text-right">Valides</TableHead>
                                        <TableHead className="text-right">Rejetées</TableHead>
                                        <TableHead className="text-right">Montant</TableHead>
                                        <TableHead>Statut</TableHead>
                                        <TableHead className="w-24">Actions</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {monthSessions.map(s => (
                                        <TableRow key={s.id}>
                                          <TableCell className="text-sm">{new Date(s.created_at).toLocaleDateString('fr-FR')}</TableCell>
                                          <TableCell className="text-sm max-w-[200px] truncate">{s.file_name}</TableCell>
                                          <TableCell className="text-right">{s.total_lignes}</TableCell>
                                          <TableCell className="text-right text-success">{s.lignes_valides}</TableCell>
                                          <TableCell className="text-right text-destructive">{s.lignes_rejetees}</TableCell>
                                          <TableCell className="text-right font-mono">{s.montant_total?.toLocaleString('fr-FR')}</TableCell>
                                          <TableCell>
                                            <Badge className={s.status === 'completed' ? 'status-valid' : 'status-pending'}>
                                              {s.status === 'completed' ? 'Terminé' : s.status}
                                            </Badge>
                                          </TableCell>
                                          <TableCell>
                                            <div className="flex gap-1">
                                              <Button variant="ghost" size="icon" onClick={() => viewDetails(s)} title="Voir détails">
                                                <Eye className="h-4 w-4" />
                                              </Button>
                                              <Button 
                                                variant="ghost" size="icon" 
                                                onClick={() => generateFolderStructure(s)}
                                                disabled={generating === s.id}
                                                title="Générer dossiers"
                                              >
                                                {generating === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
                                              </Button>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedSession?.entreprise && <span className="text-primary">{selectedSession.entreprise}</span>}
              {' — '}Import du {selectedSession && new Date(selectedSession.created_at).toLocaleDateString('fr-FR')} — {selectedSession && `${String(selectedSession.mois).padStart(2, '0')}/${selectedSession.annee}`}
            </DialogTitle>
          </DialogHeader>

          {selectedSession && (() => {
            const groupedEntries = new Map<string, ImportEntry[]>();
            entries.forEach(e => {
              if (!groupedEntries.has(e.code_caisse)) groupedEntries.set(e.code_caisse, []);
              groupedEntries.get(e.code_caisse)!.push(e);
            });

            return (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Structure: <span className="font-mono font-bold">{selectedSession.entreprise || 'INCONNU'}/{String(selectedSession.mois).padStart(2, '0')}_{selectedSession.annee}/</span>
                  {' · '}{entries.length} entrées
                </div>
                {entries.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">Aucune entrée trouvée</div>
                )}
                {Array.from(groupedEntries.entries()).map(([code, caisseEntries]) => (
                  <Card key={code}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-accent" />
                        📁 {getCaisseName(code)}/ 
                        <Badge variant="secondary">{caisseEntries.length} entrées</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Matricule</TableHead>
                            <TableHead>Nom</TableHead>
                            <TableHead>CCO</TableHead>
                            <TableHead className="text-right">Montant</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {caisseEntries.slice(0, 10).map(e => (
                            <TableRow key={e.id}>
                              <TableCell className="font-mono">{e.matricule}</TableCell>
                              <TableCell>{e.nom} {e.prenom}</TableCell>
                              <TableCell>{e.cco}</TableCell>
                              <TableCell className="text-right font-mono">{e.montant.toLocaleString('fr-FR')}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {caisseEntries.length > 10 && (
                        <p className="text-xs text-muted-foreground p-2 text-center">...et {caisseEntries.length - 10} autres</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
