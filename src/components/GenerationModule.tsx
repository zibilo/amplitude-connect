import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  FileOutput, Download, Loader2, CheckCircle2, AlertTriangle,
  Shield, Eye, FileCode, FolderOpen, Upload, Search, XCircle,
  ArrowRight, Zap, Server, FileUp, FileWarning, Ban
} from 'lucide-react';
import { executeTripleCheck, TripleCheckInput, TripleCheckResult } from '@/lib/engine/tripleCheckEngine';
import { generateISO20022XML, generateAmplitudeMVTI, generateISO20022FromFlatFile, ISO20022Config, GeneratedXMLResult } from '@/lib/engine/iso20022Generator';
import { parseFlatFile, FlatFileParseResult } from '@/lib/engine/flatFileParser';
import { cn } from '@/lib/utils';

interface ImportSession {
  id: string;
  mois: number;
  annee: number;
  entreprise: string | null;
  file_name: string;
  total_lignes: number;
  lignes_valides: number;
  montant_total: number;
  status: string;
  created_at: string;
}

interface ImportEntry {
  id: string;
  matricule: string;
  nom: string;
  prenom: string | null;
  code_caisse: string;
  cco: string;
  montant: number;
}

type GenerationStep = 'source' | 'check' | 'preview' | 'generate' | 'export';

export function GenerationModule() {
  const { toast } = useToast();

  // Source mode
  const [sourceMode, setSourceMode] = useState<'history' | 'flatfile'>('history');

  // History mode state
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ImportSession | null>(null);
  const [entries, setEntries] = useState<ImportEntry[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

  // Flat file mode state
  const [flatFileResult, setFlatFileResult] = useState<FlatFileParseResult | null>(null);
  const [flatFileName, setFlatFileName] = useState('');

  const [step, setStep] = useState<GenerationStep>('source');

  // Triple Check
  const [tripleCheckRunning, setTripleCheckRunning] = useState(false);
  const [tripleCheckProgress, setTripleCheckProgress] = useState(0);
  const [tripleCheckResults, setTripleCheckResults] = useState<TripleCheckResult[]>([]);

  // Generation
  const [format, setFormat] = useState<'iso20022' | 'mvti'>('iso20022');
  const [reference, setReference] = useState('');
  const [initiatingParty, setInitiatingParty] = useState('MUCODEC');
  const [debitAccount, setDebitAccount] = useState('');
  const [debitAccountSansFrais, setDebitAccountSansFrais] = useState('');
  const [debitBIC, setDebitBIC] = useState('MUCOCGCG');
  const [generatedFile, setGeneratedFile] = useState<GeneratedXMLResult | null>(null);
  const [generating, setGenerating] = useState(false);

  // Export
  const [exportPath, setExportPath] = useState('C:\\ODTSF\\');
  const [ftpHost, setFtpHost] = useState('');
  const [ftpPort, setFtpPort] = useState('22');
  const [ftpPath, setFtpPath] = useState('/uploads/amplitude/');
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);

  useEffect(() => {
    fetchSessions();
    const now = new Date();
    setReference(`PAY${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`);
  }, []);

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('import_sessions')
      .select('*')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });
    if (data) setSessions(data as ImportSession[]);
  };

  const selectSession = async (session: ImportSession) => {
    setSelectedSession(session);
    const { data } = await supabase
      .from('import_entries')
      .select('*')
      .eq('session_id', session.id)
      .eq('status', 'valid')
      .limit(10000);
    if (data) {
      setEntries(data as ImportEntry[]);
      setSelectedEntries(new Set(data.map((e: ImportEntry) => e.id)));
    }
  };

  const toggleEntry = (id: string) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedEntries.size === entries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(entries.map(e => e.id)));
    }
  };

  const selectedTotal = entries
    .filter(e => selectedEntries.has(e.id))
    .reduce((sum, e) => sum + e.montant, 0);

  // ─── Flat File Import ────────────────────────────────────────────────────
  const handleFlatFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const result = parseFlatFile(content);
        setFlatFileResult(result);
        setFlatFileName(file.name);

        // Auto-fill config from header
        setInitiatingParty(result.header.nomEntreprise);
        setDebitAccount(result.header.compteDebiteur);
        if (result.header.avecFrais) {
          setDebitAccountSansFrais('300050019738100000000');
        }

        toast({
          title: 'Fichier parsé',
          description: `${result.totalParsed} lignes · ${result.totalValid} valides · ${result.totalInvalid} invalides`,
        });
      } catch (err) {
        toast({ title: 'Erreur de parsing', description: String(err), variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ─── Triple Check ────────────────────────────────────────────────────────
  const runTripleCheck = useCallback(async () => {
    setTripleCheckRunning(true);
    setTripleCheckProgress(0);
    setTripleCheckResults([]);

    try {
      let inputs: TripleCheckInput[];

      if (sourceMode === 'flatfile' && flatFileResult) {
        inputs = flatFileResult.validDetails.map(d => ({
          matricule: '',
          nom: d.nomComplet,
          montant_total: d.montant,
          rib: d.rib,
        }));
      } else {
        const selected = entries.filter(e => selectedEntries.has(e.id));
        inputs = selected.map(e => ({
          matricule: e.matricule,
          nom: `${e.nom} ${e.prenom || ''}`.trim(),
          montant_total: e.montant,
          rib: e.cco,
        }));
      }

      const batchSize = 50;
      const allResults: TripleCheckResult[] = [];

      for (let i = 0; i < inputs.length; i += batchSize) {
        const batch = inputs.slice(i, i + batchSize);
        const results = await executeTripleCheck(batch);
        allResults.push(...results);
        setTripleCheckProgress(Math.round(((i + batch.length) / inputs.length) * 100));
      }

      setTripleCheckResults(allResults);
      setTripleCheckProgress(100);

      const errors = allResults.filter(r => r.errors.length > 0).length;
      const ok = allResults.filter(r => r.balance_ok && r.errors.length === 0).length;

      toast({
        title: 'Triple Check terminé',
        description: `${ok} OK · ${errors} erreurs`,
      });

      setStep('preview');
    } catch (err) {
      toast({ title: 'Erreur Triple Check', description: String(err), variant: 'destructive' });
    } finally {
      setTripleCheckRunning(false);
    }
  }, [entries, selectedEntries, sourceMode, flatFileResult, toast]);

  // ─── Generate XML ────────────────────────────────────────────────────────
  const generateXML = useCallback(async () => {
    setGenerating(true);
    try {
      const config: ISO20022Config = {
        initiatingParty,
        debitAccount,
        debitAccountSansFrais: debitAccountSansFrais || undefined,
        debitBIC,
        reference,
        executionDate: new Date().toISOString().split('T')[0],
        batchBooking: true,
      };

      let result: GeneratedXMLResult;

      if (sourceMode === 'flatfile' && flatFileResult) {
        // Direct generation from flat file (with dual PmtInf)
        result = generateISO20022FromFlatFile(flatFileResult, config);
      } else if (format === 'iso20022') {
        const validResults = tripleCheckResults.filter(r => r.balance_ok && r.errors.length === 0);
        result = generateISO20022XML(validResults, config);
      } else {
        const validResults = tripleCheckResults.filter(r => r.balance_ok && r.errors.length === 0);
        result = generateAmplitudeMVTI(validResults, config);
      }

      setGeneratedFile(result);
      setStep('export');

      await supabase.from('audit_logs').insert({
        action: 'generate',
        description: `Fichier ISO 20022 généré: ${result.fileName}`,
        details: {
          format: sourceMode === 'flatfile' ? 'flatfile-iso20022' : format,
          fileName: result.fileName,
          transactions: result.totalTransactions,
          totalAmount: result.totalAmount,
          rejections: result.rejections.length,
          nbPmtInf: result.nbPmtInf,
        },
      });

      toast({ title: 'Fichier généré', description: `${result.fileName} — ${result.totalTransactions} transactions` });
    } catch (err) {
      toast({ title: 'Erreur de génération', description: String(err), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }, [tripleCheckResults, format, initiatingParty, debitAccount, debitAccountSansFrais, debitBIC, reference, sourceMode, flatFileResult, toast]);

  const downloadFile = () => {
    if (!generatedFile) return;
    const blob = new Blob([generatedFile.content], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generatedFile.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveToStaging = async () => {
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
        target_path: exportPath,
        status: 'staging',
      });
      toast({ title: 'Fichier en zone tampon', description: `Prêt pour transfert vers ${exportPath}` });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    }
  };

  const formatAmountXAF = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(amount);

  const validResults = tripleCheckResults.filter(r => r.balance_ok && r.errors.length === 0);
  const errorResults = tripleCheckResults.filter(r => r.errors.length > 0);
  const warningResults = tripleCheckResults.filter(r => r.warnings.length > 0 && r.errors.length === 0);

  const canProceedFromSource = sourceMode === 'flatfile'
    ? !!flatFileResult
    : selectedEntries.size > 0;

  const stepLabels: { id: GenerationStep; label: string; icon: any }[] = [
    { id: 'source', label: '1. Source', icon: Search },
    { id: 'check', label: '2. Triple Check', icon: Shield },
    { id: 'preview', label: '3. Aperçu', icon: Eye },
    { id: 'generate', label: '4. Génération', icon: FileCode },
    { id: 'export', label: '5. Export', icon: Upload },
  ];

  const stepOrder = stepLabels.map(s => s.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Génération XML ISO 20022</h1>
        <p className="text-muted-foreground mt-1">
          Importez un fichier plat ou sélectionnez depuis l'historique, puis générez le XML pain.001.001.03
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 flex-wrap">
        {stepLabels.map((s, i, arr) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg transition-all cursor-pointer",
              step === s.id && "bg-primary text-primary-foreground",
              stepOrder.indexOf(step) > stepOrder.indexOf(s.id) && "bg-primary/10 text-primary",
              step !== s.id && stepOrder.indexOf(step) <= stepOrder.indexOf(s.id) && "text-muted-foreground"
            )}>
              <s.icon className="h-4 w-4" />
              <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
            </div>
            {i < arr.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* ══════════════ STEP 1: SOURCE ══════════════ */}
      {step === 'source' && (
        <div className="space-y-4">
          <Tabs value={sourceMode} onValueChange={(v) => setSourceMode(v as 'history' | 'flatfile')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="flatfile" className="gap-2">
                <FileUp className="h-4 w-4" /> Import fichier plat
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <Search className="h-4 w-4" /> Depuis l'historique
              </TabsTrigger>
            </TabsList>

            {/* ── Flat File Tab ── */}
            <TabsContent value="flatfile" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileUp className="h-5 w-5 text-primary" />
                    Importer le fichier source MUCODEC
                  </CardTitle>
                  <CardDescription>
                    Fichier plat avec entête (type 1) et lignes de détail (type 2)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="border-2 border-dashed rounded-xl p-8 text-center transition-all hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                    onClick={() => document.getElementById('flat-file-input')?.click()}
                  >
                    <FileUp className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium">Cliquez pour sélectionner le fichier plat</p>
                    <p className="text-sm text-muted-foreground mt-1">.txt, .dat, .csv — Encodage texte</p>
                    <input
                      id="flat-file-input"
                      type="file"
                      accept=".txt,.dat,.csv,.TXT,.DAT,.CSV"
                      className="hidden"
                      onChange={handleFlatFileImport}
                    />
                  </div>

                  {flatFileResult && (
                    <div className="space-y-4">
                      {/* Header Info */}
                      <Alert className={flatFileResult.coherenceOk ? 'border-primary/30' : 'border-destructive/30'}>
                        {flatFileResult.coherenceOk ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        <AlertTitle>{flatFileName}</AlertTitle>
                        <AlertDescription>{flatFileResult.coherenceMessage}</AlertDescription>
                      </Alert>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card>
                          <CardContent className="pt-4 text-center">
                            <p className="text-2xl font-bold">{flatFileResult.header.nomEntreprise}</p>
                            <p className="text-xs text-muted-foreground">Entreprise</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4 text-center">
                            <p className="text-2xl font-bold">{flatFileResult.totalParsed}</p>
                            <p className="text-xs text-muted-foreground">Salariés</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4 text-center">
                            <p className="text-2xl font-bold font-mono text-primary">{formatAmountXAF(flatFileResult.montantTotalDetails)}</p>
                            <p className="text-xs text-muted-foreground">Montant total</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4 text-center">
                            <Badge variant={flatFileResult.header.avecFrais ? 'default' : 'secondary'}>
                              {flatFileResult.header.avecFrais ? 'AVEC frais' : 'SANS frais'}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">Type de paiement</p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Stats badges */}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="h-3 w-3 text-primary" /> {flatFileResult.totalValid} valides
                        </Badge>
                        {flatFileResult.totalInvalid > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" /> {flatFileResult.totalInvalid} invalides
                          </Badge>
                        )}
                        {flatFileResult.totalRedirected > 0 && (
                          <Badge className="bg-warning text-warning-foreground gap-1">
                            <AlertTriangle className="h-3 w-3" /> {flatFileResult.totalRedirected} redirigés → 38100000000
                          </Badge>
                        )}
                        <Badge variant="outline" className="font-mono text-xs gap-1">
                          Caisse: {flatFileResult.header.codeCaisse}
                        </Badge>
                        <Badge variant="outline" className="font-mono text-xs gap-1">
                          Période: {flatFileResult.header.periode}
                        </Badge>
                      </div>

                      {/* Rejection log */}
                      {flatFileResult.rejectionLog.length > 0 && (
                        <Card className="border-destructive/30">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                              <Ban className="h-4 w-4" /> Journal des rejets ({flatFileResult.rejectionLog.length})
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ScrollArea className="max-h-40">
                              <div className="space-y-1">
                                {flatFileResult.rejectionLog.map((rej, i) => (
                                  <div key={i} className="flex items-center justify-between text-xs p-2 bg-destructive/5 rounded">
                                    <span className="font-medium">{rej.nomComplet}</span>
                                    <span className="text-muted-foreground">{rej.reason}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {rej.action === 'REDIRECTED' ? `→ ${rej.redirectedTo}` : 'REJETÉ'}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      )}

                      {/* Detail preview */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Aperçu des lignes de détail</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <ScrollArea className="max-h-[300px]">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>#</TableHead>
                                  <TableHead>Nom</TableHead>
                                  <TableHead>RIB / Compte</TableHead>
                                  <TableHead className="text-right">Montant</TableHead>
                                  <TableHead>Libellé</TableHead>
                                  <TableHead>Statut</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {flatFileResult.details.map((d, i) => (
                                  <TableRow key={i} className={cn(!d.isValid && "bg-destructive/5")}>
                                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                                    <TableCell className="text-sm font-medium">{d.nomComplet}</TableCell>
                                    <TableCell className="font-mono text-xs">
                                      {d.redirected ? (
                                        <span className="text-warning">{d.rib} <span className="text-muted-foreground">(redirigé)</span></span>
                                      ) : d.rib}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">{d.montant.toLocaleString('fr-FR')}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{d.libelle}</TableCell>
                                    <TableCell>
                                      {d.isValid ? (
                                        <Badge className="bg-primary/10 text-primary text-xs">OK</Badge>
                                      ) : (
                                        <Badge variant="destructive" className="text-xs">{d.invalidReason}</Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── History Tab ── */}
            <TabsContent value="history">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-lg">Sessions d'import</CardTitle>
                    <CardDescription>Choisissez une session de paie</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-96 overflow-auto">
                    {sessions.map(s => (
                      <div
                        key={s.id}
                        onClick={() => selectSession(s)}
                        className={cn(
                          "p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50",
                          selectedSession?.id === s.id && "border-primary bg-primary/5"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">{String(s.mois).padStart(2, '0')}/{s.annee}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">{s.file_name}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">{s.lignes_valides} lignes</Badge>
                        </div>
                        <p className="text-xs font-mono mt-1 text-primary">{formatAmountXAF(s.montant_total)}</p>
                      </div>
                    ))}
                    {sessions.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Aucune session disponible</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>Salaires à générer</span>
                      {entries.length > 0 && (
                        <div className="flex items-center gap-3">
                          <Badge>{selectedEntries.size}/{entries.length}</Badge>
                          <Badge variant="outline" className="font-mono">{formatAmountXAF(selectedTotal)}</Badge>
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!selectedSession ? (
                      <p className="text-muted-foreground text-center py-8">← Sélectionnez une session</p>
                    ) : entries.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">Aucune entrée valide</p>
                    ) : (
                      <ScrollArea className="max-h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">
                                <Checkbox
                                  checked={selectedEntries.size === entries.length}
                                  onCheckedChange={toggleAll}
                                />
                              </TableHead>
                              <TableHead>Matricule</TableHead>
                              <TableHead>Nom</TableHead>
                              <TableHead>Caisse</TableHead>
                              <TableHead>CCO</TableHead>
                              <TableHead className="text-right">Montant</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entries.map(e => (
                              <TableRow key={e.id} className={cn(!selectedEntries.has(e.id) && "opacity-40")}>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedEntries.has(e.id)}
                                    onCheckedChange={() => toggleEntry(e.id)}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-sm">{e.matricule}</TableCell>
                                <TableCell className="text-sm">{e.nom} {e.prenom}</TableCell>
                                <TableCell className="text-sm">{e.code_caisse}</TableCell>
                                <TableCell className="font-mono text-sm">{e.cco}</TableCell>
                                <TableCell className="text-right font-mono text-sm">{e.montant.toLocaleString('fr-FR')}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
            <Button onClick={() => setStep('check')} disabled={!canProceedFromSource}>
              <Shield className="h-4 w-4 mr-2" />
              {sourceMode === 'flatfile' ? 'Vérifier & Générer' : 'Lancer le Triple Check'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════ STEP 2: TRIPLE CHECK ══════════════ */}
      {step === 'check' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Triple Check — Vérification croisée
            </CardTitle>
            <CardDescription>
              CLM · Saisies Arrêts · Ventilation Épargne · Balance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold">
                    {sourceMode === 'flatfile' ? flatFileResult?.totalValid || 0 : selectedEntries.size}
                  </p>
                  <p className="text-xs text-muted-foreground">Employés</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold font-mono">
                    {formatAmountXAF(sourceMode === 'flatfile' ? flatFileResult?.montantTotalDetails || 0 : selectedTotal)}
                  </p>
                  <p className="text-xs text-muted-foreground">Montant total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-primary">3</p>
                  <p className="text-xs text-muted-foreground">Sources vérifiées</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold">{tripleCheckResults.length > 0 ? `${validResults.length}/${tripleCheckResults.length}` : '—'}</p>
                  <p className="text-xs text-muted-foreground">Valides</p>
                </CardContent>
              </Card>
            </div>

            {tripleCheckRunning && (
              <div className="space-y-2">
                <Progress value={tripleCheckProgress} />
                <p className="text-sm text-muted-foreground text-center">
                  Vérification en cours... {tripleCheckProgress}%
                </p>
              </div>
            )}

            {tripleCheckResults.length === 0 && !tripleCheckRunning && (
              <div className="text-center py-6 space-y-4">
                <p className="text-muted-foreground">
                  Le Triple Check vérifie chaque salaire contre le référentiel CLM,
                  les saisies arrêts et les règles de ventilation épargne.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={runTripleCheck} size="lg">
                    <Zap className="h-4 w-4 mr-2" />
                    Lancer la vérification
                  </Button>
                  {sourceMode === 'flatfile' && (
                    <Button onClick={() => setStep('generate')} size="lg" variant="outline">
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Passer directement à la génération
                    </Button>
                  )}
                </div>
              </div>
            )}

            {tripleCheckResults.length > 0 && !tripleCheckRunning && (
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('source')}>← Retour</Button>
                <Button onClick={() => setStep('preview')}>
                  Voir l'aperçu <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ══════════════ STEP 3: PREVIEW ══════════════ */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4 text-center">
                <CheckCircle2 className="h-6 w-6 text-primary mx-auto mb-1" />
                <p className="text-2xl font-bold text-primary">{validResults.length}</p>
                <p className="text-xs text-muted-foreground">Valides</p>
              </CardContent>
            </Card>
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="pt-4 text-center">
                <AlertTriangle className="h-6 w-6 text-warning mx-auto mb-1" />
                <p className="text-2xl font-bold text-warning">{warningResults.length}</p>
                <p className="text-xs text-muted-foreground">Avertissements</p>
              </CardContent>
            </Card>
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="pt-4 text-center">
                <XCircle className="h-6 w-6 text-destructive mx-auto mb-1" />
                <p className="text-2xl font-bold text-destructive">{errorResults.length}</p>
                <p className="text-xs text-muted-foreground">Erreurs</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matricule</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Courant</TableHead>
                      <TableHead className="text-right">Épargne</TableHead>
                      <TableHead className="text-right">Saisies</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tripleCheckResults.map((r, i) => (
                      <TableRow key={i} className={cn(
                        r.errors.length > 0 && "bg-destructive/5",
                        r.warnings.length > 0 && r.errors.length === 0 && "bg-warning/5"
                      )}>
                        <TableCell className="font-mono text-sm">{r.matricule || '—'}</TableCell>
                        <TableCell className="text-sm">{r.nom}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{r.montant_total.toLocaleString('fr-FR')}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{r.montant_net_courant.toLocaleString('fr-FR')}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-primary">
                          {r.total_epargne > 0 ? r.total_epargne.toLocaleString('fr-FR') : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-destructive">
                          {r.total_saisies > 0 ? r.total_saisies.toLocaleString('fr-FR') : '—'}
                        </TableCell>
                        <TableCell>
                          {r.errors.length > 0 ? (
                            <Badge variant="destructive" className="text-xs">{r.errors[0].substring(0, 25)}…</Badge>
                          ) : r.warnings.length > 0 ? (
                            <Badge className="bg-warning text-warning-foreground text-xs">⚠</Badge>
                          ) : (
                            <Badge className="bg-primary/10 text-primary text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('check')}>← Retour</Button>
            <Button onClick={() => setStep('generate')} disabled={validResults.length === 0}>
              <FileCode className="h-4 w-4 mr-2" />
              Configurer la génération ({validResults.length} valides)
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════ STEP 4: GENERATE CONFIG ══════════════ */}
      {step === 'generate' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary" />
              Configuration ISO 20022
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Format selection (only for history mode) */}
              {sourceMode === 'history' && (
                <div className="space-y-3">
                  <Label>Format de sortie</Label>
                  <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'iso20022' | 'mvti')}>
                    <div className={cn("flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-all",
                      format === 'iso20022' ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    )}>
                      <RadioGroupItem value="iso20022" id="iso20022" />
                      <Label htmlFor="iso20022" className="cursor-pointer flex-1">
                        <span className="font-medium">ISO 20022 (pain.001)</span>
                        <p className="text-xs text-muted-foreground">Standard international</p>
                      </Label>
                    </div>
                    <div className={cn("flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-all",
                      format === 'mvti' ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    )}>
                      <RadioGroupItem value="mvti" id="mvti" />
                      <Label htmlFor="mvti" className="cursor-pointer flex-1">
                        <span className="font-medium">MVTI_008 Amplitude</span>
                        <p className="text-xs text-muted-foreground">Format Sopra Banking</p>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Parameters */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Référence du lot</Label>
                  <Input value={reference} onChange={e => setReference(e.target.value.toUpperCase())} className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Partie initiatrice (entreprise)</Label>
                  <Input value={initiatingParty} onChange={e => setInitiatingParty(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Compte débiteur {sourceMode === 'flatfile' && flatFileResult?.header.avecFrais ? '(AVEC frais)' : ''}</Label>
                  <Input value={debitAccount} onChange={e => setDebitAccount(e.target.value)} className="font-mono" placeholder="300050019738100300000" />
                </div>
                {sourceMode === 'flatfile' && (
                  <div className="space-y-2">
                    <Label>Compte débiteur (SANS frais)</Label>
                    <Input value={debitAccountSansFrais} onChange={e => setDebitAccountSansFrais(e.target.value)} className="font-mono" placeholder="300050019738100000000" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Code BIC</Label>
                  <Input value={debitBIC} onChange={e => setDebitBIC(e.target.value)} className="font-mono" />
                </div>
              </div>
            </div>

            {/* Summary */}
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Résumé de la génération</AlertTitle>
              <AlertDescription className="space-y-1">
                {sourceMode === 'flatfile' && flatFileResult ? (
                  <>
                    <p>{flatFileResult.totalValid} transactions · {formatAmountXAF(flatFileResult.montantTotalDetails)}</p>
                    <p className="text-xs">Format: ISO 20022 pain.001.001.03 · {flatFileResult.header.avecFrais ? '1 bloc AVEC frais' : '1 bloc SANS frais'}</p>
                    {flatFileResult.totalRedirected > 0 && (
                      <p className="text-xs text-warning">{flatFileResult.totalRedirected} comptes redirigés vers compte technique 38100000000</p>
                    )}
                  </>
                ) : (
                  <p>{validResults.length} transactions · {formatAmountXAF(validResults.reduce((s, r) => s + r.montant_total, 0))} · Format {format === 'iso20022' ? 'ISO 20022' : 'MVTI_008'}</p>
                )}
              </AlertDescription>
            </Alert>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(sourceMode === 'flatfile' && tripleCheckResults.length === 0 ? 'check' : 'preview')}>← Retour</Button>
              <Button onClick={generateXML} disabled={generating} size="lg">
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                Générer le fichier XML
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════════ STEP 5: EXPORT ══════════════ */}
      {step === 'export' && generatedFile && (
        <div className="space-y-4">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="h-5 w-5" />
                Fichier XML ISO 20022 généré avec succès
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                  <p className="font-bold text-lg text-primary mt-1">{formatAmountXAF(generatedFile.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Blocs PmtInf</p>
                  <p className="font-bold text-lg mt-1">{generatedFile.nbPmtInf}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rejets</p>
                  <p className="font-bold text-lg mt-1">
                    {generatedFile.rejections.length > 0 ? (
                      <span className="text-destructive cursor-pointer" onClick={() => setRejectionDialogOpen(true)}>
                        {generatedFile.rejections.length} ⚠
                      </span>
                    ) : (
                      <span className="text-primary">0</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreviewDialogOpen(true)}>
                  <Eye className="h-4 w-4 mr-2" /> Aperçu XML
                </Button>
                {generatedFile.rejections.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setRejectionDialogOpen(true)} className="text-destructive">
                    <FileWarning className="h-4 w-4 mr-2" /> Journal des rejets
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Export Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Download className="h-4 w-4" /> Téléchargement direct
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={downloadFile} className="w-full">
                  <Download className="h-4 w-4 mr-2" /> Télécharger le XML
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" /> Dépôt sécurisé (Staging → Amplitude)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Répertoire cible</Label>
                  <Input value={exportPath} onChange={e => setExportPath(e.target.value)} className="font-mono text-xs" />
                </div>
                <Button onClick={saveToStaging} className="w-full" variant="secondary">
                  <FolderOpen className="h-4 w-4 mr-2" /> Déposer en staging
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Server className="h-4 w-4" /> WinSCP / FileZilla
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Hôte SFTP</Label>
                  <Input value={ftpHost} onChange={e => setFtpHost(e.target.value)} placeholder="192.168.1.100" className="font-mono text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Port</Label>
                    <Input value={ftpPort} onChange={e => setFtpPort(e.target.value)} className="font-mono text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Chemin</Label>
                    <Input value={ftpPath} onChange={e => setFtpPath(e.target.value)} className="font-mono text-xs" />
                  </div>
                </div>
                <Button className="w-full" variant="outline" onClick={() => {
                  const cmd = `winscp.com /command "open sftp://${ftpHost}:${ftpPort}" "put ${generatedFile.fileName} ${ftpPath}" "exit"`;
                  navigator.clipboard.writeText(cmd);
                  toast({ title: 'Commande copiée', description: 'Collez dans WinSCP ou un terminal' });
                }}>
                  <Server className="h-4 w-4 mr-2" /> Copier commande WinSCP
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('generate')}>← Retour</Button>
            <Button variant="outline" onClick={() => {
              setStep('source');
              setGeneratedFile(null);
              setTripleCheckResults([]);
              setFlatFileResult(null);
            }}>
              Nouvelle génération
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════ DIALOGS ══════════════ */}

      {/* XML Preview */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Aperçu XML — {generatedFile?.fileName}</DialogTitle>
          </DialogHeader>
          <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[60vh] text-xs font-mono whitespace-pre-wrap">
            {generatedFile?.content}
          </pre>
        </DialogContent>
      </Dialog>

      {/* Rejection Log */}
      <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <FileWarning className="h-5 w-5" />
              Journal des rejets ({generatedFile?.rejections.length || 0})
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>RIB original</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Raison</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generatedFile?.rejections.map((rej, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium">{rej.nom}</TableCell>
                    <TableCell className="font-mono text-xs">{rej.ribOriginal}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{rej.montant.toLocaleString('fr-FR')}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{rej.reason}</TableCell>
                    <TableCell>
                      {rej.action === 'REDIRECTED' ? (
                        <Badge className="bg-warning text-warning-foreground text-xs">→ {rej.redirectedTo}</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Exclu</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
