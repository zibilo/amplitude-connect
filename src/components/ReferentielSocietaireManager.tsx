import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validateRIB } from '@/utils/ribValidation';
import {
  Upload, CheckCircle2, AlertTriangle, XCircle, Loader2,
  Database, Search, Trash2, Download, RefreshCw, Users
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

interface SocietaireRow {
  id_societaire: string;
  nom_titulaire: string;
  prenom_titulaire?: string;
  rib: string;
  code_banque: string;
  code_guichet: string;
  numero_compte: string;
  cle_rib: string;
  account_status: string;
}

interface ParsedSocietaire {
  raw: Record<string, unknown>;
  mapped: SocietaireRow;
  errors: string[];
  warnings: string[];
}

interface ImportReport {
  total: number;
  added: number;
  updated: number;
  rejected: number;
  errors: string[];
}

// Auto-detect column mapping
function detectColumn(keys: string[], candidates: string[]): string | null {
  for (const c of candidates) {
    const found = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(c.toLowerCase().replace(/[^a-z0-9]/g, '')));
    if (found) return found;
  }
  return null;
}

export function ReferentielSocietaireManager() {
  const { toast } = useToast();
  const [referentiel, setReferentiel] = useState<SocietaireRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [importMode, setImportMode] = useState<'update' | 'replace'>('update');
  const [parsedRows, setParsedRows] = useState<ParsedSocietaire[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const fetchReferentiel = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('account_status_cache')
      .select('id_societaire, nom_titulaire, prenom_titulaire, rib, code_banque, code_guichet, numero_compte, cle_rib, account_status')
      .order('nom_titulaire');
    if (!error && data) setReferentiel(data as SocietaireRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchReferentiel(); }, [fetchReferentiel]);

  const filtered = referentiel.filter(r =>
    r.nom_titulaire.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.id_societaire.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.rib.includes(searchTerm)
  );

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setImportReport(null);

    try {
      const buffer = await f.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      if (json.length === 0) {
        toast({ title: 'Fichier vide', variant: 'destructive' });
        return;
      }

      const keys = Object.keys(json[0]);
      const colIdSoc = detectColumn(keys, ['id_societaire', 'idsocietaire', 'id societaire', 'societaire', 'id']);
      const colNom = detectColumn(keys, ['nom_titulaire', 'nom', 'name', 'titulaire']);
      const colPrenom = detectColumn(keys, ['prenom_titulaire', 'prenom', 'prénom', 'firstname']);
      const colRib = detectColumn(keys, ['rib', 'rib_complet', 'compte', 'n° de compte', 'numero_compte', 'account']);
      const colStatus = detectColumn(keys, ['statut', 'status', 'account_status', 'etat']);

      if (!colNom || !colRib) {
        toast({ title: 'Colonnes manquantes', description: 'Impossible de détecter les colonnes Nom et RIB', variant: 'destructive' });
        return;
      }

      const parsed: ParsedSocietaire[] = json.map((row) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        const rawRib = String(row[colRib!] || '').replace(/[\s.\-]/g, '').toUpperCase();
        const nom = String(row[colNom!] || '').trim().toUpperCase();
        const prenom = colPrenom ? String(row[colPrenom] || '').trim() : '';
        const idSoc = colIdSoc ? String(row[colIdSoc] || '').trim() : '';
        const status = colStatus ? String(row[colStatus] || 'ACTIF').toUpperCase() : 'ACTIF';

        if (!nom) errors.push('Nom manquant');
        if (!rawRib) errors.push('RIB manquant');
        else if (rawRib.length < 21 || rawRib.length > 23) errors.push(`RIB longueur invalide (${rawRib.length})`);

        // Validate RIB key
        if (rawRib.length >= 21) {
          const ribCheck = validateRIB(rawRib.padEnd(23, '0').substring(0, 23));
          if (!ribCheck.valid && rawRib.length === 23) {
            warnings.push(`Clé RIB suspecte: ${ribCheck.error}`);
          }
        }

        if (!idSoc) warnings.push('ID sociétaire manquant — sera généré');

        const codeBanque = rawRib.substring(0, 5);
        const codeGuichet = rawRib.substring(5, 10);
        const numeroCompte = rawRib.substring(10, rawRib.length - 2);
        const cleRib = rawRib.substring(rawRib.length - 2);

        return {
          raw: row,
          mapped: {
            id_societaire: idSoc || `SOC-${codeBanque}-${codeGuichet}-${Date.now()}`,
            nom_titulaire: nom,
            prenom_titulaire: prenom || undefined,
            rib: rawRib,
            code_banque: codeBanque,
            code_guichet: codeGuichet,
            numero_compte: numeroCompte,
            cle_rib: cleRib,
            account_status: ['ACTIF', 'GELE', 'CLOS', 'BLOQUE'].includes(status) ? status : 'ACTIF',
          },
          errors,
          warnings,
        };
      });

      setParsedRows(parsed);
      toast({ title: `${parsed.length} sociétaires détectés`, description: `Colonnes: Nom=${colNom}, RIB=${colRib}` });
    } catch {
      toast({ title: 'Erreur de lecture', variant: 'destructive' });
    }
  }, [toast]);

  const executeImport = useCallback(async () => {
    setIsImporting(true);
    setImportProgress(0);

    const valid = parsedRows.filter(r => r.errors.length === 0);
    const rejected = parsedRows.filter(r => r.errors.length > 0);
    let added = 0, updated = 0;
    const errors: string[] = rejected.map((r, i) => `Ligne ${i + 1}: ${r.errors.join(', ')}`);

    try {
      // If replace mode, delete all existing
      if (importMode === 'replace') {
        const { error } = await supabase.from('account_status_cache').delete().neq('id_societaire', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
      }

      const batchSize = 200;
      for (let i = 0; i < valid.length; i += batchSize) {
        const batch = valid.slice(i, i + batchSize).map(r => ({
          id_societaire: r.mapped.id_societaire,
          nom_titulaire: r.mapped.nom_titulaire,
          prenom_titulaire: r.mapped.prenom_titulaire || null,
          rib: r.mapped.rib,
          code_banque: r.mapped.code_banque,
          code_guichet: r.mapped.code_guichet,
          numero_compte: r.mapped.numero_compte,
          cle_rib: r.mapped.cle_rib,
          account_status: r.mapped.account_status as 'ACTIF' | 'GELE' | 'CLOS' | 'BLOQUE',
        }));

        const { data: existing } = await supabase
          .from('account_status_cache')
          .select('rib')
          .in('rib', batch.map(b => b.rib));

        const existingRibs = new Set(existing?.map(e => e.rib) || []);
        const toInsert = batch.filter(b => !existingRibs.has(b.rib));
        const toUpdate = batch.filter(b => existingRibs.has(b.rib));

        if (toInsert.length > 0) {
          const { error } = await supabase.from('account_status_cache').insert(toInsert);
          if (!error) added += toInsert.length;
        }

        for (const upd of toUpdate) {
          await supabase.from('account_status_cache')
            .update({
              nom_titulaire: upd.nom_titulaire,
              prenom_titulaire: upd.prenom_titulaire,
              id_societaire: upd.id_societaire,
              account_status: upd.account_status,
            })
            .eq('rib', upd.rib);
          updated++;
        }

        setImportProgress(Math.round(((i + batchSize) / valid.length) * 100));
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Erreur inconnue');
    }

    const report: ImportReport = { total: parsedRows.length, added, updated, rejected: rejected.length, errors };
    setImportReport(report);
    setImportProgress(100);
    setIsImporting(false);
    setParsedRows([]);
    fetchReferentiel();

    // Audit
    await supabase.from('audit_logs').insert([{
      action: 'referentiel_import',
      description: `Import référentiel: ${added} ajoutés, ${updated} mis à jour, ${rejected.length} rejetés`,
      details: JSON.parse(JSON.stringify(report)),
    }]);

    toast({ title: 'Import terminé', description: `${added} ajoutés, ${updated} mis à jour` });
  }, [parsedRows, importMode, fetchReferentiel, toast]);

  const exportReferentiel = useCallback(() => {
    const data = referentiel.map(r => ({
      'ID Sociétaire': r.id_societaire,
      'Nom': r.nom_titulaire,
      'Prénom': r.prenom_titulaire || '',
      'RIB Complet': r.rib,
      'Code Banque': r.code_banque,
      'Code Guichet': r.code_guichet,
      'N° Compte': r.numero_compte,
      'Clé RIB': r.cle_rib,
      'Statut': r.account_status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Référentiel');
    XLSX.writeFile(wb, `referentiel_societaire_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [referentiel]);

  const validParsed = parsedRows.filter(r => r.errors.length === 0).length;
  const errorParsed = parsedRows.filter(r => r.errors.length > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Référentiel Sociétaire</h1>
          <p className="text-muted-foreground mt-1">Base de données certifiée des comptes sociétaires</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportReferentiel} disabled={referentiel.length === 0}>
            <Download className="h-4 w-4 mr-2" />Exporter
          </Button>
          <Button variant="outline" onClick={fetchReferentiel}>
            <RefreshCw className="h-4 w-4 mr-2" />Actualiser
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold">{referentiel.length}</p>
          <p className="text-xs text-muted-foreground">Total sociétaires</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-success">{referentiel.filter(r => r.account_status === 'ACTIF').length}</p>
          <p className="text-xs text-muted-foreground">Actifs</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-warning">{referentiel.filter(r => r.account_status === 'GELE').length}</p>
          <p className="text-xs text-muted-foreground">Gelés</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-destructive">{referentiel.filter(r => ['CLOS', 'BLOQUE'].includes(r.account_status)).length}</p>
          <p className="text-xs text-muted-foreground">Clos/Bloqués</p>
        </CardContent></Card>
      </div>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importation du Référentiel
          </CardTitle>
          <CardDescription>Importez un fichier Excel/CSV contenant les données sociétaires certifiées</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Select value={importMode} onValueChange={(v: 'update' | 'replace') => setImportMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="update">Mettre à jour (ajouter les nouveaux)</SelectItem>
                  <SelectItem value="replace">Écraser tout (remplacement total)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {importMode === 'replace' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Attention</AlertTitle>
              <AlertDescription>Le mode "Écraser tout" supprimera toutes les données existantes avant l'import.</AlertDescription>
            </Alert>
          )}

          <div className="dropzone cursor-pointer relative">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {file ? file.name : 'Cliquez ou glissez un fichier Excel/CSV'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Colonnes attendues : ID Sociétaire, Nom, Prénom, RIB Complet, Statut
            </p>
          </div>

          {/* Preview parsed data */}
          {parsedRows.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-success">{validParsed}</p>
                  <p className="text-xs text-muted-foreground">Valides</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-destructive">{errorParsed}</p>
                  <p className="text-xs text-muted-foreground">Rejetés</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-warning">{parsedRows.filter(r => r.warnings.length > 0).length}</p>
                  <p className="text-xs text-muted-foreground">Avertissements</p>
                </CardContent></Card>
              </div>

              <div className="rounded-lg border overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>ID Sociétaire</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>RIB</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>État</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 20).map((r, i) => (
                      <TableRow key={i} className={cn(r.errors.length > 0 && 'bg-destructive/5')}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{r.mapped.id_societaire.substring(0, 15)}</TableCell>
                        <TableCell>{r.mapped.nom_titulaire} {r.mapped.prenom_titulaire || ''}</TableCell>
                        <TableCell className="font-mono text-xs">{r.mapped.rib}</TableCell>
                        <TableCell>
                          <Badge variant={r.mapped.account_status === 'ACTIF' ? 'default' : 'destructive'} className="text-xs">
                            {r.mapped.account_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {r.errors.length > 0 ? (
                            <Badge variant="destructive" className="text-xs">{r.errors[0]}</Badge>
                          ) : r.warnings.length > 0 ? (
                            <Badge className="bg-warning text-warning-foreground text-xs">{r.warnings[0]}</Badge>
                          ) : (
                            <Badge className="bg-success text-success-foreground text-xs">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedRows.length > 20 && (
                  <p className="text-xs text-muted-foreground p-2 text-center">...et {parsedRows.length - 20} autres</p>
                )}
              </div>

              {isImporting && (
                <div className="space-y-2">
                  <Progress value={importProgress} />
                  <p className="text-sm text-muted-foreground text-center">{importProgress}%</p>
                </div>
              )}

              <Button onClick={executeImport} disabled={isImporting || validParsed === 0} size="lg">
                {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
                Importer {validParsed} sociétaires ({importMode === 'replace' ? 'Remplacement' : 'Mise à jour'})
              </Button>
            </div>
          )}

          {/* Import Report */}
          {importReport && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertTitle>Rapport d'intégration</AlertTitle>
              <AlertDescription>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <div><strong>{importReport.total}</strong> total</div>
                  <div className="text-success"><strong>{importReport.added}</strong> ajoutés</div>
                  <div className="text-primary"><strong>{importReport.updated}</strong> mis à jour</div>
                  <div className="text-destructive"><strong>{importReport.rejected}</strong> rejetés</div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Existing Referentiel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Sociétaires enregistrés ({referentiel.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, ID ou RIB..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-lg border overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Sociétaire</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>RIB Complet</TableHead>
                    <TableHead>Banque</TableHead>
                    <TableHead>Guichet</TableHead>
                    <TableHead>Clé</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 100).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{r.id_societaire}</TableCell>
                      <TableCell>{r.nom_titulaire} {r.prenom_titulaire || ''}</TableCell>
                      <TableCell className="font-mono text-xs">{r.rib}</TableCell>
                      <TableCell>{r.code_banque}</TableCell>
                      <TableCell>{r.code_guichet}</TableCell>
                      <TableCell>{r.cle_rib}</TableCell>
                      <TableCell>
                        <Badge variant={r.account_status === 'ACTIF' ? 'default' : 'destructive'} className="text-xs">
                          {r.account_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length > 100 && (
                <p className="text-xs text-muted-foreground p-2 text-center">{filtered.length - 100} autres non affichés</p>
              )}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground p-4 text-center">Aucun sociétaire trouvé</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
