import { 
  FileSpreadsheet, 
  FileOutput, 
  CheckCircle2, 
  XCircle,
  TrendingUp,
  Clock,
  AlertTriangle,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ImportResult, GeneratedFile, ReconciliationReport } from '@/types/payroll';
import { getAuditLogs } from '@/utils/auditLog';

interface DashboardOverviewProps {
  importData: ImportResult | null;
  generatedFiles: GeneratedFile[];
  reconciliationReport: ReconciliationReport | null;
}

export function DashboardOverview({ 
  importData, 
  generatedFiles, 
  reconciliationReport 
}: DashboardOverviewProps) {
  const auditLogs = getAuditLogs();
  const recentLogs = auditLogs.slice(0, 5);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const validationRate = importData 
    ? (importData.totalValid / importData.entries.length) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Tableau de Bord</h1>
        <p className="text-muted-foreground mt-1">
          Vue d'ensemble du middleware de paie MUCO-AMPLITUDE
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Entries Stats */}
        <Card className="card-banking">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Entrées importées</p>
                <p className="text-3xl font-bold mt-1">
                  {importData?.entries.length || 0}
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
              </div>
            </div>
            {importData && (
              <div className="mt-4 flex gap-2">
                <Badge className="status-valid gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {importData.totalValid}
                </Badge>
                <Badge className="status-invalid gap-1">
                  <XCircle className="h-3 w-3" />
                  {importData.totalInvalid}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Amount Stats */}
        <Card className="card-banking">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Montant total</p>
                <p className="text-2xl font-bold mt-1 text-primary">
                  {importData ? formatAmount(importData.totalAmount) : '0 XAF'}
                </p>
              </div>
              <div className="p-3 bg-success/10 rounded-full">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
            </div>
            {importData && (
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1">
                  <span>Taux de validation</span>
                  <span className="font-medium">{validationRate.toFixed(1)}%</span>
                </div>
                <Progress value={validationRate} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Generated Files */}
        <Card className="card-banking">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fichiers générés</p>
                <p className="text-3xl font-bold mt-1">{generatedFiles.length}</p>
              </div>
              <div className="p-3 bg-accent/20 rounded-full">
                <FileOutput className="h-6 w-6 text-accent-foreground" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Badge variant="outline">
                XML: {generatedFiles.filter(f => f.type === 'xml').length}
              </Badge>
              <Badge variant="outline">
                Plat: {generatedFiles.filter(f => f.type === 'flat').length}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Reconciliation Stats */}
        <Card className="card-banking">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taux de succès</p>
                <p className="text-3xl font-bold mt-1">
                  {reconciliationReport 
                    ? `${reconciliationReport.tauxSucces.toFixed(1)}%` 
                    : '--%'}
                </p>
              </div>
              <div className="p-3 bg-info/10 rounded-full">
                <Activity className="h-6 w-6 text-info" />
              </div>
            </div>
            {reconciliationReport && (
              <Progress value={reconciliationReport.tauxSucces} className="mt-4 h-2" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="card-banking">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              Activité Récente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucune activité récente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentLogs.map((log) => (
                  <div 
                    key={log.id}
                    className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                  >
                    <div className={`w-2 h-2 rounded-full ${
                      log.action === 'error' ? 'bg-destructive' : 
                      log.action === 'export' ? 'bg-success' : 'bg-primary'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{log.description}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(log.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="card-banking">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />
              État du Système
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span>Validation RIB (Modulo 97)</span>
              </div>
              <Badge className="status-valid">Actif</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span>Génération XML (MVTI_008)</span>
              </div>
              <Badge className="status-valid">Actif</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span>Fichier Plat (INT-VIRMU2)</span>
              </div>
              <Badge className="status-valid">Actif</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <span>Connexion Oracle (Sp_NombreEcriture)</span>
              </div>
              <Badge className="status-pending">Mode Démo</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
