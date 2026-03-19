import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FolderOpen, Eye, Loader2 } from 'lucide-react';
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

export function ImportHistory() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ImportSession | null>(null);
  const [entries, setEntries] = useState<ImportEntry[]>([]);
  const [caisses, setCaisses] = useState<CaisseInfo[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

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

  const viewDetails = async (session: ImportSession) => {
    setSelectedSession(session);
    // Fetch ALL entries for this session (not just valid), increase limit
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
      // Fetch ALL entries for this session (remove status filter, increase limit)
      const { data: sessionEntries, error } = await supabase
        .from('import_entries')
        .select('*')
        .eq('session_id', session.id)
        .limit(10000);

      if (error) {
        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
        return;
      }

      if (!sessionEntries || sessionEntries.length === 0) {
        toast({ title: 'Aucune donnée', description: `Pas d'entrées trouvées pour la session ${session.file_name}. Vérifiez que l'import a bien été effectué.`, variant: 'destructive' });
        return;
      }

      // Group by code_caisse
      const byCaisse = new Map<string, typeof sessionEntries>();
      sessionEntries.forEach(entry => {
        const key = entry.code_caisse;
        if (!byCaisse.has(key)) byCaisse.set(key, []);
        byCaisse.get(key)!.push(entry);
      });

      const moisStr = String(session.mois).padStart(2, '0');
      const folderName = `SARIS_${moisStr}_${session.annee}`;

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

      toast({ 
        title: 'Fichiers générés', 
        description: `${allFiles.length} fichier(s) pour ${folderName}` 
      });
    } catch (err) {
      toast({ title: 'Erreur', description: 'Impossible de générer les fichiers', variant: 'destructive' });
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Historique des Imports</h1>
        <p className="text-muted-foreground mt-1">Liste de tous les imports effectués · Génération d'arborescence par caisse</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Période</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Fichier</TableHead>
                <TableHead className="text-right">Lignes</TableHead>
                <TableHead className="text-right">Valides</TableHead>
                <TableHead className="text-right">Rejetées</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">Aucun import effectué</TableCell>
                </TableRow>
              ) : sessions.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="text-sm">{new Date(s.created_at).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell className="font-mono">{String(s.mois).padStart(2, '0')}/{s.annee}</TableCell>
                  <TableCell>
                    {s.entreprise === 'QUINZAINE' ? (
                      <Badge variant="secondary" className="text-xs">Quinzaine</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Standard</Badge>
                    )}
                  </TableCell>
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
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Import du {selectedSession && new Date(selectedSession.created_at).toLocaleDateString('fr-FR')} — {selectedSession && `${String(selectedSession.mois).padStart(2, '0')}/${selectedSession.annee}`}
              {selectedSession?.entreprise === 'QUINZAINE' && <Badge variant="secondary" className="ml-2">Quinzaine</Badge>}
            </DialogTitle>
          </DialogHeader>

          {selectedSession && (() => {
            const grouped = new Map<string, ImportEntry[]>();
            entries.forEach(e => {
              if (!grouped.has(e.code_caisse)) grouped.set(e.code_caisse, []);
              grouped.get(e.code_caisse)!.push(e);
            });

            return (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Structure: <span className="font-mono font-bold">SARIS_{String(selectedSession.mois).padStart(2, '0')}_{selectedSession.annee}/</span>
                  {' · '}{entries.length} entrées trouvées
                </div>
                {entries.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune entrée trouvée pour cette session
                  </div>
                )}
                {Array.from(grouped.entries()).map(([code, caisseEntries]) => (
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
