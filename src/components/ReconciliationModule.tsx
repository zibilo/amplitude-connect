import { useState, useCallback } from 'react';
import { 
  FileCheck2, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ReconciliationReport, PayrollEntry } from '@/types/payroll';
import { parseRCPFile, compareWithOriginal, generateSampleRCPFile } from '@/utils/reconciliation';
import { logAuditEvent } from '@/utils/auditLog';
import { formatRIB } from '@/utils/ribValidation';

interface ReconciliationModuleProps {
  originalData: PayrollEntry[] | null;
}

export function ReconciliationModule({ originalData }: ReconciliationModuleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [comparison, setComparison] = useState<ReturnType<typeof compareWithOriginal> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      const result = await parseRCPFile(file);
      setReport(result);

      if (originalData && originalData.length > 0) {
        const comp = compareWithOriginal(originalData, result);
        setComparison(comp);
      }

      logAuditEvent('reconciliation', `Fichier RCP importé: ${file.name}`, {
        fileName: file.name,
        totalEntries: result.entries.length,
        successRate: result.tauxSucces
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      logAuditEvent('error', `Erreur de réconciliation: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const generateTestRCP = () => {
    if (!originalData || originalData.length === 0) return;
    
    const blob = generateSampleRCPFile(originalData);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `test_${new Date().toISOString().split('T')[0]}.RCP`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    logAuditEvent('export', 'Fichier RCP de test généré');
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusIcon = (status: 'success' | 'rejected' | 'pending') => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-warning" />;
    }
  };

  return (
    <Card className="card-banking">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-primary" />
          Module de Réconciliation
        </CardTitle>
        <CardDescription>
          Importez les fichiers .RCP de compensation pour vérifier le statut des virements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Drop Zone */}
        <div
          className={`dropzone cursor-pointer ${isDragging ? 'dropzone-active' : ''} ${isProcessing ? 'opacity-50' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('rcp-input')?.click()}
        >
          <input
            id="rcp-input"
            type="file"
            accept=".rcp,.RCP,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex flex-col items-center gap-3">
            <div className={`p-4 rounded-full ${isDragging ? 'bg-primary/20' : 'bg-muted'}`}>
              <Upload className={`h-8 w-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="font-medium">
                {isProcessing ? 'Traitement...' : 'Glissez votre fichier .RCP ici'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Rapport de compensation bancaire
              </p>
            </div>
          </div>
        </div>

        {/* Test File Generator */}
        {originalData && originalData.length > 0 && !report && (
          <Button variant="outline" size="sm" onClick={generateTestRCP} className="w-full">
            <FileDown className="h-4 w-4 mr-2" />
            Générer un fichier RCP de test
          </Button>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Report Summary */}
        {report && (
          <div className="space-y-6 animate-fade-in">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <BarChart3 className="h-4 w-4" />
                  Envoyé
                </div>
                <p className="text-xl font-bold mt-1">{formatAmount(report.totalEnvoye)}</p>
              </div>
              
              <div className="p-4 bg-success/10 rounded-lg">
                <div className="flex items-center gap-2 text-success text-sm">
                  <TrendingUp className="h-4 w-4" />
                  Reçu
                </div>
                <p className="text-xl font-bold mt-1 text-success">{formatAmount(report.totalRecu)}</p>
              </div>
              
              <div className="p-4 bg-destructive/10 rounded-lg">
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <TrendingDown className="h-4 w-4" />
                  Rejeté
                </div>
                <p className="text-xl font-bold mt-1 text-destructive">{formatAmount(report.totalRejete)}</p>
              </div>
              
              <div className="p-4 bg-primary/10 rounded-lg">
                <div className="text-muted-foreground text-sm">Taux de succès</div>
                <p className="text-xl font-bold mt-1 text-primary">{report.tauxSucces.toFixed(1)}%</p>
                <Progress value={report.tauxSucces} className="mt-2 h-2" />
              </div>
            </div>

            {/* Comparison Stats */}
            {comparison && (
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Comparaison avec l'envoi original
                </h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Correspondances</span>
                    <p className="font-bold text-lg">{comparison.matched.length}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Non trouvés</span>
                    <p className="font-bold text-lg text-warning">{comparison.unmatched.length}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Taux appariement</span>
                    <p className="font-bold text-lg text-primary">{comparison.summary.matchRate.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Results Table */}
            <div>
              <h4 className="font-medium mb-3">Détail des opérations</h4>
              <div className="border rounded-lg overflow-hidden">
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0">
                      <TableRow>
                        <TableHead className="w-[60px]">Statut</TableHead>
                        <TableHead>Bénéficiaire</TableHead>
                        <TableHead>RIB</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead>Motif</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.entries.map((entry) => (
                        <TableRow 
                          key={entry.id}
                          className={entry.status === 'rejected' ? 'data-table-row-error' : entry.status === 'success' ? 'data-table-row-success' : ''}
                        >
                          <TableCell>{getStatusIcon(entry.status)}</TableCell>
                          <TableCell className="font-medium">{entry.nom}</TableCell>
                          <TableCell className="font-mono text-xs">{formatRIB(entry.rib)}</TableCell>
                          <TableCell className="text-right">{formatAmount(entry.montantEnvoye)}</TableCell>
                          <TableCell>
                            {entry.motifRejet && (
                              <Badge variant="outline" className="text-destructive border-destructive/30">
                                {entry.motifRejet}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
