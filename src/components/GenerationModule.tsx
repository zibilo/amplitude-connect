import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  FileOutput, Download, Loader2, CheckCircle2, AlertTriangle,
  Shield, Eye, FileCode, FolderOpen, Upload, Search, XCircle,
  ArrowRight, Zap, Server
} from 'lucide-react';
import { executeTripleCheck, TripleCheckInput, TripleCheckResult } from '@/lib/engine/tripleCheckEngine';
import { generateISO20022XML, generateAmplitudeMVTI, ISO20022Config, GeneratedXMLResult } from '@/lib/engine/iso20022Generator';
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

type GenerationStep = 'select' | 'check' | 'preview' | 'generate' | 'export';

export function GenerationModule() {
  const { toast } = useToast();
  
  // State
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ImportSession | null>(null);
  const [entries, setEntries] = useState<ImportEntry[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<GenerationStep>('select');
  
  // Triple Check
  const [tripleCheckRunning, setTripleCheckRunning] = useState(false);
  const [tripleCheckProgress, setTripleCheckProgress] = useState(0);
  const [tripleCheckResults, setTripleCheckResults] = useState<TripleCheckResult[]>([]);
  
  // Generation
  const [format, setFormat] = useState<'iso20022' | 'mvti'>('iso20022');
  const [reference, setReference] = useState('');
  const [initiatingParty, setInitiatingParty] = useState('MUCODEC');
  const [debitAccount, setDebitAccount] = useState('');
  const [debitBIC, setDebitBIC] = useState('MUCOCGCG');
  const [generatedFile, setGeneratedFile] = useState<GeneratedXMLResult | null>(null);
  const [generating, setGenerating] = useState(false);
  
  // Export
  const [exportPath, setExportPath] = useState('C:\\ODTSF\\');
  const [ftpHost, setFtpHost] = useState('');
  const [ftpPort, setFtpPort] = useState('22');
  const [ftpPath, setFtpPath] = useState('/uploads/amplitude/');
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

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

  // Run Triple Check
  const runTripleCheck = useCallback(async () => {
    setTripleCheckRunning(true);
    setTripleCheckProgress(0);
    setTripleCheckResults([]);

    try {
      const selected = entries.filter(e => selectedEntries.has(e.id));
      const inputs: TripleCheckInput[] = selected.map(e => ({
        matricule: e.matricule,
        nom: `${e.nom} ${e.prenom || ''}`.trim(),
        montant_total: e.montant,
        rib: e.cco, // CCO serves as the RIB/account identifier
      }));

      // Process in batches for progress
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
      const warnings = allResults.filter(r => r.warnings.length > 0).length;
      const ok = allResults.filter(r => r.balance_ok && r.errors.length === 0).length;

      toast({
        title: 'Triple Check terminé',
        description: `${ok} OK · ${warnings} avertissements · ${errors} erreurs`,
      });

      setStep('preview');
    } catch (err) {
      toast({ title: 'Erreur Triple Check', description: String(err), variant: 'destructive' });
    } finally {
      setTripleCheckRunning(false);
    }
  }, [entries, selectedEntries, toast]);

  // Generate XML
  const generateXML = useCallback(async () => {
    setGenerating(true);
    try {
      const validResults = tripleCheckResults.filter(r => r.balance_ok && r.errors.length === 0);
      
      const config: ISO20022Config = {
        initiatingParty,
        debitAccount,
        debitBIC,
        reference,
        executionDate: new Date().toISOString().split('T')[0],
        batchBooking: true,
      };

      let result: GeneratedXMLResult;
      if (format === 'iso20022') {
        result = generateISO20022XML(validResults, config);
      } else {
        result = generateAmplitudeMVTI(validResults, config);
      }

      setGeneratedFile(result);
      setStep('export');

      // Log to audit
      await supabase.from('audit_logs').insert({
        action: 'generate',
        description: `Fichier ${format === 'iso20022' ? 'ISO 20022' : 'MVTI'} généré: ${result.fileName}`,
        details: {
          format,
          fileName: result.fileName,
          transactions: result.totalTransactions,
          totalAmount: result.totalAmount,
          sessionId: selectedSession?.id,
        },
      });

      toast({ title: 'Fichier généré', description: `${result.fileName} — ${result.totalTransactions} transactions` });
    } catch (err) {
      toast({ title: 'Erreur de génération', description: String(err), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }, [tripleCheckResults, format, initiatingParty, debitAccount, debitBIC, reference, selectedSession, toast]);

  // Download file
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

  // Save to staging (simulated)
  const saveToStaging = async () => {
    if (!generatedFile || !selectedSession) return;
    try {
      // Save file content to file_staging table
      const hash = btoa(generatedFile.content.substring(0, 100));
      await supabase.from('file_staging').insert({
        import_id: selectedSession.id,
        file_name: generatedFile.fileName,
        file_type: 'xml',
        file_format: format === 'iso20022' ? 'pain.001.001.03' : 'MVTI_008',
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

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(amount);

  const validResults = tripleCheckResults.filter(r => r.balance_ok && r.errors.length === 0);
  const errorResults = tripleCheckResults.filter(r => r.errors.length > 0);
  const warningResults = tripleCheckResults.filter(r => r.warnings.length > 0 && r.errors.length === 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Génération XML Amplitude</h1>
        <p className="text-muted-foreground mt-1">
          Sélectionnez les salaires, vérifiez avec le Triple Check, puis générez le fichier ISO 20022
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { id: 'select', label: '1. Sélection', icon: Search },
          { id: 'check', label: '2. Triple Check', icon: Shield },
          { id: 'preview', label: '3. Aperçu', icon: Eye },
          { id: 'generate', label: '4. Génération', icon: FileCode },
          { id: 'export', label: '5. Export', icon: Upload },
        ].map((s, i, arr) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg transition-all cursor-pointer",
              step === s.id && "bg-primary text-primary-foreground",
              (['select','check','preview','generate','export'].indexOf(step) > ['select','check','preview','generate','export'].indexOf(s.id)) && "bg-primary/10 text-primary",
              step !== s.id && ['select','check','preview','generate','export'].indexOf(step) <= ['select','check','preview','generate','export'].indexOf(s.id) && "text-muted-foreground"
            )}>
              <s.icon className="h-4 w-4" />
              <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
            </div>
            {i < arr.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* STEP 1: Select Session & Entries */}
      {step === 'select' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Session List */}
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
                  <p className="text-xs font-mono mt-1 text-primary">{formatAmount(s.montant_total)}</p>
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune session disponible</p>
              )}
            </CardContent>
          </Card>

          {/* Entry Selection */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Salaires à générer</span>
                {entries.length > 0 && (
                  <div className="flex items-center gap-3">
                    <Badge>{selectedEntries.size}/{entries.length} sélectionnés</Badge>
                    <Badge variant="outline" className="font-mono">{formatAmount(selectedTotal)}</Badge>
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
                <>
                  <div className="rounded-lg border overflow-auto max-h-[400px]">
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
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button onClick={() => setStep('check')} disabled={selectedEntries.size === 0}>
                      <Shield className="h-4 w-4 mr-2" />
                      Lancer le Triple Check
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 2: Triple Check */}
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
                  <p className="text-2xl font-bold">{selectedEntries.size}</p>
                  <p className="text-xs text-muted-foreground">Employés</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold font-mono">{formatAmount(selectedTotal)}</p>
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
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">
                  Le Triple Check vérifie chaque salaire contre le référentiel CLM, 
                  les saisies arrêts et les règles de ventilation épargne.
                </p>
                <Button onClick={runTripleCheck} size="lg">
                  <Zap className="h-4 w-4 mr-2" />
                  Lancer la vérification
                </Button>
              </div>
            )}

            {tripleCheckResults.length > 0 && !tripleCheckRunning && (
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('select')}>
                  ← Retour
                </Button>
                <Button onClick={() => setStep('preview')}>
                  Voir l'aperçu <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Preview Results */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-success/30 bg-success/5">
              <CardContent className="pt-4 text-center">
                <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-1" />
                <p className="text-2xl font-bold text-success">{validResults.length}</p>
                <p className="text-xs text-muted-foreground">Valides (Balance OK)</p>
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

          {/* Detail Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matricule</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Courant</TableHead>
                      <TableHead className="text-right">Épargne</TableHead>
                      <TableHead className="text-right">Saisies</TableHead>
                      <TableHead>Lignes</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tripleCheckResults.map((r, i) => (
                      <TableRow key={i} className={cn(
                        r.errors.length > 0 && "bg-destructive/5",
                        r.warnings.length > 0 && r.errors.length === 0 && "bg-warning/5"
                      )}>
                        <TableCell className="font-mono text-sm">{r.matricule}</TableCell>
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
                          <Badge variant="outline" className="text-xs">{r.lines.length}</Badge>
                        </TableCell>
                        <TableCell>
                          {r.errors.length > 0 ? (
                            <Badge variant="destructive" className="text-xs">{r.errors[0].substring(0, 30)}</Badge>
                          ) : r.warnings.length > 0 ? (
                            <Badge className="bg-warning text-warning-foreground text-xs">{r.warnings[0].substring(0, 30)}</Badge>
                          ) : (
                            <Badge className="bg-success text-success-foreground text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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

      {/* STEP 4: Generate Config */}
      {step === 'generate' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary" />
              Configuration de la génération
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Format */}
              <div className="space-y-3">
                <Label>Format de sortie</Label>
                <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'iso20022' | 'mvti')}>
                  <div className={cn("flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-all",
                    format === 'iso20022' ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  )}>
                    <RadioGroupItem value="iso20022" id="iso20022" />
                    <Label htmlFor="iso20022" className="cursor-pointer flex-1">
                      <span className="font-medium">ISO 20022 (pain.001)</span>
                      <p className="text-xs text-muted-foreground">Standard international — CustomerCreditTransferInitiation</p>
                    </Label>
                  </div>
                  <div className={cn("flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-all",
                    format === 'mvti' ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  )}>
                    <RadioGroupItem value="mvti" id="mvti" />
                    <Label htmlFor="mvti" className="cursor-pointer flex-1">
                      <span className="font-medium">MVTI_008 Amplitude</span>
                      <p className="text-xs text-muted-foreground">Format propriétaire Sopra Banking — RequestRow</p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Parameters */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Référence du lot</Label>
                  <Input value={reference} onChange={e => setReference(e.target.value.toUpperCase())} className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Partie initiatrice</Label>
                  <Input value={initiatingParty} onChange={e => setInitiatingParty(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Compte de débit</Label>
                  <Input value={debitAccount} onChange={e => setDebitAccount(e.target.value)} className="font-mono" placeholder="Numéro de compte" />
                </div>
                <div className="space-y-2">
                  <Label>Code BIC</Label>
                  <Input value={debitBIC} onChange={e => setDebitBIC(e.target.value)} className="font-mono" />
                </div>
              </div>
            </div>

            {/* Summary */}
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Résumé</AlertTitle>
              <AlertDescription>
                {validResults.length} transactions · {formatAmount(validResults.reduce((s, r) => s + r.montant_total, 0))} · Format {format === 'iso20022' ? 'ISO 20022' : 'MVTI_008'}
              </AlertDescription>
            </Alert>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('preview')}>← Retour</Button>
              <Button onClick={generateXML} disabled={generating} size="lg">
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                Générer le fichier XML
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 5: Export */}
      {step === 'export' && generatedFile && (
        <div className="space-y-4">
          <Card className="border-success/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                Fichier généré avec succès
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
                  <p className="font-bold text-lg text-primary mt-1">{formatAmount(generatedFile.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Généré le</p>
                  <p className="text-sm mt-1">{generatedFile.generatedAt.toLocaleString('fr-FR')}</p>
                </div>
              </div>

              {/* Preview XML button */}
              <Button variant="outline" size="sm" onClick={() => setPreviewDialogOpen(true)}>
                <Eye className="h-4 w-4 mr-2" /> Aperçu XML
              </Button>
            </CardContent>
          </Card>

          {/* Export Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Download */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Download className="h-4 w-4" /> Téléchargement direct
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={downloadFile} className="w-full">
                  <Download className="h-4 w-4 mr-2" /> Télécharger
                </Button>
              </CardContent>
            </Card>

            {/* Staging */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" /> Dépôt sécurisé (Staging)
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

            {/* FTP/SFTP */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Server className="h-4 w-4" /> WinSCP / FileZilla (SFTP)
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
                  // Generate a WinSCP/FileZilla compatible command
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
              setStep('select');
              setGeneratedFile(null);
              setTripleCheckResults([]);
            }}>
              Nouvelle génération
            </Button>
          </div>
        </div>
      )}

      {/* XML Preview Dialog */}
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
    </div>
  );
}
