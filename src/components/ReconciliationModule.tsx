import { useState, useCallback, useMemo } from 'react';
import { 
  FileCheck2, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileDown,
  FileSpreadsheet,
  RefreshCw,
  AlertOctagon,
  Copy,
  ArrowRightLeft,
  Download,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PayrollEntry } from '@/types/payroll';
import { logAuditEvent } from '@/utils/auditLog';
import { formatRIB } from '@/utils/ribValidation';
import { useToast } from '@/hooks/use-toast';
import {
  reconcile,
  type ReconciliationSummary,
  type ReconciliationResult,
  type SourceEntry,
  type CoreBankingEntry
} from '@/lib/reconciliation/reconciliationEngine';
import {
  parseSourceExcel,
  parseCoreBankingFile,
  generateComplementFile,
  generateRecoveryFile,
  generateAuditReport
} from '@/lib/reconciliation/fileGenerators';

interface ReconciliationModuleProps {
  originalData: PayrollEntry[] | null;
}

type StatusFilter = 'ALL' | 'MATCH' | 'UNDERPAID' | 'OVERPAID' | 'MISSING' | 'DUPLICATE';

export function ReconciliationModule({ originalData }: ReconciliationModuleProps) {
  const { toast } = useToast();
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [coreBankingFile, setCoreBankingFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [payPeriod, setPayPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const handleSourceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSourceFile(file);
      setError(null);
    }
  };

  const handleCoreBankingFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoreBankingFile(file);
      setError(null);
    }
  };

  const runReconciliation = async () => {
    if (!sourceFile || !coreBankingFile) {
      setError('Veuillez sélectionner les deux fichiers');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Parser les fichiers
      const [sourceResult, cbResult] = await Promise.all([
        parseSourceExcel(sourceFile),
        parseCoreBankingFile(coreBankingFile)
      ]);

      if (sourceResult.errors.length > 0) {
        setError(`Erreurs fichier source: ${sourceResult.errors.join(', ')}`);
        return;
      }

      if (cbResult.errors.length > 0) {
        setError(`Erreurs fichier Core Banking: ${cbResult.errors.join(', ')}`);
        return;
      }

      // Exécuter la réconciliation
      const result = reconcile(
        sourceResult.entries as SourceEntry[],
        cbResult.entries as CoreBankingEntry[],
        payPeriod
      );

      setSummary(result);

      logAuditEvent('reconciliation', 'Réconciliation exécutée', {
        sourceFile: sourceFile.name,
        coreBankingFile: coreBankingFile.name,
        period: payPeriod,
        matchCount: result.matchCount,
        anomalyCount: result.anomalyCount
      });

      toast({
        title: 'Réconciliation terminée',
        description: `${result.matchCount} correspondances, ${result.anomalyCount} anomalies détectées`
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      logAuditEvent('error', `Erreur de réconciliation: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadComplementFile = async () => {
    if (!summary || summary.corrections.length === 0) return;
    
    const blob = await generateComplementFile(
      summary.corrections,
      'Entreprise',
      payPeriod
    );
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `COMPLEMENT_SALAIRE_${payPeriod}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Fichier généré',
      description: `${summary.corrections.length} virements complémentaires`
    });
  };

  const downloadRecoveryFile = async () => {
    if (!summary || summary.recoveries.length === 0) return;
    
    const blob = await generateRecoveryFile(
      summary.recoveries,
      'Entreprise',
      payPeriod
    );
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RECOUVREMENT_DUPLICATA_${payPeriod}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Fichier généré',
      description: `${summary.recoveries.length} recouvrements à effectuer`
    });
  };

  const downloadAuditReport = async () => {
    if (!summary) return;
    
    const blob = await generateAuditReport(
      summary,
      'Entreprise',
      payPeriod
    );
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RAPPORT_AUDIT_${payPeriod}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Rapport d\'audit généré',
      description: 'Export complet de la réconciliation'
    });
  };

  const filteredResults = useMemo(() => {
    if (!summary) return [];
    
    return summary.results.filter(result => {
      const matchesStatus = statusFilter === 'ALL' || result.status === statusFilter;
      const matchesSearch = searchQuery === '' || 
        result.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.rib.includes(searchQuery);
      
      return matchesStatus && matchesSearch;
    });
  }, [summary, statusFilter, searchQuery]);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status: ReconciliationResult['status']) => {
    const styles = {
      MATCH: 'bg-success/20 text-success border-success/30',
      UNDERPAID: 'bg-warning/20 text-warning border-warning/30',
      OVERPAID: 'bg-destructive/20 text-destructive border-destructive/30',
      MISSING: 'bg-accent/20 text-accent-foreground border-accent/30',
      DUPLICATE: 'bg-destructive/30 text-destructive border-destructive/40'
    };
    
    const labels = {
      MATCH: 'OK',
      UNDERPAID: 'Sous-payé',
      OVERPAID: 'Sur-payé',
      MISSING: 'Manquant',
      DUPLICATE: 'Doublon'
    };
    
    return (
      <Badge variant="outline" className={styles[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const getDeltaDisplay = (delta: number) => {
    if (delta === 0) {
      return <span className="text-success font-mono">0</span>;
    } else if (delta > 0) {
      return <span className="text-warning font-mono">+{formatAmount(delta)}</span>;
    } else {
      return <span className="text-destructive font-mono">{formatAmount(delta)}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <ArrowRightLeft className="h-8 w-8 text-primary" />
          Module de Réconciliation
        </h1>
        <p className="text-muted-foreground mt-1">
          Comparez le fichier de paie avec le Core Banking et générez les corrections
        </p>
      </div>

      {/* File Upload Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source File */}
        <Card className="card-banking">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Source A - Référentiel RH
            </CardTitle>
            <CardDescription>
              Fichier Excel validé par les Ressources Humaines
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className={`dropzone cursor-pointer ${sourceFile ? 'border-success' : ''}`}
              onClick={() => document.getElementById('source-input')?.click()}
            >
              <input
                id="source-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleSourceFileSelect}
                className="hidden"
              />
              {sourceFile ? (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                  <div>
                    <p className="font-medium">{sourceFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(sourceFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="font-medium">Importer le fichier source</p>
                  <p className="text-sm text-muted-foreground">Excel (.xlsx) ou CSV</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Core Banking File */}
        <Card className="card-banking">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-primary" />
              Source B - Core Banking
            </CardTitle>
            <CardDescription>
              Export des transactions du système bancaire
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className={`dropzone cursor-pointer ${coreBankingFile ? 'border-success' : ''}`}
              onClick={() => document.getElementById('cb-input')?.click()}
            >
              <input
                id="cb-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleCoreBankingFileSelect}
                className="hidden"
              />
              {coreBankingFile ? (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                  <div>
                    <p className="font-medium">{coreBankingFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(coreBankingFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="font-medium">Importer le fichier Core Banking</p>
                  <p className="text-sm text-muted-foreground">Excel (.xlsx) ou CSV</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <Card className="card-banking">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Période:</label>
              <Input
                type="month"
                value={payPeriod}
                onChange={(e) => setPayPeriod(e.target.value)}
                className="w-40"
              />
            </div>
            
            <Button
              onClick={runReconciliation}
              disabled={!sourceFile || !coreBankingFile || isProcessing}
              className="flex-1 sm:flex-none"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  <FileCheck2 className="h-4 w-4 mr-2" />
                  Lancer la Réconciliation
                </>
              )}
            </Button>

            {summary && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={downloadComplementFile}
                  disabled={summary.corrections.length === 0}
                >
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Compléments ({summary.corrections.length})
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={downloadRecoveryFile}
                  disabled={summary.recoveries.length === 0}
                >
                  <TrendingDown className="h-4 w-4 mr-1" />
                  Recouvrements ({summary.recoveries.length})
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={downloadAuditReport}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Rapport Audit
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-3">
          <AlertOctagon className="h-5 w-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Results */}
      {summary && (
        <div className="space-y-6 animate-fade-in">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card className="p-4 bg-muted/50">
              <div className="text-muted-foreground text-sm">Attendu</div>
              <p className="text-xl font-bold mt-1">{formatAmount(summary.totalExpected)}</p>
            </Card>
            
            <Card className="p-4 bg-success/10">
              <div className="flex items-center gap-1 text-success text-sm">
                <TrendingUp className="h-4 w-4" />
                Reçu
              </div>
              <p className="text-xl font-bold mt-1 text-success">{formatAmount(summary.totalActual)}</p>
            </Card>
            
            <Card className={`p-4 ${summary.totalDelta > 0 ? 'bg-warning/10' : summary.totalDelta < 0 ? 'bg-destructive/10' : 'bg-success/10'}`}>
              <div className="text-muted-foreground text-sm">Écart Total</div>
              <p className={`text-xl font-bold mt-1 ${summary.totalDelta > 0 ? 'text-warning' : summary.totalDelta < 0 ? 'text-destructive' : 'text-success'}`}>
                {formatAmount(summary.totalDelta)}
              </p>
            </Card>
            
            <Card className="p-4 bg-primary/10">
              <div className="flex items-center gap-1 text-primary text-sm">
                <CheckCircle2 className="h-4 w-4" />
                Match
              </div>
              <p className="text-xl font-bold mt-1 text-primary">{summary.matchCount}</p>
            </Card>
            
            <Card className="p-4 bg-destructive/10">
              <div className="flex items-center gap-1 text-destructive text-sm">
                <Copy className="h-4 w-4" />
                Doublons
              </div>
              <p className="text-xl font-bold mt-1 text-destructive">{summary.duplicateCount}</p>
            </Card>
            
            <Card className="p-4 bg-accent/20">
              <div className="flex items-center gap-1 text-accent-foreground text-sm">
                <AlertTriangle className="h-4 w-4" />
                Anomalies
              </div>
              <p className="text-xl font-bold mt-1 text-accent-foreground">{summary.anomalyCount}</p>
            </Card>
          </div>

          {/* Status Distribution */}
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-3 bg-success/10 rounded-lg">
              <p className="text-2xl font-bold text-success">{summary.matchCount}</p>
              <p className="text-xs text-muted-foreground">OK</p>
            </div>
            <div className="text-center p-3 bg-warning/10 rounded-lg">
              <p className="text-2xl font-bold text-warning">{summary.underpaidCount}</p>
              <p className="text-xs text-muted-foreground">Sous-payés</p>
            </div>
            <div className="text-center p-3 bg-destructive/10 rounded-lg">
              <p className="text-2xl font-bold text-destructive">{summary.overpaidCount}</p>
              <p className="text-xs text-muted-foreground">Sur-payés</p>
            </div>
            <div className="text-center p-3 bg-accent/20 rounded-lg">
              <p className="text-2xl font-bold text-accent-foreground">{summary.missingCount}</p>
              <p className="text-xs text-muted-foreground">Manquants</p>
            </div>
          </div>

          {/* Detailed Table */}
          <Card className="card-banking">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Tableau Complet de Réconciliation
                </CardTitle>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Input
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-8"
                    />
                    <Filter className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tous</SelectItem>
                      <SelectItem value="MATCH">OK</SelectItem>
                      <SelectItem value="UNDERPAID">Sous-payé</SelectItem>
                      <SelectItem value="OVERPAID">Sur-payé</SelectItem>
                      <SelectItem value="MISSING">Manquant</SelectItem>
                      <SelectItem value="DUPLICATE">Doublon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-[100px]">ID</TableHead>
                        <TableHead className="min-w-[150px]">Nom</TableHead>
                        <TableHead className="min-w-[200px]">RIB</TableHead>
                        <TableHead className="text-right min-w-[120px]">Attendu</TableHead>
                        <TableHead className="text-right min-w-[120px]">Reçu</TableHead>
                        <TableHead className="text-right min-w-[120px]">Écart</TableHead>
                        <TableHead className="text-center min-w-[80px]">Nb Tx</TableHead>
                        <TableHead className="text-center min-w-[100px]">Statut</TableHead>
                        <TableHead className="min-w-[150px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResults.map((result) => (
                        <TableRow 
                          key={result.employeeId}
                          className={
                            result.status === 'MATCH' ? 'bg-success/5' :
                            result.status === 'DUPLICATE' ? 'bg-destructive/10' :
                            result.flagged ? 'bg-warning/5' : ''
                          }
                        >
                          <TableCell className="font-mono text-xs">
                            {result.employeeId}
                          </TableCell>
                          <TableCell className="font-medium">
                            {result.name}
                            {result.flagged && (
                              <AlertTriangle className="h-3 w-3 text-warning inline ml-1" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {formatRIB(result.rib)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatAmount(result.expectedAmount)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatAmount(result.actualAmount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {getDeltaDisplay(result.delta)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={result.transactionCount > 1 ? 'border-destructive text-destructive' : ''}>
                              {result.transactionCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {getStatusBadge(result.status)}
                          </TableCell>
                          <TableCell>
                            {result.status === 'UNDERPAID' || result.status === 'MISSING' ? (
                              <Button variant="ghost" size="sm" className="text-success h-7 px-2">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                Compléter
                              </Button>
                            ) : result.status === 'OVERPAID' || result.status === 'DUPLICATE' ? (
                              <Button variant="ghost" size="sm" className="text-destructive h-7 px-2">
                                <TrendingDown className="h-3 w-3 mr-1" />
                                Recouvrer
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                Affichage de {filteredResults.length} sur {summary.results.length} entrées
              </div>
            </CardContent>
          </Card>

          {/* Quick Action Button */}
          {(summary.corrections.length > 0 || summary.recoveries.length > 0) && (
            <Card className="card-banking border-primary/50">
              <CardContent className="py-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">Actions de Correction</h3>
                    <p className="text-muted-foreground text-sm">
                      {summary.corrections.length} virements complémentaires • {summary.recoveries.length} recouvrements
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {summary.corrections.length > 0 && (
                      <Button onClick={downloadComplementFile} className="bg-success hover:bg-success/90">
                        <FileDown className="h-4 w-4 mr-2" />
                        Générer Virements Complémentaires
                      </Button>
                    )}
                    {summary.recoveries.length > 0 && (
                      <Button onClick={downloadRecoveryFile} variant="destructive">
                        <FileDown className="h-4 w-4 mr-2" />
                        Générer Liste Recouvrements
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
