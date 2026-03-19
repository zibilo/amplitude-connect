import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Search, ArrowRight, Upload, FileSpreadsheet, CheckCircle2, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Correction {
  id: string;
  matricule_errone: string;
  cco_errone: string | null;
  matricule_correct: string;
  cco_correct: string | null;
  commentaire: string | null;
}

export function ReferenceTableManager() {
  const { toast } = useToast();
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Correction | null>(null);
  const [form, setForm] = useState({ matricule_errone: '', cco_errone: '', matricule_correct: '', cco_correct: '', commentaire: '' });

  // Import Excel state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Array<Record<string, string>>>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number } | null>(null);

  const fetchData = async () => {
    const { data } = await supabase.from('reference_corrections').select('*').order('created_at', { ascending: false });
    if (data) setCorrections(data as Correction[]);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    const payload = {
      matricule_errone: form.matricule_errone,
      cco_errone: form.cco_errone || null,
      matricule_correct: form.matricule_correct,
      cco_correct: form.cco_correct || null,
      commentaire: form.commentaire || null,
    };

    if (editing) {
      await supabase.from('reference_corrections').update(payload).eq('id', editing.id);
      toast({ title: 'Correction modifiée' });
    } else {
      await supabase.from('reference_corrections').insert(payload);
      toast({ title: 'Correction ajoutée' });
    }
    setDialogOpen(false);
    setEditing(null);
    setForm({ matricule_errone: '', cco_errone: '', matricule_correct: '', cco_correct: '', commentaire: '' });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('reference_corrections').delete().eq('id', id);
    toast({ title: 'Correction supprimée' });
    fetchData();
  };

  const openEdit = (c: Correction) => {
    setEditing(c);
    setForm({ 
      matricule_errone: c.matricule_errone, 
      cco_errone: c.cco_errone || '', 
      matricule_correct: c.matricule_correct, 
      cco_correct: c.cco_correct || '', 
      commentaire: c.commentaire || '' 
    });
    setDialogOpen(true);
  };

  // Excel import handling
  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImportFile(f);
    setImportResult(null);

    try {
      const buffer = await f.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      const rows = json.map(row => ({
        matricule_errone: String(row['MATRICULE_ERRONE'] || row['matricule_errone'] || row['MATRICULE ERRONE'] || '').trim(),
        cco_errone: String(row['CCO_ERRONE'] || row['cco_errone'] || row['CCO ERRONE'] || '').trim(),
        matricule_correct: String(row['MATRICULE_CORRECT'] || row['matricule_correct'] || row['MATRICULE CORRECT'] || '').trim(),
        cco_correct: String(row['CCO_CORRECT'] || row['cco_correct'] || row['CCO CORRECT'] || '').trim(),
        commentaire: String(row['COMMENTAIRE'] || row['commentaire'] || '').trim(),
      }));

      setImportPreview(rows.filter(r => r.matricule_errone && r.matricule_correct));
      toast({ title: `${rows.length} lignes lues`, description: f.name });
    } catch {
      toast({ title: 'Erreur de lecture', description: 'Format de fichier invalide', variant: 'destructive' });
    }
  }, [toast]);

  const doImportReference = useCallback(async () => {
    if (importPreview.length === 0) return;
    setImporting(true);

    try {
      // Build set of existing corrections for dedup
      const existing = new Set(corrections.map(c => `${c.matricule_errone}|${c.cco_errone || ''}`));
      
      const toInsert = importPreview.filter(r => !existing.has(`${r.matricule_errone}|${r.cco_errone}`));
      const skipped = importPreview.length - toInsert.length;

      if (toInsert.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < toInsert.length; i += batchSize) {
          const batch = toInsert.slice(i, i + batchSize).map(r => ({
            matricule_errone: r.matricule_errone,
            cco_errone: r.cco_errone || null,
            matricule_correct: r.matricule_correct,
            cco_correct: r.cco_correct || null,
            commentaire: r.commentaire || null,
          }));
          await supabase.from('reference_corrections').insert(batch);
        }
      }

      setImportResult({ inserted: toInsert.length, skipped });
      toast({ title: 'Import terminé', description: `${toInsert.length} corrections ajoutées, ${skipped} ignorées (doublons)` });
      fetchData();
    } catch {
      toast({ title: 'Erreur d\'import', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  }, [importPreview, corrections, toast]);

  const filtered = corrections.filter(c =>
    [c.matricule_errone, c.matricule_correct, c.cco_errone, c.cco_correct, c.commentaire]
      .filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Table de Référence</h1>
        <p className="text-muted-foreground mt-1">Corrections automatiques des CCO et matricules erronés</p>
      </div>

      {/* Info card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-mono text-destructive">Donnée erronée</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span>Cherche dans table ref</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-success">Valeur corrigée</span>
          </div>
        </CardContent>
      </Card>

      {/* Toolbar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Rechercher..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Import Excel button */}
        <Dialog open={importDialogOpen} onOpenChange={(o) => { setImportDialogOpen(o); if (!o) { setImportFile(null); setImportPreview([]); setImportResult(null); } }}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" /> Importer Excel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Importer un fichier de référence</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Colonnes attendues : <span className="font-mono text-xs">MATRICULE_ERRONE, CCO_ERRONE, MATRICULE_CORRECT, CCO_CORRECT, COMMENTAIRE</span>
              </p>
              <div className="dropzone cursor-pointer relative">
                <input 
                  type="file" 
                  accept=".xlsx,.xls,.csv" 
                  onChange={handleImportFile}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {importFile ? importFile.name : 'Cliquez ou glissez un fichier Excel'}
                </p>
              </div>

              {importPreview.length > 0 && !importResult && (
                <>
                  <Badge variant="secondary">{importPreview.length} corrections à importer</Badge>
                  <div className="rounded-lg border overflow-auto max-h-48">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matricule erroné</TableHead>
                          <TableHead>CCO erroné</TableHead>
                          <TableHead>→</TableHead>
                          <TableHead>Matricule correct</TableHead>
                          <TableHead>CCO correct</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreview.slice(0, 10).map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-destructive">{r.matricule_errone}</TableCell>
                            <TableCell className="font-mono text-destructive">{r.cco_errone || '—'}</TableCell>
                            <TableCell><ArrowRight className="h-3 w-3 text-muted-foreground" /></TableCell>
                            <TableCell className="font-mono text-success">{r.matricule_correct}</TableCell>
                            <TableCell className="font-mono text-success">{r.cco_correct || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {importPreview.length > 10 && (
                      <p className="text-xs text-muted-foreground p-2 text-center">...et {importPreview.length - 10} autres</p>
                    )}
                  </div>
                  <Button onClick={doImportReference} disabled={importing} className="w-full">
                    {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Importer {importPreview.length} corrections
                  </Button>
                </>
              )}

              {importResult && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertTitle>Import terminé</AlertTitle>
                  <AlertDescription>
                    {importResult.inserted} corrections ajoutées, {importResult.skipped} ignorées (déjà existantes)
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setForm({ matricule_errone: '', cco_errone: '', matricule_correct: '', cco_correct: '', commentaire: '' }); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Ajouter</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Modifier' : 'Ajouter'} une correction</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Matricule erroné</Label>
                  <Input value={form.matricule_errone} onChange={e => setForm(f => ({ ...f, matricule_errone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>CCO erroné</Label>
                  <Input value={form.cco_errone} onChange={e => setForm(f => ({ ...f, cco_errone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Matricule correct</Label>
                  <Input value={form.matricule_correct} onChange={e => setForm(f => ({ ...f, matricule_correct: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>CCO correct</Label>
                  <Input value={form.cco_correct} onChange={e => setForm(f => ({ ...f, cco_correct: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Commentaire</Label>
                <Input value={form.commentaire} onChange={e => setForm(f => ({ ...f, commentaire: e.target.value }))} />
              </div>
              <Button onClick={handleSave} className="w-full">Enregistrer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matricule erroné</TableHead>
                <TableHead>CCO erroné</TableHead>
                <TableHead>→</TableHead>
                <TableHead>Matricule correct</TableHead>
                <TableHead>CCO correct</TableHead>
                <TableHead>Commentaire</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucune correction enregistrée</TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-destructive">{c.matricule_errone}</TableCell>
                  <TableCell className="font-mono text-destructive">{c.cco_errone || '—'}</TableCell>
                  <TableCell><ArrowRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  <TableCell className="font-mono text-success">{c.matricule_correct}</TableCell>
                  <TableCell className="font-mono text-success">{c.cco_correct || '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.commentaire || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
