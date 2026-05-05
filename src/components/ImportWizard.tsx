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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar, Upload, CheckCircle2, AlertTriangle, XCircle,
  ChevronRight, ChevronLeft, FileSpreadsheet, Loader2, Shield, Building2, Search,
  GitCompare, ArrowRight, Check, CreditCard, AlertCircle, Database, FileCheck
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
  ribStatus: 'valid' | 'unknown' | 'mismatch' | 'inactive' | 'neutralized' | 'divergence';
  referentielMatch?: ReferentielEntry;
  reconciled: boolean;
  reconciledRib?: string;
  neutralizedRib?: string;
  originalRib?: string;
  amplitudeMatch?: ReferentielEntry;
  referenceMatch?: ReferentielEntry;
  reconciledSource?: 'AMPLITUDE' | 'REFERENCE';
}

interface CompanyProfile {
  id: string;
  nom_entreprise: string;
  code_client: string;
}

type FeeType = 'AVEC_FRAIS' | 'SANS_FRAIS' | 'CAS_PARTICULIER';

interface FeeConfig {
  type: FeeType;
  compteSource: string;
  cleRib: string;
  feeInstruction?: string;
  convention?: string;
  label: string;
}

const FEE_CONFIGS: Record<FeeType, FeeConfig> = {
  AVEC_FRAIS: {
    type: 'AVEC_FRAIS',
    compteSource: '38100300000',
    cleRib: '35',
    feeInstruction: '35000002',
    label: 'Avec Frais',
  },
  SANS_FRAIS: {
    type: 'SANS_FRAIS',
    compteSource: '38100000000',
    cleRib: '69',
    convention: 'EECBZV2',
    label: 'Sans Frais',
  },
  CAS_PARTICULIER: {
    type: 'CAS_PARTICULIER',
    compteSource: '38100000000',
    cleRib: '69',
    convention: 'EECBZV2',
    label: 'Cas Particulier',
  },
};

const TECHNICAL_ACCOUNT = '38100000000';

function neutralizeRib(rib: string): string {
  const bankCode = rib.substring(0, 5);
  const branchCode = rib.substring(5, 10);
  return bankCode + branchCode + TECHNICAL_ACCOUNT;
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
  { id: 2, label: 'Type de frais', icon: CreditCard },
  { id: 3, label: 'Période', icon: Calendar },
  { id: 4, label: 'Fichier', icon: Upload },
  { id: 5, label: 'Audit RIB', icon: Shield },
  { id: 6, label: 'Réconciliation', icon: GitCompare },
  { id: 7, label: 'Import', icon: FileSpreadsheet },
];

export function ImportWizard() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [feeType, setFeeType] = useState<FeeType | ''>('');
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

  const feeConfig = feeType ? FEE_CONFIGS[feeType] : null;

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

  // Step 5: Audit RIB against referentiel (Oracle first, then local cache)
  const validateRIBs = useCallback(async () => {
    setIsValidating(true);

    // PHASE A + PHASE B en parallèle
    // Phase A: Base Amplitude (Oracle via edge function)
    // Phase B: Fichiers de référence (cache local certifié)
    let oracleResults: Record<string, { found: boolean; nom_oracle?: string; id_societaire?: string; account_status?: string; is_valid?: boolean; proposed_correction?: { rib: string; nom: string; id_societaire: string } | null }> = {};
    let oracleAvailable = false;

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const ribsToValidate = parsedData.map(r => ({ rib: r.rib, nom: r.nom_complet }));

    // Lance les 2 phases EN PARALLÈLE
    const [phaseA, phaseB] = await Promise.allSettled([
      // Phase A : Amplitude
      fetch(
        `https://${projectId}.supabase.co/functions/v1/oracle-proxy?action=validate-batch`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ribs: ribsToValidate }),
        }
      ).then(r => r.ok ? r.json() : null),
      // Phase B : Référentiel local
      supabase
        .from('account_status_cache')
        .select('rib, nom_titulaire, prenom_titulaire, id_societaire, account_status'),
    ]);

    if (phaseA.status === 'fulfilled' && phaseA.value?.data) {
      oracleAvailable = true;
      for (const r of phaseA.value.data) oracleResults[r.rib] = r;
    }

    const refData = phaseB.status === 'fulfilled' ? phaseB.value.data : null;

    const refMap = new Map<string, ReferentielEntry>();
    refData?.forEach(r => refMap.set(r.rib, r as ReferentielEntry));

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
      let neutralizedRib: string | undefined;
      const originalRib = row.rib;
      let amplitudeMatch: ReferentielEntry | undefined;
      let referenceMatch: ReferentielEntry | undefined;

      if (!row.nom_complet) errors.push('Nom manquant');
      if (!row.rib) errors.push('RIB manquant');
      if (row.montant <= 0) errors.push('Montant invalide');

      if (row.rib) {
        if (row.rib.length < 21 || row.rib.length > 23) {
          errors.push(`RIB longueur invalide (${row.rib.length})`);
          ribStatus = 'unknown';
        } else {
          // ===== Phase A : résultat Amplitude (Oracle) =====
          const oracleEntry = oracleResults[row.rib];
          if (oracleAvailable && oracleEntry?.found) {
            amplitudeMatch = {
              rib: row.rib,
              nom_titulaire: oracleEntry.nom_oracle || '',
              prenom_titulaire: null,
              id_societaire: oracleEntry.id_societaire || '',
              account_status: oracleEntry.account_status || 'ACTIF',
            };
          } else if (oracleAvailable && oracleEntry?.proposed_correction) {
            amplitudeMatch = {
              rib: oracleEntry.proposed_correction.rib,
              nom_titulaire: oracleEntry.proposed_correction.nom,
              prenom_titulaire: null,
              id_societaire: oracleEntry.proposed_correction.id_societaire,
              account_status: 'ACTIF',
            };
          }

          // ===== Phase B : résultat Référentiel local =====
          const refEntry = refMap.get(row.rib);
          if (refEntry) {
            referenceMatch = refEntry;
          } else {
            const byName = nameMap.get(row.nom_complet);
            if (byName && byName.length > 0) {
              referenceMatch = byName.find(b => b.account_status === 'ACTIF') || byName[0];
            }
          }

          // ===== Décision finale =====
          const aOk = amplitudeMatch && amplitudeMatch.account_status === 'ACTIF';
          const bOk = referenceMatch && referenceMatch.account_status === 'ACTIF';
          const aRib = amplitudeMatch?.rib;
          const bRib = referenceMatch?.rib;

          if (aOk && bOk && aRib === row.rib && bRib === row.rib) {
            // ✅ Conforme aux DEUX sources : succès automatique
            ribStatus = 'valid';
            referentielMatch = amplitudeMatch;
            warnings.push('✓ Conforme Amplitude + Référentiel');
          } else if (aOk && bOk && aRib !== bRib) {
            // ⚠ Divergence entre Amplitude et Référentiel
            ribStatus = 'divergence';
            referentielMatch = amplitudeMatch;
            warnings.push(`Divergence: Amplitude=${aRib} vs Référentiel=${bRib}`);
          } else if (aOk && aRib === row.rib) {
            ribStatus = 'valid';
            referentielMatch = amplitudeMatch;
            warnings.push('✓ Validé via Amplitude');
          } else if (bOk && bRib === row.rib) {
            ribStatus = 'valid';
            referentielMatch = referenceMatch;
            warnings.push('✓ Validé via Référentiel');
          } else if (amplitudeMatch && !aOk) {
            ribStatus = 'inactive';
            referentielMatch = amplitudeMatch;
            errors.push(`Compte ${amplitudeMatch.account_status} (Amplitude) — Impossible de traiter`);
          } else if (referenceMatch && !bOk) {
            ribStatus = 'inactive';
            referentielMatch = referenceMatch;
            errors.push(`Compte ${referenceMatch.account_status} — Impossible de traiter`);
          } else if (amplitudeMatch || referenceMatch) {
            // RIB Excel diffère, mais une des sources propose une correction
            ribStatus = 'mismatch';
            referentielMatch = amplitudeMatch || referenceMatch;
          } else {
            neutralizedRib = neutralizeRib(row.rib);
            ribStatus = 'neutralized';
            warnings.push(`RIB absent des 2 sources — Neutralisé: ${neutralizedRib}`);
          }
        }
      }

      return { row, index, errors, warnings, ribStatus, referentielMatch, reconciled: false, neutralizedRib, originalRib, amplitudeMatch, referenceMatch };
    });

    setValidationResults(results);
    setIsValidating(false);
    
    if (oracleAvailable) {
      toast({ title: '✅ Double vérification', description: 'Phase A (Amplitude) + Phase B (Référentiel) terminées.' });
    } else {
      toast({ title: '⚠ Phase A indisponible', description: 'Vérification effectuée uniquement sur le Référentiel.' });
    }
  }, [parsedData, toast]);

  // Réconciliation par source (Amplitude ou Référentiel)
  const reconcileRowFromSource = useCallback((index: number, source: 'AMPLITUDE' | 'REFERENCE') => {
    setValidationResults(prev => prev.map(r => {
      if (r.index !== index) return r;
      const target = source === 'AMPLITUDE' ? r.amplitudeMatch : r.referenceMatch;
      if (!target) return r;
      return {
        ...r,
        reconciled: true,
        reconciledRib: target.rib,
        reconciledSource: source,
        ribStatus: 'valid' as const,
        referentielMatch: target,
        errors: r.errors.filter(e => !e.includes('RIB inconnu') && !e.includes('RIB absent')),
        warnings: [...r.warnings, `Réconcilié via ${source === 'AMPLITUDE' ? 'Base Amplitude' : 'Fichiers de Référence'}: ${r.row.rib} → ${target.rib}`],
        row: { ...r.row, rib: target.rib },
      };
    }));
    setReconciliationDialogOpen(false);
    toast({
      title: source === 'AMPLITUDE' ? '✓ Aligné sur Amplitude' : '✓ Aligné sur Référence',
      description: 'La donnée est validée selon la source choisie.',
    });
  }, [toast]);

  // Réconciliation globale par source
  const reconcileAllFromSource = useCallback((source: 'AMPLITUDE' | 'REFERENCE') => {
    setValidationResults(prev => prev.map(r => {
      if ((r.ribStatus !== 'mismatch' && r.ribStatus !== 'divergence') || r.reconciled) return r;
      const target = source === 'AMPLITUDE' ? r.amplitudeMatch : r.referenceMatch;
      if (!target) return r;
      return {
        ...r,
        reconciled: true,
        reconciledRib: target.rib,
        reconciledSource: source,
        ribStatus: 'valid' as const,
        referentielMatch: target,
        errors: r.errors.filter(e => !e.includes('RIB inconnu') && !e.includes('RIB absent')),
        warnings: [...r.warnings, `Réconcilié via ${source}: ${r.row.rib} → ${target.rib}`],
        row: { ...r.row, rib: target.rib },
      };
    }));
    toast({
      title: source === 'AMPLITUDE' ? 'Réconciliation globale (Amplitude)' : 'Réconciliation globale (Référence)',
      description: 'Toutes les divergences ont été alignées sur la source choisie.',
    });
  }, [toast]);

  const doImport = useCallback(async () => {
    setIsImporting(true);
    setImportProgress(0);

    try {
      // Apply neutralization to unknown RIBs before import
      const processedResults = validationResults.map(r => {
        if (r.ribStatus === 'neutralized' && r.neutralizedRib) {
          return { ...r, row: { ...r.row, rib: r.neutralizedRib } };
        }
        return r;
      });

      const validEntries = processedResults.filter(r => r.errors.length === 0);

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
          was_corrected: r.reconciled || r.ribStatus === 'neutralized',
          correction_details: r.reconciled
            ? JSON.stringify({ type: 'reconciliation', rib_original: r.originalRib, rib_corrige: r.row.rib })
            : r.ribStatus === 'neutralized'
              ? JSON.stringify({ type: 'neutralization', rib_original: r.originalRib, rib_neutralise: r.neutralizedRib, fee_type: feeType })
              : null,
          is_doublon: false,
          status: 'valid',
        }));

        await supabase.from('import_entries').insert(batch);
        setImportProgress(30 + Math.round((i / validEntries.length) * 70));
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        action: 'import',
        description: `Import paie (${feeConfig?.label}): ${validEntries.length} lignes pour ${selectedCompanyName} (${mois.padStart(2, '0')}/${annee})`,
        details: {
          entreprise: selectedCompanyName,
          periode: `${mois.padStart(2, '0')}/${annee}`,
          fee_type: feeType,
          compte_source: feeConfig?.compteSource,
          cle_rib: feeConfig?.cleRib,
          total: validationResults.length,
          valides: validEntries.length,
          reconcilies: validationResults.filter(r => r.reconciled).length,
          neutralises: validationResults.filter(r => r.ribStatus === 'neutralized').length,
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
  }, [mois, annee, file, isQuinzaine, selectedCompanyName, validationResults, feeType, feeConfig, toast]);

  const validCount = validationResults.filter(r => r.errors.length === 0 && r.ribStatus !== 'neutralized').length;
  const errorCount = validationResults.filter(r => r.errors.length > 0).length;
  const mismatchCount = validationResults.filter(r => r.ribStatus === 'mismatch' && !r.reconciled).length;
  const reconciledCount = validationResults.filter(r => r.reconciled).length;
  const neutralizedCount = validationResults.filter(r => r.ribStatus === 'neutralized').length;
  const totalValidForImport = validationResults.filter(r => r.errors.length === 0).length;

  const canAdvance = () => {
    switch (step) {
      case 1: return !!selectedCompany;
      case 2: return !!feeType;
      case 3: return !!(mois && annee && duplicateCheckDone && (!duplicateExists || isQuinzaine));
      case 4: return parsedData.length > 0;
      case 5: return validationResults.length > 0;
      case 6: return mismatchCount === 0 && errorCount === 0;
      case 7: return true;
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

          {/* STEP 2: Fee Type */}
          {step === 2 && (
            <div className="space-y-6 max-w-2xl">
              <CardHeader className="p-0">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Type d'importation
                </CardTitle>
                <CardDescription>
                  Entreprise : <strong>{selectedCompanyName}</strong> — Sélectionnez le mode de traitement des frais
                </CardDescription>
              </CardHeader>

              <RadioGroup value={feeType} onValueChange={(v) => setFeeType(v as FeeType)} className="grid gap-4">
                {/* AVEC FRAIS */}
                <label htmlFor="fee-avec" className={cn(
                  "flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md",
                  feeType === 'AVEC_FRAIS' ? "border-primary bg-primary/5" : "border-border"
                )}>
                  <RadioGroupItem value="AVEC_FRAIS" id="fee-avec" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">Avec Frais</span>
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">Standard</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Les frais de virement sont prélevés. Les virements sont effectués via le compte source avec instruction de frais.
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/50 rounded-md p-2 font-mono">
                      <div><span className="text-muted-foreground">Compte Source:</span> 38100300000</div>
                      <div><span className="text-muted-foreground">Clé RIB:</span> 35</div>
                      <div><span className="text-muted-foreground">Instruction:</span> 35000002</div>
                      <div><span className="text-muted-foreground">Bénéficiaire:</span> RIB réel</div>
                    </div>
                  </div>
                </label>

                {/* SANS FRAIS */}
                <label htmlFor="fee-sans" className={cn(
                  "flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md",
                  feeType === 'SANS_FRAIS' ? "border-primary bg-primary/5" : "border-border"
                )}>
                  <RadioGroupItem value="SANS_FRAIS" id="fee-sans" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">Sans Frais</span>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs">Caisse Fédérale</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Aucun frais prélevé. Les virements passent par le compte pivot de la Caisse Fédérale (convention EECBZV2).
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/50 rounded-md p-2 font-mono">
                      <div><span className="text-muted-foreground">Compte Source:</span> 38100000000</div>
                      <div><span className="text-muted-foreground">Clé RIB:</span> 69</div>
                      <div><span className="text-muted-foreground">Convention:</span> EECBZV2</div>
                      <div><span className="text-muted-foreground">Bénéficiaire:</span> RIB réel</div>
                    </div>
                  </div>
                </label>

                {/* CAS PARTICULIER */}
                <label htmlFor="fee-cas" className={cn(
                  "flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md",
                  feeType === 'CAS_PARTICULIER' ? "border-primary bg-primary/5" : "border-border"
                )}>
                  <RadioGroupItem value="CAS_PARTICULIER" id="fee-cas" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">Cas Particulier</span>
                      <Badge className="bg-orange-100 text-orange-800 border-orange-300 text-xs">Réconciliation</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Si le RIB du sociétaire est inconnu, le système neutralise le numéro de compte en le remplaçant par le compte technique <strong>38100000000</strong> tout en conservant le code banque et agence d'origine.
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/50 rounded-md p-2 font-mono">
                      <div><span className="text-muted-foreground">Compte Source:</span> 38100000000</div>
                      <div><span className="text-muted-foreground">Clé RIB:</span> 69</div>
                      <div><span className="text-muted-foreground">Convention:</span> EECBZV2</div>
                      <div><span className="text-muted-foreground">Inconnu:</span> Banque+Agence+38100000000</div>
                    </div>
                    <Alert className="border-orange-300 bg-orange-50 py-2">
                      <AlertCircle className="h-3 w-3 text-orange-600" />
                      <AlertDescription className="text-xs text-orange-700">
                        Les fonds des RIB inconnus seront dirigés vers un compte d'attente technique au sein de l'agence du bénéficiaire.
                      </AlertDescription>
                    </Alert>
                  </div>
                </label>
              </RadioGroup>

              {feeType && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertTitle>Mode sélectionné : {feeConfig?.label}</AlertTitle>
                  <AlertDescription>
                    Compte source : <span className="font-mono">{feeConfig?.compteSource}</span> — Clé : <span className="font-mono">{feeConfig?.cleRib}</span>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* STEP 3: Period */}
          {step === 3 && (
            <div className="space-y-4 max-w-md">
              <CardHeader className="p-0">
                <CardTitle>Sélection de la période</CardTitle>
                <CardDescription>
                  Entreprise : <strong>{selectedCompanyName}</strong> — Mode : <Badge variant="outline">{feeConfig?.label}</Badge>
                </CardDescription>
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

          {/* STEP 4: File */}
          {step === 4 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle>Choisir le fichier</CardTitle>
                <CardDescription>
                  {selectedCompanyName} — {mois.padStart(2, '0')}/{annee} — <Badge variant="outline">{feeConfig?.label}</Badge>
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

          {/* STEP 5: Audit RIB */}
          {step === 5 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Audit RIB — Comparaison avec le Référentiel
                </CardTitle>
                <CardDescription>
                  Mode : <Badge variant="outline">{feeConfig?.label}</Badge> — Chaque RIB est comparé à la base certifiée
                </CardDescription>
              </CardHeader>

              {validationResults.length === 0 ? (
                <Button onClick={validateRIBs} disabled={isValidating}>
                  {isValidating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                  Lancer l'audit RIB
                </Button>
              ) : (
                <>
                  <div className="grid grid-cols-5 gap-3">
                    <Card><CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-success">{validCount}</p>
                      <p className="text-xs text-muted-foreground">Certifiés</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-warning">{mismatchCount}</p>
                      <p className="text-xs text-muted-foreground">Non concordants</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-orange-500">{neutralizedCount}</p>
                      <p className="text-xs text-muted-foreground">Neutralisés</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-destructive">{errorCount}</p>
                      <p className="text-xs text-muted-foreground">Erreurs</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-primary">{reconciledCount}</p>
                      <p className="text-xs text-muted-foreground">Réconciliés</p>
                    </CardContent></Card>
                  </div>

                  {neutralizedCount > 0 && (
                    <Alert className="border-orange-300 bg-orange-50">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      <AlertTitle className="text-orange-800">{neutralizedCount} RIB neutralisé(s)</AlertTitle>
                      <AlertDescription className="text-orange-700">
                        Ces bénéficiaires ne sont pas dans le référentiel. Leurs virements seront redirigés vers le compte technique <span className="font-mono font-bold">38100000000</span> au sein de leur agence d'origine.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="rounded-lg border overflow-auto max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Nom</TableHead>
                          <TableHead>RIB Fichier</TableHead>
                          <TableHead>RIB Final</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validationResults.map(r => (
                          <TableRow key={r.index} className={cn(
                            r.ribStatus === 'valid' && 'bg-success/5',
                            r.ribStatus === 'mismatch' && !r.reconciled && 'bg-warning/10',
                            r.ribStatus === 'neutralized' && 'bg-orange-50',
                            (r.ribStatus === 'unknown' || r.ribStatus === 'inactive') && 'bg-destructive/5',
                            r.reconciled && 'bg-primary/5'
                          )}>
                            <TableCell className="text-muted-foreground">{r.index + 1}</TableCell>
                            <TableCell>{r.row.nom_complet}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {r.reconciled ? <s className="text-muted-foreground">{r.originalRib}</s> : r.row.rib}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {r.ribStatus === 'neutralized' ? (
                                <span className="text-orange-600 font-semibold">{r.neutralizedRib}</span>
                              ) : r.reconciled ? (
                                <span className="text-success">{r.row.rib}</span>
                              ) : r.referentielMatch ? (
                                r.referentielMatch.rib
                              ) : '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono">{r.row.montant.toLocaleString('fr-FR')}</TableCell>
                            <TableCell>
                              {r.reconciled ? (
                                <Badge className="bg-primary text-primary-foreground text-xs"><Check className="h-3 w-3 mr-1" />Réconcilié</Badge>
                              ) : r.ribStatus === 'valid' ? (
                                <Badge className="bg-success text-success-foreground text-xs">✓ Certifié</Badge>
                              ) : r.ribStatus === 'neutralized' ? (
                                <Badge className="bg-orange-100 text-orange-800 border-orange-300 text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" />Neutralisé
                                </Badge>
                              ) : (r.ribStatus === 'mismatch' || r.ribStatus === 'divergence') ? (
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

          {/* STEP 6: Reconciliation */}
          {step === 6 && (
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
                      Choisissez la source d'autorité : <strong>Base Amplitude</strong> ou <strong>Fichiers de Référence</strong>.
                    </AlertDescription>
                  </Alert>

                  <div className="rounded-lg border overflow-auto max-h-80">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom</TableHead>
                          <TableHead>RIB Excel</TableHead>
                          <TableHead>Amplitude</TableHead>
                          <TableHead>Référence</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validationResults.filter(r => (r.ribStatus === 'mismatch' || r.ribStatus === 'divergence') && !r.reconciled).map(r => (
                          <TableRow key={r.index}>
                            <TableCell>{r.row.nom_complet}</TableCell>
                            <TableCell className="font-mono text-xs text-destructive">{r.row.rib}</TableCell>
                            <TableCell className="font-mono text-xs">{r.amplitudeMatch?.rib || <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="font-mono text-xs">{r.referenceMatch?.rib || <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={() => { setSelectedReconciliation(r.index); setReconciliationDialogOpen(true); }} className="h-7 text-xs">
                                <GitCompare className="h-3 w-3 mr-1" />Choisir
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button onClick={() => reconcileAllFromSource('AMPLITUDE')} size="lg" variant="default">
                      <Database className="h-4 w-4 mr-2" />
                      Tout aligner sur Amplitude
                    </Button>
                    <Button onClick={() => reconcileAllFromSource('REFERENCE')} size="lg" variant="secondary">
                      <FileCheck className="h-4 w-4 mr-2" />
                      Tout aligner sur Référence
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {neutralizedCount > 0 && (
                    <Alert className="border-orange-300 bg-orange-50">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      <AlertTitle className="text-orange-800">{neutralizedCount} ligne(s) neutralisée(s)</AlertTitle>
                      <AlertDescription className="text-orange-700">
                        Les virements suivants seront redirigés vers le compte technique <span className="font-mono font-bold">38100000000</span> de l'agence du bénéficiaire.
                      </AlertDescription>
                    </Alert>
                  )}

                  {neutralizedCount > 0 && (
                    <div className="rounded-lg border overflow-auto max-h-60">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nom</TableHead>
                            <TableHead>RIB Original</TableHead>
                            <TableHead className="text-center">→</TableHead>
                            <TableHead>RIB Neutralisé</TableHead>
                            <TableHead className="text-right">Montant</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationResults.filter(r => r.ribStatus === 'neutralized').map(r => (
                            <TableRow key={r.index} className="bg-orange-50">
                              <TableCell>{r.row.nom_complet}</TableCell>
                              <TableCell className="font-mono text-xs text-destructive">{r.originalRib}</TableCell>
                              <TableCell className="text-center"><ArrowRight className="h-4 w-4 text-orange-500 mx-auto" /></TableCell>
                              <TableCell className="font-mono text-xs text-orange-600 font-semibold">{r.neutralizedRib}</TableCell>
                              <TableCell className="text-right font-mono">{r.row.montant.toLocaleString('fr-FR')}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {errorCount > 0 ? (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>{errorCount} erreur(s) bloquante(s)</AlertTitle>
                      <AlertDescription>Certaines lignes ont des erreurs qui ne peuvent pas être réconciliées. Corrigez le fichier source.</AlertDescription>
                    </Alert>
                  ) : (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <AlertTitle>Toutes les lignes sont prêtes</AlertTitle>
                      <AlertDescription>
                        {validCount} RIB certifiés
                        {reconciledCount > 0 && `, ${reconciledCount} réconciliés`}
                        {neutralizedCount > 0 && `, ${neutralizedCount} neutralisés vers compte technique`}
                        . Prêt pour l'import.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </div>
          )}

          {/* STEP 7: Import */}
          {step === 7 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle>Confirmation d'import</CardTitle>
                <CardDescription>{totalValidForImport} lignes prêtes pour <strong>{selectedCompanyName}</strong> — {mois.padStart(2, '0')}/{annee}</CardDescription>
              </CardHeader>

              <div className="grid grid-cols-2 gap-4 max-w-lg">
                <div className="text-sm"><span className="text-muted-foreground">Entreprise:</span> {selectedCompanyName}</div>
                <div className="text-sm"><span className="text-muted-foreground">Mode:</span> <Badge variant="outline">{feeConfig?.label}</Badge></div>
                <div className="text-sm"><span className="text-muted-foreground">Fichier:</span> {file?.name}</div>
                <div className="text-sm"><span className="text-muted-foreground">Période:</span> {mois.padStart(2, '0')}/{annee}</div>
                <div className="text-sm"><span className="text-muted-foreground">Compte source:</span> <span className="font-mono">{feeConfig?.compteSource}</span></div>
                <div className="text-sm"><span className="text-muted-foreground">Clé RIB:</span> <span className="font-mono">{feeConfig?.cleRib}</span></div>
                <div className="text-sm"><span className="text-muted-foreground">Lignes valides:</span> {validCount}</div>
                <div className="text-sm"><span className="text-muted-foreground">Réconciliés:</span> {reconciledCount}</div>
                {neutralizedCount > 0 && (
                  <div className="text-sm col-span-2 text-orange-700">
                    <span className="text-muted-foreground">Neutralisés:</span> {neutralizedCount} (→ compte technique 38100000000)
                  </div>
                )}
                <div className="text-sm col-span-2">
                  <span className="text-muted-foreground">Montant total:</span>{' '}
                  {validationResults.filter(r => r.errors.length === 0).reduce((s, r) => s + r.row.montant, 0).toLocaleString('fr-FR')} FCFA
                </div>
              </div>

              {feeConfig?.feeInstruction && (
                <Alert>
                  <CreditCard className="h-4 w-4" />
                  <AlertTitle>Instruction de frais active</AlertTitle>
                  <AlertDescription>
                    Code instruction : <span className="font-mono font-bold">{feeConfig.feeInstruction}</span>
                  </AlertDescription>
                </Alert>
              )}

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
                    {totalValidForImport} lignes importées pour <strong>{selectedCompanyName}</strong> ({feeConfig?.label}).
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
            if (step === 3 && !duplicateCheckDone) { checkDuplicateMonth(); return; }
            if (step === 5 && validationResults.length === 0) { validateRIBs(); return; }
            setStep(s => s + 1);
          }}
          disabled={step === 7 || !canAdvance()}
        >
          Suivant <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Reconciliation Dialog */}
      <Dialog open={reconciliationDialogOpen} onOpenChange={setReconciliationDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-primary" />
              Réconciliation — Choisir la source d'autorité
            </DialogTitle>
          </DialogHeader>
          {selectedReconItem && (
            <div className="space-y-4">
              <div className="text-sm"><strong>Salarié :</strong> {selectedReconItem.row.nom_complet}</div>
              <div className="grid grid-cols-3 gap-3">
                <Card className="border-destructive/30">
                  <CardHeader className="pb-2"><CardTitle className="text-xs text-destructive">Fichier Excel (importé)</CardTitle></CardHeader>
                  <CardContent><p className="font-mono text-sm">{selectedReconItem.row.rib}</p></CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-2"><CardTitle className="text-xs text-primary flex items-center gap-1"><Database className="h-3 w-3" />Base Amplitude</CardTitle></CardHeader>
                  <CardContent>
                    <p className="font-mono text-sm">{selectedReconItem.amplitudeMatch?.rib || '—'}</p>
                    <p className="text-xs text-muted-foreground mt-1">{selectedReconItem.amplitudeMatch?.nom_titulaire || 'Indisponible'}</p>
                  </CardContent>
                </Card>
                <Card className="border-secondary/40">
                  <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1"><FileCheck className="h-3 w-3" />Fichiers de Référence</CardTitle></CardHeader>
                  <CardContent>
                    <p className="font-mono text-sm">{selectedReconItem.referenceMatch?.rib || '—'}</p>
                    <p className="text-xs text-muted-foreground mt-1">{selectedReconItem.referenceMatch?.nom_titulaire || 'Indisponible'}</p>
                  </CardContent>
                </Card>
              </div>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Le RIB importé sera aligné sur la source que vous choisissez. La donnée sera ensuite considérée comme validée.</AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReconciliationDialogOpen(false)}>Annuler</Button>
            <Button
              variant="default"
              disabled={!selectedReconItem?.amplitudeMatch}
              onClick={() => selectedReconciliation !== null && reconcileRowFromSource(selectedReconciliation, 'AMPLITUDE')}
            >
              <Database className="h-4 w-4 mr-2" />Réconciliation avec Base de Données
            </Button>
            <Button
              variant="secondary"
              disabled={!selectedReconItem?.referenceMatch}
              onClick={() => selectedReconciliation !== null && reconcileRowFromSource(selectedReconciliation, 'REFERENCE')}
            >
              <FileCheck className="h-4 w-4 mr-2" />Réconciliation avec Fichiers de Référence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
