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
import { useAuth } from '@/contexts/AuthContext';
import {
  Calendar, Upload, CheckCircle2, AlertTriangle, XCircle,
  ChevronRight, ChevronLeft, FileSpreadsheet, Loader2, Shield, Building2, Search,
  GitCompare, ArrowRight, Check, CreditCard, AlertCircle, Database, FileCheck,
  Send, RefreshCw, Trash2, Clock, Eye, FileCode, Download, FolderOpen
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { generateISO20022FromImportData, type GeneratedXMLResult, type ImportDataRow } from '@/lib/engine/iso20022DirectGenerator';

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

// Per-line action for neutralized RIBs
type NeutralizedAction =
  | { type: 'idle' }
  | { type: 'pending'; requestId: string }
  | { type: 'approved' }
  | { type: 'rejected'; reason?: string }
  | { type: 'removed' };

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
  neutralizedAction?: NeutralizedAction;
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
  { id: 8, label: 'Génération XML', icon: FileCode },   // nouvelle étape
];

export function ImportWizard() {
  const { toast } = useToast();
  const { profile, adminVille } = useAuth();
  const [step, setStep] = useState(1);
  const [isPollingValidation, setIsPollingValidation] = useState(false);
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
  // États pour la génération XML
  const [generatedFile, setGeneratedFile] = useState<GeneratedXMLResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [xmlPreviewOpen, setXmlPreviewOpen] = useState(false);

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

    // Phase A + Phase B en parallèle
    let oracleResults: Record<string, { found: boolean; nom_oracle?: string; id_societaire?: string; account_status?: string; is_valid?: boolean; proposed_correction?: { rib: string; nom: string; id_societaire: string } | null }> = {};
    let oracleAvailable = false;

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const ribsToValidate = parsedData.map(r => ({ rib: r.rib, nom: r.nom_complet }));

    const [phaseA, phaseB] = await Promise.allSettled([
      fetch(
        `https://${projectId}.supabase.co/functions/v1/oracle-proxy?action=validate-batch`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ribs: ribsToValidate }),
        }
      ).then(r => r.ok ? r.json() : null),
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

          const refEntry = refMap.get(row.rib);
          if (refEntry) {
            referenceMatch = refEntry;
          } else {
            const byName = nameMap.get(row.nom_complet);
            if (byName && byName.length > 0) {
              referenceMatch = byName.find(b => b.account_status === 'ACTIF') || byName[0];
            }
          }

          const aOk = amplitudeMatch && amplitudeMatch.account_status === 'ACTIF';
          const bOk = referenceMatch && referenceMatch.account_status === 'ACTIF';
          const aRib = amplitudeMatch?.rib;
          const bRib = referenceMatch?.rib;

          if (aOk && bOk && aRib === row.rib && bRib === row.rib) {
            ribStatus = 'valid';
            referentielMatch = amplitudeMatch;
            warnings.push('✓ Conforme Amplitude + Référentiel');
          } else if (aOk && bOk && aRib !== bRib) {
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

  const sendValidationRequest = useCallback(async (index: number) => {
    const r = validationResults.find(v => v.index === index);
    if (!r || r.ribStatus !== 'neutralized') return;

    setValidationResults(prev => prev.map(v =>
      v.index === index
        ? { ...v, neutralizedAction: { type: 'pending', requestId: '' } }
        : v
    ));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');

      const { data: pvr, error } = await supabase
        .from('payment_validation_requests')
        .insert({
          ville: (profile?.ville ?? adminVille ?? 'POINTE_NOIRE') as string,
          status: 'pending',
          total_count: 1,
          total_amount: r.row.montant,
          requested_by: user.id,
          neutralized_ribs: [
            {
              index,
              nom: r.row.nom_complet,
              rib_original: r.originalRib || r.row.rib,
              redirected_to: r.neutralizedRib,
              montant: r.row.montant,
              reason: 'RIB absent du référentiel',
            },
          ],
        })
        .select('id')
        .single();

      if (error || !pvr) throw error || new Error('Insert failed');

      setValidationResults(prev => prev.map(v =>
        v.index === index
          ? { ...v, neutralizedAction: { type: 'pending', requestId: pvr.id } }
          : v
      ));

      toast({
        title: '📤 Demande envoyée',
        description: `En attente de validation par un Admin ou Chef de Service pour "${r.row.nom_complet}".`,
      });
    } catch (err) {
      setValidationResults(prev => prev.map(v =>
        v.index === index
          ? { ...v, neutralizedAction: { type: 'idle' } }
          : v
      ));
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : "Impossible d'envoyer la demande",
        variant: 'destructive',
      });
    }
  }, [validationResults, profile, adminVille, toast]);

  const removeNeutralizedLine = useCallback((index: number) => {
    setValidationResults(prev => prev.map(v =>
      v.index === index
        ? { ...v, neutralizedAction: { type: 'removed' } }
        : v
    ));
    toast({
      title: '🗑 Sociétaire retiré',
      description: "La ligne a été exclue de l'import.",
    });
  }, [toast]);

  const pollNeutralizedStatuses = useCallback(async () => {
    const pendingItems = validationResults.filter(
      r => r.ribStatus === 'neutralized' && r.neutralizedAction?.type === 'pending'
    );
    if (pendingItems.length === 0) return;

    setIsPollingValidation(true);
    try {
      const requestIds = pendingItems
        .map(r => (r.neutralizedAction as { type: 'pending'; requestId: string }).requestId)
        .filter(Boolean);

      const { data } = await supabase
        .from('payment_validation_requests')
        .select('id, status, validation_notes')
        .in('id', requestIds);

      if (!data) return;

      setValidationResults(prev => prev.map(v => {
        if (v.ribStatus !== 'neutralized' || v.neutralizedAction?.type !== 'pending') return v;
        const action = v.neutralizedAction as { type: 'pending'; requestId: string };
        const found = data.find(d => d.id === action.requestId);
        if (!found) return v;
        if (found.status === 'approved') {
          return { ...v, neutralizedAction: { type: 'approved' } };
        }
        if (found.status === 'rejected') {
          return { ...v, neutralizedAction: { type: 'rejected', reason: found.validation_notes || undefined } };
        }
        return v;
      }));
    } finally {
      setIsPollingValidation(false);
    }
  }, [validationResults]);

  // Génération automatique du fichier XML après l'import
  const autoGenerateXML = useCallback(() => {
    if (!feeConfig || validationResults.length === 0) return;

    setIsGenerating(true);

    try {
      // Appliquer la neutralisation et exclure les lignes supprimées
      const processedResults = validationResults
        .filter(r => r.neutralizedAction?.type !== 'removed')
        .map(r => {
          if (r.ribStatus === 'neutralized' && r.neutralizedRib) {
            return { ...r, row: { ...r.row, rib: r.neutralizedRib } };
          }
          return r;
        });

      const validEntries = processedResults.filter(r => r.errors.length === 0);

      const codeBanque = feeConfig.compteSource.substring(0, 5);
      const periodeLabel = `SALAIRE ${mois.padStart(2, '0')}/${annee}`;
      const reference = `VRT-${selectedCompanyName.replace(/\s+/g, '').toUpperCase()}-${annee}${mois.padStart(2, '0')}`;
      const debitRibFull = `${codeBanque}00197${feeConfig.compteSource}${feeConfig.cleRib}`;

      const importRows: ImportDataRow[] = validEntries.map(r => ({
        nom_complet: r.row.nom_complet,
        rib: r.row.rib,
        montant: r.row.montant,
        periode: r.row.periode,
        ribStatus: r.ribStatus,
        neutralizedRib: r.neutralizedRib,
        reconciled: r.reconciled,
        originalRib: r.originalRib,
        matricule: undefined,
        ribEpargne: undefined,
      }));

      const result = generateISO20022FromImportData(importRows, {
        initiatingParty: selectedCompanyName,
        debitAccount: debitRibFull,
        cleRib: feeConfig.cleRib,
        convention: feeConfig.convention,
        feeInstruction: feeConfig.feeInstruction,
        reference,
        executionDate: new Date().toISOString().split('T')[0],
        periodeLabel,
        codeBanque,
        enableSplitting: false,
        splittingRules: [],
      });

      setGeneratedFile(result);

      toast({
        title: 'Fichier XML généré',
        description: `${result.fileName} — ${result.totalTransactions} transactions — ${result.totalAmount.toLocaleString('fr-FR')} FCFA`,
      });
    } catch (err) {
      toast({
        title: 'Erreur de génération XML',
        description: err instanceof Error ? err.message : 'Erreur inconnue',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [feeConfig, validationResults, mois, annee, selectedCompanyName, toast]);

  const doImport = useCallback(async () => {
    setIsImporting(true);
    setImportProgress(0);

    try {
      const processedResults = validationResults
        .filter(r => r.neutralizedAction?.type !== 'removed')
        .map(r => {
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

      // Génération automatique du XML et passage à l'étape 8
      autoGenerateXML();
      setStep(8);
    } catch (err: unknown) {
      toast({
        title: "Erreur d'import",
        description: err instanceof Error ? err.message : 'Erreur inconnue',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  }, [mois, annee, file, isQuinzaine, selectedCompanyName, validationResults, feeType, feeConfig, autoGenerateXML, toast]);

  const validCount = validationResults.filter(r => r.errors.length === 0 && r.ribStatus !== 'neutralized').length;
  const errorCount = validationResults.filter(r => r.errors.length > 0).length;
  const mismatchCount = validationResults.filter(r => (r.ribStatus === 'mismatch' || r.ribStatus === 'divergence') && !r.reconciled).length;
  const reconciledCount = validationResults.filter(r => r.reconciled).length;
  const neutralizedCount = validationResults.filter(r => r.ribStatus === 'neutralized').length;
  const totalValidForImport = validationResults.filter(r => r.errors.length === 0 && r.neutralizedAction?.type !== 'removed').length;

  const neutralizedPendingBlock = validationResults.filter(
    r => r.ribStatus === 'neutralized' &&
      (!r.neutralizedAction || r.neutralizedAction.type === 'idle' || r.neutralizedAction.type === 'pending' || r.neutralizedAction.type === 'rejected')
  ).length;
  const neutralizedApprovedCount = validationResults.filter(r => r.ribStatus === 'neutralized' && r.neutralizedAction?.type === 'approved').length;
  const neutralizedRemovedCount = validationResults.filter(r => r.ribStatus === 'neutralized' && r.neutralizedAction?.type === 'removed').length;
  const neutralizedResolved = neutralizedApprovedCount + neutralizedRemovedCount === neutralizedCount;

  const canAdvance = () => {
    switch (step) {
      case 1: return !!selectedCompany;
      case 2: return !!feeType;
      case 3: return !!(mois && annee && duplicateCheckDone && (!duplicateExists || isQuinzaine));
      case 4: return parsedData.length > 0;
      case 5: return validationResults.length > 0 && neutralizedResolved;
      case 6: return mismatchCount === 0 && errorCount === 0;
      case 7: return true;
      case 8: return true;
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
                    <Card className="border-2 border-orange-400 bg-orange-50/40">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-orange-800 text-base">
                          <AlertCircle className="h-5 w-5" />
                          {neutralizedCount} RIB absent(s) du référentiel — Action requise
                        </CardTitle>
                        <CardDescription className="text-orange-700">
                          Ces sociétaires sont introuvables dans le référentiel. Vous devez, pour chaque ligne, soit
                          <strong> envoyer la validation à l'admin</strong> (le virement sera redirigé vers <span className="font-mono">38100000000</span>)
                          soit <strong>retirer le sociétaire</strong> de cet import.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex gap-3 text-sm">
                          <Badge variant="secondary" className="border-orange-400 text-orange-700">
                            <Clock className="h-3 w-3 mr-1" />{neutralizedCount - neutralizedApprovedCount - neutralizedRemovedCount} en attente
                          </Badge>
                          {neutralizedApprovedCount > 0 && (
                            <Badge className="bg-green-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" />{neutralizedApprovedCount} approuvé(s)</Badge>
                          )}
                          {neutralizedRemovedCount > 0 && (
                            <Badge variant="outline" className="text-muted-foreground"><Trash2 className="h-3 w-3 mr-1" />{neutralizedRemovedCount} retiré(s)</Badge>
                          )}
                        </div>

                        <div className="rounded-lg border border-orange-300 overflow-auto max-h-72">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-orange-100">
                                <TableHead>Bénéficiaire</TableHead>
                                <TableHead>RIB Original</TableHead>
                                <TableHead>RIB Technique</TableHead>
                                <TableHead className="text-right">Montant</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {validationResults.filter(r => r.ribStatus === 'neutralized').map(r => {
                                const action = r.neutralizedAction ?? { type: 'idle' };
                                return (
                                  <TableRow key={r.index} className={cn(
                                    action.type === 'approved' && 'bg-green-50',
                                    action.type === 'removed' && 'bg-muted/50 opacity-60',
                                    action.type === 'rejected' && 'bg-red-50',
                                    action.type === 'pending' && 'bg-amber-50',
                                    action.type === 'idle' && 'bg-orange-50/50',
                                  )}>
                                    <TableCell className="font-medium">{r.row.nom_complet}</TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">{r.originalRib || r.row.rib}</TableCell>
                                    <TableCell className="font-mono text-xs text-orange-600 font-semibold">{r.neutralizedRib}</TableCell>
                                    <TableCell className="text-right font-mono text-sm">{r.row.montant.toLocaleString('fr-FR')} XAF</TableCell>
                                    <TableCell className="text-right">
                                      {action.type === 'approved' && (
                                        <Badge className="bg-green-600 text-white text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Approuvé</Badge>
                                      )}
                                      {action.type === 'removed' && (
                                        <Badge variant="outline" className="text-muted-foreground text-xs"><Trash2 className="h-3 w-3 mr-1" />Retiré</Badge>
                                      )}
                                      {action.type === 'rejected' && (
                                        <div className="flex flex-col gap-1 items-end">
                                          <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Refusé</Badge>
                                          <Button size="sm" variant="outline" className="h-6 text-xs border-destructive text-destructive" onClick={() => removeNeutralizedLine(r.index)}>
                                            <Trash2 className="h-3 w-3 mr-1" />Retirer
                                          </Button>
                                        </div>
                                      )}
                                      {action.type === 'pending' && (
                                        <Badge variant="secondary" className="text-xs border-amber-400 text-amber-700">
                                          <Clock className="h-3 w-3 mr-1" />En attente admin
                                        </Badge>
                                      )}
                                      {action.type === 'idle' && (
                                        <div className="flex gap-1 justify-end">
                                          <Button
                                            size="sm"
                                            className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                            onClick={() => sendValidationRequest(r.index)}
                                          >
                                            <Send className="h-3 w-3 mr-1" />Envoyer validation
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs border-destructive text-destructive hover:bg-red-50"
                                            onClick={() => removeNeutralizedLine(r.index)}
                                          >
                                            <Trash2 className="h-3 w-3 mr-1" />Retirer
                                          </Button>
                                        </div>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>

                        {validationResults.some(r => r.ribStatus === 'neutralized' && r.neutralizedAction?.type === 'pending') && (
                          <Button variant="outline" size="sm" onClick={pollNeutralizedStatuses} disabled={isPollingValidation} className="border-amber-400 text-amber-700">
                            {isPollingValidation ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                            Actualiser le statut
                          </Button>
                        )}

                        {!neutralizedResolved && (
                          <Alert className="border-orange-300 bg-orange-50 py-2">
                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                            <AlertDescription className="text-orange-700 text-xs">
                              Vous ne pouvez pas continuer tant que chaque ligne neutralisée n'est pas approuvée par un admin ou retirée.
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
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
                        {validationResults.filter(r => r.neutralizedAction?.type !== 'removed').map(r => (
                          <TableRow key={r.index} className={cn(
                            r.ribStatus === 'valid' && 'bg-success/5',
                            r.ribStatus === 'mismatch' && !r.reconciled && 'bg-warning/10',
                            r.ribStatus === 'neutralized' && r.neutralizedAction?.type === 'approved' && 'bg-green-50',
                            r.ribStatus === 'neutralized' && (!r.neutralizedAction || r.neutralizedAction.type === 'idle') && 'bg-orange-50',
                            r.ribStatus === 'neutralized' && r.neutralizedAction?.type === 'pending' && 'bg-amber-50',
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
                                r.neutralizedAction?.type === 'approved' ? (
                                  <Badge className="bg-green-600 text-white text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Approuvé</Badge>
                                ) : r.neutralizedAction?.type === 'pending' ? (
                                  <Badge variant="secondary" className="text-xs border-amber-400 text-amber-700"><Clock className="h-3 w-3 mr-1" />En attente</Badge>
                                ) : (
                                  <Badge className="bg-orange-100 text-orange-800 border-orange-300 text-xs">
                                    <AlertCircle className="h-3 w-3 mr-1" />Action requise
                                  </Badge>
                                )
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
                    Le fichier XML ISO 20022 est généré automatiquement à l'étape suivante.
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

          {/* STEP 8: XML Generation */}
          {step === 8 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle className="flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-primary" />
                  Génération XML ISO 20022
                </CardTitle>
                <CardDescription>Fichier de Virement de Masse pour Amplitude — pain.001.001.03</CardDescription>
              </CardHeader>

              {isGenerating && (
                <div className="space-y-2">
                  <Progress value={66} />
                  <p className="text-sm text-muted-foreground text-center">Génération du fichier XML en cours...</p>
                </div>
              )}

              {generatedFile && !isGenerating && (
                <>
                  <Card className="border-primary/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-primary">
                        <CheckCircle2 className="h-5 w-5" />
                        Fichier XML généré avec succès
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Fichier</p>
                          <p className="font-mono text-sm bg-muted p-2 rounded mt-1 truncate">{generatedFile.fileName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Transactions</p>
                          <p className="font-bold text-lg mt-1">{generatedFile.totalTransactions}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Montant total</p>
                          <p className="font-bold text-lg text-primary mt-1">{generatedFile.totalAmount.toLocaleString('fr-FR')} XAF</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Clé / Convention</p>
                          <p className="font-mono text-sm mt-1">{feeConfig?.cleRib}{feeConfig?.convention ? ` / ${feeConfig.convention}` : ''}</p>
                        </div>
                      </div>

                      {generatedFile.rejections.length > 0 && (
                        <Alert className="border-warning">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          <AlertTitle>{generatedFile.rejections.length} compte(s) redirigé(s)</AlertTitle>
                          <AlertDescription>
                            RIB inconnus neutralisés vers le compte technique 38100000000
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setXmlPreviewOpen(true)}>
                          <Eye className="h-4 w-4 mr-2" /> Aperçu XML
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Download className="h-4 w-4" /> Téléchargement direct
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Button onClick={() => {
                          if (!generatedFile) return;
                          const blob = new Blob([generatedFile.content], { type: 'application/xml;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = generatedFile.fileName;
                          a.click();
                          URL.revokeObjectURL(url);
                        }} className="w-full">
                          <Download className="h-4 w-4 mr-2" /> Télécharger le XML
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FolderOpen className="h-4 w-4" /> Dépôt en staging
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Button onClick={async () => {
                          if (!generatedFile) return;
                          try {
                            const hash = btoa(generatedFile.content.substring(0, 100));
                            await supabase.from('file_staging').insert({
                              file_name: generatedFile.fileName,
                              file_type: 'xml',
                              file_format: 'pain.001.001.03',
                              file_content: generatedFile.content,
                              file_hash: hash,
                              entries_count: generatedFile.totalTransactions,
                              total_amount: generatedFile.totalAmount,
                              staging_path: 'C:\\Middleware\\.staging\\',
                              target_path: 'C:\\ODTSF\\',
                              status: 'staging',
                            });
                            toast({ title: 'Fichier en staging', description: 'Prêt pour transfert vers Amplitude' });
                          } catch (err) {
                            toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
                          }
                        }} className="w-full" variant="secondary">
                          <FolderOpen className="h-4 w-4 mr-2" /> Déposer en staging
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Structure du fichier généré</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-muted-foreground">Compte débiteur:</span> <span className="font-mono">{feeConfig?.compteSource}</span></div>
                        <div><span className="text-muted-foreground">Clé RIB:</span> <span className="font-mono">{feeConfig?.cleRib}</span></div>
                        <div><span className="text-muted-foreground">Convention:</span> <span className="font-mono">{feeConfig?.convention || '—'}</span></div>
                        <div><span className="text-muted-foreground">Devise:</span> XAF</div>
                        <div><span className="text-muted-foreground">Format:</span> pain.001.001.03</div>
                        <div><span className="text-muted-foreground">Encodage:</span> UTF-8</div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {!generatedFile && !isGenerating && importComplete && (
                <Button onClick={autoGenerateXML} size="lg" className="w-full">
                  <Zap className="h-4 w-4 mr-2" />
                  Générer le fichier XML ISO 20022
                </Button>
              )}

              {!importComplete && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Import requis</AlertTitle>
                  <AlertDescription>Veuillez d'abord compléter l'import à l'étape précédente.</AlertDescription>
                </Alert>
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
          disabled={step === 8 || !canAdvance()}
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

      {/* XML Preview Dialog */}
      <Dialog open={xmlPreviewOpen} onOpenChange={setXmlPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary" />
              Aperçu XML — {generatedFile?.fileName}
            </DialogTitle>
          </DialogHeader>
          <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[60vh] text-xs font-mono whitespace-pre-wrap">
            {generatedFile?.content}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
