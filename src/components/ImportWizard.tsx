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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Calendar, Upload, CheckCircle2, AlertTriangle, XCircle, 
  ChevronRight, ChevronLeft, FileSpreadsheet, Loader2, Shield, Building2, Search
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

interface ParsedRow {
  periode: string;
  matricule: string;
  nom: string;
  prenom: string;
  code_caisse: string;
  cco: string;
  montant: number;
}

interface ValidationResult {
  row: ParsedRow;
  index: number;
  errors: string[];
  warnings: string[];
  corrected: boolean;
  correctedFields: Record<string, { from: string; to: string }>;
  isDuplicate: boolean;
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
  { id: 4, label: 'Vérif. Période', icon: Shield },
  { id: 5, label: 'Vérif. Données', icon: CheckCircle2 },
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
  const [periodValid, setPeriodValid] = useState<boolean | null>(null);
  const [periodErrors, setPeriodErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importComplete, setImportComplete] = useState(false);

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

    const exists = (data && data.length > 0);
    setDuplicateExists(!!exists);
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

      const rows: ParsedRow[] = json.map((row) => ({
        periode: String(row['PERIODE'] || row['periode'] || '').trim(),
        matricule: String(row['MATRICULE'] || row['matricule'] || '').trim(),
        nom: String(row['NOM'] || row['nom'] || '').trim(),
        prenom: String(row['PRENOM'] || row['prenom'] || '').trim(),
        code_caisse: String(row['CODE CAISSE'] || row['CODE_CAISSE'] || row['code_caisse'] || '').trim(),
        cco: String(row['CCO'] || row['cco'] || '').trim(),
        montant: Number(row['MONTANT'] || row['montant'] || 0),
      }));

      setParsedData(rows);
      toast({ title: `${rows.length} lignes lues`, description: f.name });
    } catch {
      toast({ title: 'Erreur de lecture', description: 'Format de fichier invalide', variant: 'destructive' });
    }
  }, [toast]);

  const normalizePeriod = useCallback((raw: string): { month: string; year: string } | null => {
    if (!raw) return null;
    const s = raw.trim();

    let m = s.match(/^(\d{1,2})[\/\-.](\d{4})$/);
    if (m) return { month: m[1].padStart(2, '0'), year: m[2] };

    m = s.match(/^(\d{4})[\/\-.](\d{1,2})$/);
    if (m) return { month: m[2].padStart(2, '0'), year: m[1] };

    m = s.match(/^(\d{4})(\d{2})$/);
    if (m) return { month: m[2], year: m[1] };

    m = s.match(/^(\d{4})(\d{1})$/);
    if (m) return { month: m[2].padStart(2, '0'), year: m[1] };

    m = s.match(/^(\d{2})(\d{4})$/);
    if (m && parseInt(m[1]) >= 1 && parseInt(m[1]) <= 12) return { month: m[1], year: m[2] };

    const monthNames: Record<string, string> = {
      'janvier': '01', 'jan': '01', 'fevrier': '02', 'février': '02', 'fev': '02', 'fév': '02',
      'mars': '03', 'mar': '03', 'avril': '04', 'avr': '04', 'mai': '05',
      'juin': '06', 'jun': '06', 'juillet': '07', 'jul': '07', 'juil': '07',
      'aout': '08', 'août': '08', 'aou': '08', 'septembre': '09', 'sep': '09', 'sept': '09',
      'octobre': '10', 'oct': '10', 'novembre': '11', 'nov': '11', 'decembre': '12', 'décembre': '12', 'dec': '12', 'déc': '12',
    };
    m = s.match(/^([a-zéûôàè]+)\s*(\d{4})$/i);
    if (m) {
      const mo = monthNames[m[1].toLowerCase()];
      if (mo) return { month: mo, year: m[2] };
    }

    m = s.match(/^(\d{4})\s*([a-zéûôàè]+)$/i);
    if (m) {
      const mo = monthNames[m[2].toLowerCase()];
      if (mo) return { month: mo, year: m[1] };
    }

    return null;
  }, []);

  const verifyPeriod = useCallback(() => {
    const selectedMonth = mois.padStart(2, '0');
    const selectedYear = annee;
    const errors: string[] = [];

    parsedData.forEach((row, i) => {
      if (!row.periode) return;
      const parsed = normalizePeriod(row.periode);
      if (!parsed) {
        errors.push(`Ligne ${i + 1}: format de période non reconnu "${row.periode}"`);
      } else if (parsed.month !== selectedMonth || parsed.year !== selectedYear) {
        errors.push(`Ligne ${i + 1}: période "${row.periode}" (${parsed.month}/${parsed.year}) ≠ "${selectedMonth}/${selectedYear}"`);
      }
    });

    setPeriodValid(errors.length === 0);
    setPeriodErrors(errors);
  }, [mois, annee, parsedData, normalizePeriod]);

  const validateData = useCallback(async () => {
    const { data: corrections } = await supabase.from('reference_corrections').select('*');
    const correctionMap = new Map<string, { matricule_correct: string; cco_correct: string | null }>();
    corrections?.forEach(c => {
      correctionMap.set(`${c.matricule_errone}|${c.cco_errone || ''}`, {
        matricule_correct: c.matricule_correct,
        cco_correct: c.cco_correct,
      });
    });

    const seen = new Map<string, number>();
    const matriculeCount = new Map<string, number>();

    const results: ValidationResult[] = parsedData.map((row, index) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      let corrected = false;
      const correctedFields: Record<string, { from: string; to: string }> = {};
      let isDuplicate = false;

      const dupeKey = `${row.code_caisse}|${row.cco}`;
      if (seen.has(dupeKey)) {
        isDuplicate = true;
        errors.push(`Doublon: code caisse ${row.code_caisse} + CCO ${row.cco} (ligne ${(seen.get(dupeKey)! + 1)})`);
      } else {
        seen.set(dupeKey, index);
      }

      const corrKey = `${row.matricule}|${row.cco}`;
      const corrKeyMatOnly = `${row.matricule}|`;
      const correction = correctionMap.get(corrKey) || correctionMap.get(corrKeyMatOnly);
      if (correction) {
        if (correction.matricule_correct !== row.matricule) {
          correctedFields['matricule'] = { from: row.matricule, to: correction.matricule_correct };
          row.matricule = correction.matricule_correct;
          corrected = true;
        }
        if (correction.cco_correct && correction.cco_correct !== row.cco) {
          correctedFields['cco'] = { from: row.cco, to: correction.cco_correct };
          row.cco = correction.cco_correct;
          corrected = true;
        }
      }

      const matCount = (matriculeCount.get(row.matricule) || 0) + 1;
      matriculeCount.set(row.matricule, matCount);
      if (matCount > 1) {
        const newMat = `${row.matricule}-${matCount}`;
        warnings.push(`Matricule doublon → renommé ${newMat}`);
        correctedFields['matricule_doublon'] = { from: row.matricule, to: newMat };
        row.matricule = newMat;
        corrected = true;
      }

      return { row, index, errors, warnings, corrected, correctedFields, isDuplicate };
    });

    setValidationResults(results);
  }, [parsedData]);

  const doImport = useCallback(async () => {
    setIsImporting(true);
    setImportProgress(0);

    try {
      const { data: session, error: sessionErr } = await supabase
        .from('import_sessions')
        .insert({
          mois: parseInt(mois),
          annee: parseInt(annee),
          file_name: file?.name || 'unknown',
          entreprise: isQuinzaine ? `${selectedCompanyName}_QUINZAINE` : selectedCompanyName,
          total_lignes: validationResults.length,
          lignes_valides: validationResults.filter(r => r.errors.length === 0).length,
          lignes_rejetees: validationResults.filter(r => r.errors.length > 0).length,
          lignes_doublons: validationResults.filter(r => r.isDuplicate).length,
          montant_total: validationResults.reduce((s, r) => s + r.row.montant, 0),
          corrections_applied: validationResults.filter(r => r.corrected).length,
          status: 'completed',
        })
        .select()
        .single();

      if (sessionErr || !session) throw sessionErr;

      setImportProgress(30);

      const validEntries = validationResults.filter(r => r.errors.length === 0);
      const batchSize = 500;
      for (let i = 0; i < validEntries.length; i += batchSize) {
        const batch = validEntries.slice(i, i + batchSize).map(r => ({
          session_id: session.id,
          periode: r.row.periode || `${mois.padStart(2, '0')}/${annee}`,
          matricule: r.row.matricule,
          nom: r.row.nom,
          prenom: r.row.prenom,
          code_caisse: r.row.code_caisse,
          cco: r.row.cco,
          montant: r.row.montant,
          matricule_original: r.correctedFields['matricule']?.from || r.correctedFields['matricule_doublon']?.from,
          cco_original: r.correctedFields['cco']?.from,
          was_corrected: r.corrected,
          correction_details: r.corrected ? JSON.stringify(r.correctedFields) : null,
          is_doublon: r.isDuplicate,
          status: 'valid',
        }));

        await supabase.from('import_entries').insert(batch);
        setImportProgress(30 + Math.round((i / validEntries.length) * 70));
      }

      setImportProgress(100);
      setImportComplete(true);
      toast({ title: 'Import terminé', description: `${validEntries.length} lignes importées pour ${selectedCompanyName}` });
    } catch (err: unknown) {
      toast({ 
        title: 'Erreur d\'import', 
        description: err instanceof Error ? err.message : 'Erreur inconnue', 
        variant: 'destructive' 
      });
    } finally {
      setIsImporting(false);
    }
  }, [mois, annee, file, isQuinzaine, selectedCompanyName, validationResults, toast]);

  const validCount = validationResults.filter(r => r.errors.length === 0).length;
  const errorCount = validationResults.filter(r => r.errors.length > 0).length;
  const correctedCount = validationResults.filter(r => r.corrected).length;

  const canAdvance = () => {
    switch (step) {
      case 1: return !!selectedCompany;
      case 2: {
        if (!mois || !annee) return false;
        if (!duplicateCheckDone) return false;
        if (duplicateExists && !isQuinzaine) return false;
        return true;
      }
      case 3: return parsedData.length > 0;
      case 4: return periodValid === true;
      case 5: return validationResults.length > 0 && errorCount === 0;
      case 6: return true;
      default: return false;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Import de Fichier</h1>
        <p className="text-muted-foreground mt-1">Assistant d'importation en 6 étapes</p>
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

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {/* STEP 1: Select Company */}
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
                  <Input
                    placeholder="Rechercher une entreprise..."
                    value={companySearch}
                    onChange={e => setCompanySearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="border rounded-md max-h-60 overflow-y-auto">
                  {filteredCompanies.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground text-center">Aucun résultat</p>
                  ) : (
                    filteredCompanies.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCompany(c.id)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 text-sm flex items-center justify-between hover:bg-muted/50 transition-colors border-b last:border-b-0",
                          selectedCompany === c.id && "bg-primary/10 text-primary font-medium"
                        )}
                      >
                        <span>{c.nom_entreprise}</span>
                        <Badge variant="outline" className="text-xs font-mono">{c.code_client}</Badge>
                      </button>
                    ))
                  )}
                </div>
              </div>
              {companies.length === 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Aucune entreprise</AlertTitle>
                  <AlertDescription>Veuillez d'abord créer une entreprise dans l'onglet Entreprises.</AlertDescription>
                </Alert>
              )}
              {selectedCompany && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertTitle>{selectedCompanyName}</AlertTitle>
                  <AlertDescription>Entreprise sélectionnée. Passez à l'étape suivante.</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* STEP 2: Select Month/Year */}
          {step === 2 && (
            <div className="space-y-4 max-w-md">
              <CardHeader className="p-0">
                <CardTitle>Sélection de la période</CardTitle>
                <CardDescription>
                  Entreprise : <strong>{selectedCompanyName}</strong> — Choisissez le mois et l'année
                </CardDescription>
              </CardHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mois</Label>
                  <Select value={mois} onValueChange={(v) => { setMois(v); setDuplicateCheckDone(false); setDuplicateExists(false); setIsQuinzaine(false); }}>
                    <SelectTrigger><SelectValue placeholder="Mois" /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Année</Label>
                  <Input 
                    type="number" 
                    value={annee} 
                    onChange={e => { setAnnee(e.target.value); setDuplicateCheckDone(false); setDuplicateExists(false); setIsQuinzaine(false); }}
                    min={2000} max={2100}
                  />
                </div>
              </div>

              {mois && annee && !duplicateCheckDone && (
                <Button variant="outline" onClick={checkDuplicateMonth}>
                  <Shield className="h-4 w-4 mr-2" />
                  Vérifier la disponibilité
                </Button>
              )}

              {duplicateCheckDone && !duplicateExists && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertTitle>Période disponible</AlertTitle>
                  <AlertDescription>Aucun import existant pour {selectedCompanyName} — {mois.padStart(2, '0')}/{annee}</AlertDescription>
                </Alert>
              )}

              {duplicateCheckDone && duplicateExists && (
                <div className="space-y-3">
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Import déjà effectué</AlertTitle>
                    <AlertDescription>
                      Un fichier a déjà été importé pour {selectedCompanyName} — {mois.padStart(2, '0')}/{annee}. 
                      Si vous souhaitez importer un second fichier pour ce mois, cochez la case ci-dessous.
                    </AlertDescription>
                  </Alert>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="quinzaine" 
                      checked={isQuinzaine} 
                      onCheckedChange={(checked) => setIsQuinzaine(checked === true)}
                    />
                    <Label htmlFor="quinzaine" className="text-sm font-medium cursor-pointer">
                      Il s'agit d'une quinzaine (2ᵉ import du mois)
                    </Label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Choose File */}
          {step === 3 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle>Choisir le fichier</CardTitle>
                <CardDescription>
                  {selectedCompanyName} — {mois.padStart(2, '0')}/{annee}
                  {isQuinzaine && ' (Quinzaine)'}
                  <br />Format: PERIODE, MATRICULE, NOM, PRENOM, CODE CAISSE, CCO, MONTANT
                </CardDescription>
              </CardHeader>
              {isQuinzaine && (
                <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/30">
                  🔄 Import quinzaine — 2ᵉ fichier pour {mois.padStart(2, '0')}/{annee}
                </Badge>
              )}
              <div className="dropzone cursor-pointer relative">
                <input 
                  type="file" 
                  accept=".xlsx,.xls,.csv" 
                  onChange={handleFileSelect}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {file ? file.name : 'Cliquez ou glissez un fichier Excel/CSV'}
                </p>
                {parsedData.length > 0 && (
                  <Badge variant="secondary" className="mt-2">{parsedData.length} lignes détectées</Badge>
                )}
              </div>
              {parsedData.length > 0 && (
                <div className="rounded-lg border overflow-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Période</TableHead>
                        <TableHead>Matricule</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead>Code Caisse</TableHead>
                        <TableHead>CCO</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.slice(0, 5).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.periode}</TableCell>
                          <TableCell className="font-mono">{r.matricule}</TableCell>
                          <TableCell>{r.nom} {r.prenom}</TableCell>
                          <TableCell>{r.code_caisse}</TableCell>
                          <TableCell>{r.cco}</TableCell>
                          <TableCell className="text-right font-mono">{r.montant.toLocaleString('fr-FR')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {parsedData.length > 5 && (
                    <p className="text-xs text-muted-foreground p-2 text-center">
                      ...et {parsedData.length - 5} autres lignes
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Verify Period */}
          {step === 4 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle>Vérification de la période</CardTitle>
                <CardDescription>
                  {selectedCompanyName} — Période sélectionnée : <strong>{mois.padStart(2, '0')}/{annee}</strong>
                  {isQuinzaine && <Badge variant="secondary" className="ml-2">Quinzaine</Badge>}
                </CardDescription>
              </CardHeader>
              {periodValid === null && (
                <Button onClick={verifyPeriod}>
                  <Shield className="h-4 w-4 mr-2" />
                  Lancer la vérification
                </Button>
              )}
              {periodValid === true && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertTitle>Période cohérente</AlertTitle>
                  <AlertDescription>
                    Toutes les {parsedData.length} lignes correspondent à la période {mois.padStart(2, '0')}/{annee}
                  </AlertDescription>
                </Alert>
              )}
              {periodValid === false && (
                <div className="space-y-2">
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Incohérence de période</AlertTitle>
                    <AlertDescription>{periodErrors.length} ligne(s) avec une période différente</AlertDescription>
                  </Alert>
                  <div className="max-h-40 overflow-auto space-y-1">
                    {periodErrors.map((e, i) => (
                      <p key={i} className="text-sm text-destructive">{e}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Validate Data */}
          {step === 5 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle>Vérification des données</CardTitle>
                <CardDescription>Doublons, matricules, corrections automatiques</CardDescription>
              </CardHeader>
              {validationResults.length === 0 ? (
                <Button onClick={validateData}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Lancer la validation
                </Button>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold text-success">{validCount}</p>
                        <p className="text-xs text-muted-foreground">Valides</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold text-destructive">{errorCount}</p>
                        <p className="text-xs text-muted-foreground">Rejetées</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold text-warning">{correctedCount}</p>
                        <p className="text-xs text-muted-foreground">Corrigées</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="rounded-lg border overflow-auto max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Matricule</TableHead>
                          <TableHead>Nom</TableHead>
                          <TableHead>Code Caisse</TableHead>
                          <TableHead>CCO</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validationResults.map(r => (
                          <TableRow 
                            key={r.index} 
                            className={cn(
                              r.errors.length > 0 && 'data-table-row-error',
                              r.corrected && r.errors.length === 0 && 'data-table-row-warning'
                            )}
                          >
                            <TableCell className="text-muted-foreground">{r.index + 1}</TableCell>
                            <TableCell className="font-mono">{r.row.matricule}</TableCell>
                            <TableCell>{r.row.nom} {r.row.prenom}</TableCell>
                            <TableCell>{r.row.code_caisse}</TableCell>
                            <TableCell>{r.row.cco}</TableCell>
                            <TableCell className="text-right font-mono">{r.row.montant.toLocaleString('fr-FR')}</TableCell>
                            <TableCell>
                              {r.errors.length > 0 ? (
                                <Badge variant="destructive" className="text-xs">{r.errors[0]}</Badge>
                              ) : r.corrected ? (
                                <Badge className="bg-warning text-warning-foreground text-xs">Corrigé</Badge>
                              ) : (
                                <Badge className="bg-success text-success-foreground text-xs">OK</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 6: Import */}
          {step === 6 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle>Confirmation d'import</CardTitle>
                <CardDescription>
                  {validCount} lignes prêtes pour <strong>{selectedCompanyName}</strong> — {mois.padStart(2, '0')}/{annee}
                  {isQuinzaine && ' (Quinzaine)'}
                </CardDescription>
              </CardHeader>

              <div className="grid grid-cols-2 gap-4 max-w-md">
                <div className="text-sm"><span className="text-muted-foreground">Entreprise:</span> {selectedCompanyName}</div>
                <div className="text-sm"><span className="text-muted-foreground">Fichier:</span> {file?.name}</div>
                <div className="text-sm"><span className="text-muted-foreground">Période:</span> {mois.padStart(2, '0')}/{annee}</div>
                <div className="text-sm"><span className="text-muted-foreground">Lignes valides:</span> {validCount}</div>
                <div className="text-sm col-span-2"><span className="text-muted-foreground">Montant total:</span> {validationResults.reduce((s, r) => s + (r.errors.length === 0 ? r.row.montant : 0), 0).toLocaleString('fr-FR')} FCFA</div>
                {isQuinzaine && (
                  <div className="text-sm col-span-2"><Badge variant="secondary">🔄 Quinzaine</Badge></div>
                )}
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
                    Rendez-vous dans le module <strong>Génération</strong> pour lancer le Triple Check 
                    et générer le fichier XML ISO 20022 pour Amplitude.
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
        <Button 
          variant="outline" 
          onClick={() => { setStep(s => s - 1); if (step === 5) setPeriodValid(null); }}
          disabled={step === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
        </Button>
        <Button 
          onClick={() => {
            if (step === 2 && !duplicateCheckDone) { checkDuplicateMonth(); return; }
            if (step === 4 && periodValid === null) { verifyPeriod(); return; }
            if (step === 5 && validationResults.length === 0) { validateData(); return; }
            setStep(s => s + 1);
          }}
          disabled={step === 6 || !canAdvance()}
        >
          Suivant <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
