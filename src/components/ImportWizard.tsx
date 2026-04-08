import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar, Upload, CheckCircle2, AlertTriangle, XCircle,
  ChevronRight, ChevronLeft, FileSpreadsheet, Loader2, Shield, Building2, Search,
  GitCompare, ArrowRight, Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

interface ParsedRow {
  periode: string;
  nom_complet: string;
  rib: string;
  montant: number;
}

interface ReferentielEntry {
  rib: string;
  nom_titulaire: string;
  prenom_titulaire: string | null;
  id_societaire: string;
  account_status: string;
}

interface ValidationResult {
  row: ParsedRow;
  index: number;
  errors: string[];
  warnings: string[];
  ribStatus: 'valid' | 'unknown' | 'mismatch' | 'inactive';
  referentielMatch?: ReferentielEntry;
  reconciled: boolean;
  reconciledRib?: string;
}

interface CompanyProfile {
  id: string;
  nom_entreprise: string;
  code_client: string;
}

const MONTHS = [
  { value: '1', label: 'Janvier' }, { value: '2', label: 'Février' },
  { value: '3', label: 'Mars' }, { value: '4', label: 'Avril' },
  { value: '5', label: 'Mai' }, { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' }, { value: '8', label: 'Août' },
  { value: '9', label: 'Septembre' }, { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' },
];

const STEPS = [
  { id: 1, label: 'Entreprise', icon: Building2 },
  { id: 2, label: 'Période', icon: Calendar },
  { id: 3, label: 'Fichier', icon: Upload },
  { id: 4, label: 'Audit RIB', icon: Shield },
  { id: 5, label: 'Réconciliation', icon: GitCompare },
  { id: 6, label: 'Import', icon: FileSpreadsheet },
];

export function ImportWizard() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [mois, setMois] = useState('');
  const [annee, setAnnee] = useState(new Date().getFullYear().toString());
  const [isQuinzaine, setIsQuinzaine] = useState(false);
  const [duplicateCheckDone, setDuplicateCheckDone] = useState(false);
  const [duplicateExists, setDuplicateExists] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importComplete, setImportComplete] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [reconciliationDialogOpen, setReconciliationDialogOpen] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] = useState<number | null>(null);

  useEffect(() => {
    const fetchCompanies = async () => {
      const { data } = await supabase
        .from('company_profiles')
        .select('id, nom_entreprise, code_client')
        .eq('is_active', true)
        .order('nom_entreprise');
      if (data) setCompanies(data);
    };
    fetchCompanies();
  }, []);

  const [companySearch, setCompanySearch] = useState('');
  const selectedCompanyName = companies.find(c => c.id === selectedCompany)?.nom_entreprise || '';
  const filteredCompanies = companies.filter(c =>
    c.nom_entreprise.toLowerCase().includes(companySearch.toLowerCase()) ||
    c.code_client.toLowerCase().includes(companySearch.toLowerCase())
  );

  const checkDuplicateMonth = useCallback(async () => {
    if (!mois || !annee || !selectedCompany) return;
    const { data } = await supabase
      .from('import_sessions')
      .select('id')
      .eq('mois', parseInt(mois))
      .eq('annee', parseInt(annee))
      .eq('entreprise', selectedCompanyName)
      .eq('status', 'completed');

    setDuplicateExists(!!(data && data.length > 0));
    setDuplicateCheckDone(true);
  }, [mois, annee, selectedCompany, selectedCompanyName]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    try {
      const buffer = await f.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      const findCol = (row: Record<string, unknown>, candidates: string[]): unknown => {
        for (const c of candidates) {
          for (const key of Object.keys(row)) {
            if (key.toLowerCase().replace(/[^a-z0-9]/g, '').includes(c.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
              return row[key];
            }
          }
        }
        return undefined;
      };

      const rows: ParsedRow[] = json.map((row) => {
        const periode = String(findCol(row, ['periode', 'period', 'mois']) || '').trim();
        const nom = String(findCol(row, ['nom', 'name', 'nomprenom', 'nometprenom', 'employe', 'salarie']) || '').trim().toUpperCase();
        const ribRaw = String(findCol(row, ['rib', 'ribcomplet', 'compte', 'numerodecompte', 'account']) || '').replace(/[\s.\-]/g, '');
        const montantRaw = findCol(row, ['montant', 'amount', 'salaire', 'salary', 'somme']);

        let montant = 0;
        if (typeof montantRaw === 'number') montant = montantRaw;
        else if (typeof montantRaw === 'string') montant = parseFloat(montantRaw.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;

        return { periode, nom_complet: nom, rib: ribRaw, montant };
      });

      setParsedData(rows);
      setValidationResults([]);
      toast({ title: `${rows.length} lignes lues`, description: f.name });
    } catch {
      toast({ title: 'Erreur de lecture', description: 'Format de fichier invalide', variant: 'destructive' });
    }
  }, [toast]);

  // Step 4: Audit RIB against referentiel
  const validateRIBs = useCallback(async () => {
    setIsValidating(true);

    // Fetch all referentiel entries
    const { data: refData } = await supabase
      .from('account_status_cache')
      .select('rib, nom_titulaire, prenom_titulaire, id_societaire, account_status');

    const refMap = new Map<string, ReferentielEntry>();
    refData?.forEach(r => refMap.set(r.rib, r as ReferentielEntry));

    // Also build a name-based lookup for reconciliation
    const nameMap = new Map<string, ReferentielEntry[]>();
    refData?.forEach(r => {
      const fullName = `${r.nom_titulaire} ${r.prenom_titulaire || ''}`.trim().toUpperCase();
      const existing = nameMap.get(fullName) || [];
      existing.push(r as ReferentielEntry);
      nameMap.set(fullName, existing);
    });

    const results: ValidationResult[] = parsedData.map((row, index) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      let ribStatus: ValidationResult['ribStatus'] = 'valid';
      let referentielMatch: ReferentielEntry | undefined;

      if (!row.nom_complet) errors.push('Nom manquant');
      if (!row.rib) errors.push('RIB manquant');
      if (row.montant <= 0) errors.push('Montant invalide');

      if (row.rib) {
        if (row.rib.length < 21 || row.rib.length > 23) {
          errors.push(`RIB longueur invalide (${row.rib.length})`);
          ribStatus = 'unknown';
        } else {
          const refEntry = refMap.get(row.rib);
          if (!refEntry) {
            // RIB not in referentiel - try to find by name
            const byName = nameMap.get(row.nom_complet);
            if (byName && byName.length > 0) {
              referentielMatch = byName.find(b => b.account_status === 'ACTIF') || byName[0];
              ribStatus = 'mismatch';
              warnings.push(`RIB inconnu — RIB certifié trouvé pour "${row.nom_complet}": ${referentielMatch.rib}`);
            } else {
              ribStatus = 'unknown';
              errors.push('RIB absent du référentiel sociétaire');
            }
          } else if (refEntry.account_status !== 'ACTIF') {
            ribStatus = 'inactive';
            referentielMatch = refEntry;
            errors.push(`Compte ${refEntry.account_status} — Impossible de traiter`);
          } else {
            ribStatus = 'valid';
            referentielMatch = refEntry;
          }
        }
      }

      return { row, index, errors, warnings, ribStatus, referentielMatch, reconciled: false };
    });

    setValidationResults(results);
    setIsValidating(false);
  }, [parsedData]);

  // Reconcile a single row
  const reconcileRow = useCallback((index: number) => {
    setValidationResults(prev => prev.map(r => {
      if (r.index !== index || !r.referentielMatch) return r;
      return {
        ...r,
        reconciled: true,
        reconciledRib: r.referentielMatch.rib,
        ribStatus: 'valid' as const,
        errors: r.errors.filter(e => !e.includes('RIB inconnu') && !e.includes('RIB absent')),
        warnings: [...r.warnings, `RIB réconcilié: ${r.row.rib} → ${r.referentielMatch.rib}`],
        row: { ...r.row, rib: r.referentielMatch!.rib },
      };
    }));
    setReconciliationDialogOpen(false);
    toast({ title: 'RIB réconcilié', description: 'Les données certifiées du référentiel ont été injectées.' });
  }, [toast]);

  // Reconcile ALL mismatches at once
  const reconcileAll = useCallback(() => {
    setValidationResults(prev => prev.map(r => {
      if (r.ribStatus !== 'mismatch' || !r.referentielMatch || r.reconciled) return r;
      return {
        ...r,
        reconciled: true,
        reconciledRib: r.referentielMatch.rib,
        ribStatus: 'valid' as const,
        errors: r.errors.filter(e => !e.includes('RIB inconnu') && !e.includes('RIB absent')),
        warnings: [...r.warnings, `RIB réconcilié: ${r.row.rib} → ${r.referentielMatch.rib}`],
        row: { ...r.row, rib: r.referentielMatch!.rib },
      };
    }));
    toast({ title: 'Réconciliation globale', description: 'Tous les RIB ont été corrigés avec les données certifiées.' });
  }, [toast]);

  const doImport = useCallback(async () => {
    setIsImporting(true);
    setImportProgress(0);

    try {
      const validEntries = validationResults.filter(r => r.errors.length === 0);

      const { data: session, error: sessionErr } = await supabase
        .from('import_sessions')
        .insert({
          mois: parseInt(mois),
          annee: parseInt(annee),
          file_name: file?.name || 'unknown',
          entreprise: isQuinzaine ? `${selectedCompanyName}_QUINZAINE` : selectedCompanyName,
          total_lignes: validationResults.length,
          lignes_valides: validEntries.length,
          lignes_rejetees: validationResults.length - validEntries.length,
          lignes_doublons: 0,
          montant_total: validEntries.reduce((s, r) => s + r.row.montant, 0),
          corrections_applied: validationResults.filter(r => r.reconciled).length,
          status: 'completed',
        })
        .select()
        .single();

      if (sessionErr || !session) throw sessionErr;
      setImportProgress(30);

      const batchSize = 500;
      for (let i = 0; i < validEntries.length; i += batchSize) {
        const batch = validEntries.slice(i, i + batchSize).map(r => ({
          session_id: session.id,
          periode: r.row.periode || `${mois.padStart(2, '0')}/${annee}`,
          matricule: r.referentielMatch?.id_societaire || r.row.rib.substring(0, 10),
          nom: r.row.nom_complet,
          prenom: '',
          code_caisse: r.row.rib.substring(5, 10),
          cco: r.row.rib.substring(10, r.row.rib.length - 2),
          montant: r.row.montant,
          was_corrected: r.reconciled,
          correction_details: r.reconciled ? JSON.stringify({ rib_original: r.reconciledRib, rib_corrige: r.row.rib }) : null,
          is_doublon: false,
          status: 'valid',
        }));

        await supabase.from('import_entries').insert(batch);
        setImportProgress(30 + Math.round((i / validEntries.length) * 70));
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        action: 'import',
        description: `Import paie: ${validEntries.length} lignes pour ${selectedCompanyName} (${mois.padStart(2, '0')}/${annee})`,
        details: {
          entreprise: selectedCompanyName,
          periode: `${mois.padStart(2, '0')}/${annee}`,
          total: validationResults.length,
          valides: validEntries.length,
          reconcilies: validationResults.filter(r => r.reconciled).length,
        },
      });

      setImportProgress(100);
      setImportComplete(true);
      toast({ title: 'Import terminé', description: `${validEntries.length} lignes importées pour ${selectedCompanyName}` });
    } catch (err: unknown) {
      toast({
        title: "Erreur d'import",
        description: err instanceof Error ? err.message : 'Erreur inconnue',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  }, [mois, annee, file, isQuinzaine, selectedCompanyName, validationResults, toast]);

  const validCount = validationResults.filter(r => r.errors.length === 0).length;
  const errorCount = validationResults.filter(r => r.errors.length > 0).length;
  const mismatchCount = validationResults.filter(r => r.ribStatus === 'mismatch' && !r.reconciled).length;
  const reconciledCount = validationResults.filter(r => r.reconciled).length;

  const canAdvance = () => {
    switch (step) {
      case 1: return !!selectedCompany;
      case 2: return !!(mois && annee && duplicateCheckDone && (!duplicateExists || isQuinzaine));
      case 3: return parsedData.length > 0;
      case 4: return validationResults.length > 0;
      case 5: return mismatchCount === 0 && errorCount === 0;
      case 6: return true;
      default: return false;
    }
  };

  const selectedReconItem = selectedReconciliation !== null
    ? validationResults.find(r => r.index === selectedReconciliation)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Import de Fichier de Paie</h1>
        <p className="text-muted-foreground mt-1">Format : Période, Nom et Prénom, RIB Complet, Montant</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 flex-wrap">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isDone = step > s.id;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                isActive && "bg-primary text-primary-foreground",
                isDone && "bg-primary/10 text-primary",
                !isActive && !isDone && "text-muted-foreground"
              )}>
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          );
        })}
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* STEP 1: Company */}
          {step === 1 && (
            <div className="space-y-4 max-w-md">
              <CardHeader className="p-0">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Sélection de l'entreprise
                </CardTitle>
                <CardDescription>Choisissez l'entreprise pour laquelle vous importez les données de paie</CardDescription>
              </CardHeader>
              <div className="space-y-2">
                <Label>Entreprise</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher une entreprise..." value={companySearch} onChange={e => setCompanySearch(e.target.value)} className="pl-9" />
                </div>
                <div className="border rounded-md max-h-60 overflow-y-auto">
                  {filteredCompanies.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground text-center">Aucun résultat</p>
                  ) : (
                    filteredCompanies.map(c => (
                      <button key={c.id} type="button" onClick={() => setSelectedCompany(c.id)}
                        className={cn("w-full text-left px-3 py-2.5 text-sm flex items-center justify-between hover:bg-muted/50 transition-colors border-b last:border-b-0",
                          selectedCompany === c.id && "bg-primary/10 text-primary font-medium"
                        )}>
                        <span>{c.nom_entreprise}</span>
                        <Badge variant="outline" className="text-xs font-mono">{c.code_client}</Badge>
                      </button>
                    ))
                  )}
                </div>
              </div>
              {selectedCompany && (
                <Alert><CheckCircle2 className="h-4 w-4 text-success" /><AlertTitle>{selectedCompanyName}</AlertTitle><AlertDescription>Entreprise sélectionnée.</AlertDescription></Alert>
              )}
            </div>
          )}

          {/* STEP 2: Period */}
          {step === 2 && (
            <div className="space-y-4 max-w-md">
              <CardHeader className="p-0">
                <CardTitle>Sélection de la période</CardTitle>
                <CardDescription>Entreprise : <strong>{selectedCompanyName}</strong></CardDescription>
              </CardHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mois</Label>
                  <Select value={mois} onValueChange={(v) => { setMois(v); setDuplicateCheckDone(false); setDuplicateExists(false); setIsQuinzaine(false); }}>
                    <SelectTrigger><SelectValue placeholder="Mois" /></SelectTrigger>
                    <SelectContent>{MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Année</Label>
                  <Input type="number" value={annee} onChange={e => { setAnnee(e.target.value); setDuplicateCheckDone(false); }} min={2000} max={2100} />
                </div>
              </div>
              {mois && annee && !duplicateCheckDone && (
                <Button variant="outline" onClick={checkDuplicateMonth}><Shield className="h-4 w-4 mr-2" />Vérifier la disponibilité</Button>
              )}
              {duplicateCheckDone && !duplicateExists && (
                <Alert><CheckCircle2 className="h-4 w-4 text-success" /><AlertTitle>Période disponible</AlertTitle></Alert>
              )}
              {duplicateCheckDone && duplicateExists && (
                <div className="space-y-3">
                  <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Import déjà effectué</AlertTitle>
                    <AlertDescription>Un fichier existe déjà pour cette période.</AlertDescription></Alert>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="quinzaine" checked={isQuinzaine} onCheckedChange={(checked) => setIsQuinzaine(checked === true)} />
                    <Label htmlFor="quinzaine" className="text-sm cursor-pointer">Il s'agit d'une quinzaine (2ᵉ import)</Label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: File */}
          {step === 3 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle>Choisir le fichier</CardTitle>
                <CardDescription>
                  {selectedCompanyName} — {mois.padStart(2, '0')}/{annee}
                  <br />Format : PÉRIODE, NOM ET PRÉNOM, RIB COMPLET, MONTANT
                </CardDescription>
              </CardHeader>
              <div className="dropzone cursor-pointer relative">
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">{file ? file.name : 'Cliquez ou glissez un fichier Excel/CSV'}</p>
                {parsedData.length > 0 && <Badge variant="secondary" className="mt-2">{parsedData.length} lignes détectées</Badge>}
              </div>
              {parsedData.length > 0 && (
                <div className="rounded-lg border overflow-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Période</TableHead>
                        <TableHead>Nom et Prénom</TableHead>
                        <TableHead>RIB Complet</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.slice(0, 5).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.periode}</TableCell>
                          <TableCell>{r.nom_complet}</TableCell>
                          <TableCell className="font-mono text-xs">{r.rib}</TableCell>
                          <TableCell className="text-right font-mono">{r.montant.toLocaleString('fr-FR')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {parsedData.length > 5 && <p className="text-xs text-muted-foreground p-2 text-center">...et {parsedData.length - 5} autres lignes</p>}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Audit RIB */}
          {step === 4 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Audit RIB — Comparaison avec le Référentiel
                </CardTitle>
                <CardDescription>Chaque RIB du fichier est comparé à la base de données certifiée des sociétaires</CardDescription>
              </CardHeader>

              {validationResults.length === 0 ? (
                <Button onClick={validateRIBs} disabled={isValidating}>
                  {isValidating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                  Lancer l'audit RIB
                </Button>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-4">
                    <Card><CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-success">{validCount}</p>
                      <p className="text-xs text-muted-foreground">RIB valides</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-warning">{mismatchCount}</p>
                      <p className="text-xs text-muted-foreground">Non concordants</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-destructive">{validationResults.filter(r => r.ribStatus === 'unknown').length}</p>
                      <p className="text-xs text-muted-foreground">Inconnus</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-primary">{reconciledCount}</p>
                      <p className="text-xs text-muted-foreground">Réconciliés</p>
                    </CardContent></Card>
                  </div>

                  <div className="rounded-lg border overflow-auto max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Nom</TableHead>
                          <TableHead>RIB Fichier</TableHead>
                          <TableHead>RIB Référentiel</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validationResults.map(r => (
                          <TableRow key={r.index} className={cn(
                            r.ribStatus === 'valid' && 'bg-success/5',
                            r.ribStatus === 'mismatch' && !r.reconciled && 'bg-warning/10',
                            (r.ribStatus === 'unknown' || r.ribStatus === 'inactive') && 'bg-destructive/5',
                            r.reconciled && 'bg-primary/5'
                          )}>
                            <TableCell className="text-muted-foreground">{r.index + 1}</TableCell>
                            <TableCell>{r.row.nom_complet}</TableCell>
                            <TableCell className="font-mono text-xs">{r.reconciled ? <s className="text-muted-foreground">{r.reconciledRib !== r.row.rib ? r.reconciledRib : ''}</s> : r.row.rib}</TableCell>
                            <TableCell className="font-mono text-xs">{r.referentielMatch?.rib || '—'}</TableCell>
                            <TableCell className="text-right font-mono">{r.row.montant.toLocaleString('fr-FR')}</TableCell>
                            <TableCell>
                              {r.reconciled ? (
                                <Badge className="bg-primary text-primary-foreground text-xs"><Check className="h-3 w-3 mr-1" />Réconcilié</Badge>
                              ) : r.ribStatus === 'valid' ? (
                                <Badge className="bg-success text-success-foreground text-xs">✓ Certifié</Badge>
                              ) : r.ribStatus === 'mismatch' ? (
                                <Button size="sm" variant="outline" className="h-7 text-xs border-warning text-warning" onClick={() => { setSelectedReconciliation(r.index); setReconciliationDialogOpen(true); }}>
                                  <GitCompare className="h-3 w-3 mr-1" />Réconcilier
                                </Button>
                              ) : r.ribStatus === 'inactive' ? (
                                <Badge variant="destructive" className="text-xs">{r.referentielMatch?.account_status}</Badge>
                              ) : (
                                <Badge variant="destructive" className="text-xs">Inconnu</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {mismatchCount > 0 && (
                    <Alert className="border-warning">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <AlertTitle>{mismatchCount} RIB non concordants</AlertTitle>
                      <AlertDescription>
                        Ces RIB ne correspondent pas au référentiel. Passez à l'étape suivante pour réconcilier en masse ou cliquez sur chaque ligne.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </div>
          )}

          {/* STEP 5: Reconciliation */}
          {step === 5 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle className="flex items-center gap-2">
                  <GitCompare className="h-5 w-5 text-primary" />
                  Réconciliation
                </CardTitle>
                <CardDescription>Corrigez les RIB non concordants avec les données certifiées du référentiel</CardDescription>
              </CardHeader>

              {mismatchCount > 0 ? (
                <>
                  <Alert className="border-warning">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <AlertTitle>{mismatchCount} ligne(s) à réconcilier</AlertTitle>
                    <AlertDescription>
                      Le système propose de remplacer les RIB du fichier Excel par les RIB certifiés du référentiel.
                    </AlertDescription>
                  </Alert>

                  <div className="rounded-lg border overflow-auto max-h-80">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom</TableHead>
                          <TableHead>RIB Excel (erroné)</TableHead>
                          <TableHead className="text-center">→</TableHead>
                          <TableHead>RIB Référentiel (certifié)</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validationResults.filter(r => r.ribStatus === 'mismatch' && !r.reconciled).map(r => (
                          <TableRow key={r.index}>
                            <TableCell>{r.row.nom_complet}</TableCell>
                            <TableCell className="font-mono text-xs text-destructive">{r.row.rib}</TableCell>
                            <TableCell className="text-center"><ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" /></TableCell>
                            <TableCell className="font-mono text-xs text-success">{r.referentielMatch?.rib}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={() => reconcileRow(r.index)} className="h-7 text-xs">
                                <Check className="h-3 w-3 mr-1" />Corriger
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <Button onClick={reconcileAll} size="lg" className="w-full">
                    <GitCompare className="h-4 w-4 mr-2" />
                    Réconcilier tout ({mismatchCount} lignes)
                  </Button>
                </>
              ) : errorCount > 0 ? (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>{errorCount} erreur(s) bloquante(s)</AlertTitle>
                  <AlertDescription>Certaines lignes ont des erreurs qui ne peuvent pas être réconciliées (RIB inconnu, compte inactif). Corrigez le fichier source.</AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertTitle>Toutes les lignes sont validées</AlertTitle>
                  <AlertDescription>
                    {validCount} RIB certifiés{reconciledCount > 0 && `, dont ${reconciledCount} réconciliés`}. Prêt pour l'import.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* STEP 6: Import */}
          {step === 6 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle>Confirmation d'import</CardTitle>
                <CardDescription>{validCount} lignes prêtes pour <strong>{selectedCompanyName}</strong> — {mois.padStart(2, '0')}/{annee}</CardDescription>
              </CardHeader>

              <div className="grid grid-cols-2 gap-4 max-w-md">
                <div className="text-sm"><span className="text-muted-foreground">Entreprise:</span> {selectedCompanyName}</div>
                <div className="text-sm"><span className="text-muted-foreground">Fichier:</span> {file?.name}</div>
                <div className="text-sm"><span className="text-muted-foreground">Période:</span> {mois.padStart(2, '0')}/{annee}</div>
                <div className="text-sm"><span className="text-muted-foreground">Lignes valides:</span> {validCount}</div>
                <div className="text-sm"><span className="text-muted-foreground">Réconciliés:</span> {reconciledCount}</div>
                <div className="text-sm col-span-2">
                  <span className="text-muted-foreground">Montant total:</span>{' '}
                  {validationResults.filter(r => r.errors.length === 0).reduce((s, r) => s + r.row.montant, 0).toLocaleString('fr-FR')} FCFA
                </div>
              </div>

              {isImporting && (
                <div className="space-y-2">
                  <Progress value={importProgress} />
                  <p className="text-sm text-muted-foreground text-center">{importProgress}%</p>
                </div>
              )}

              {importComplete ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertTitle>Import réussi</AlertTitle>
                  <AlertDescription>
                    {validCount} lignes importées pour <strong>{selectedCompanyName}</strong>.
                    Rendez-vous dans le module <strong>Génération</strong> pour lancer le Triple Check et générer le fichier XML ISO 20022.
                  </AlertDescription>
                </Alert>
              ) : (
                <Button onClick={doImport} disabled={isImporting} size="lg">
                  {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                  Lancer l'import
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 1}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
        </Button>
        <Button
          onClick={() => {
            if (step === 2 && !duplicateCheckDone) { checkDuplicateMonth(); return; }
            if (step === 4 && validationResults.length === 0) { validateRIBs(); return; }
            setStep(s => s + 1);
          }}
          disabled={step === 6 || !canAdvance()}
        >
          Suivant <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Reconciliation Dialog */}
      <Dialog open={reconciliationDialogOpen} onOpenChange={setReconciliationDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-primary" />
              Réconciliation RIB
            </DialogTitle>
          </DialogHeader>
          {selectedReconItem && (
            <div className="space-y-4">
              <div className="text-sm"><strong>Salarié :</strong> {selectedReconItem.row.nom_complet}</div>
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-destructive/30">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-destructive">Fichier Excel</CardTitle></CardHeader>
                  <CardContent><p className="font-mono text-sm">{selectedReconItem.row.rib}</p></CardContent>
                </Card>
                <Card className="border-success/30">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-success">Référentiel Certifié</CardTitle></CardHeader>
                  <CardContent>
                    <p className="font-mono text-sm">{selectedReconItem.referentielMatch?.rib}</p>
                    <p className="text-xs text-muted-foreground mt-1">{selectedReconItem.referentielMatch?.nom_titulaire}</p>
                  </CardContent>
                </Card>
              </div>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>En cliquant "Réconcilier", le RIB du fichier Excel sera remplacé par celui du référentiel certifié.</AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReconciliationDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => selectedReconciliation !== null && reconcileRow(selectedReconciliation)}>
              <Check className="h-4 w-4 mr-2" />Réconcilier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
