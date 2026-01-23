import { useState } from 'react';
import { 
  ClipboardList, 
  Clock, 
  FileInput, 
  FileOutput, 
  CheckCircle2, 
  AlertCircle,
  FileCheck2,
  RefreshCw,
  Download,
  Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AuditLogEntry } from '@/types/payroll';
import { getAuditLogs, formatActionType, getActionColorClass, exportAuditLogs } from '@/utils/auditLog';

export function AuditDashboard() {
  const [logs, setLogs] = useState<AuditLogEntry[]>(getAuditLogs);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const refreshLogs = () => {
    setLogs(getAuditLogs());
  };

  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'all' || log.action === filter;
    const matchesSearch = searchTerm === '' || 
      log.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const exportLogs = () => {
    const data = exportAuditLogs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit_log_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getActionIcon = (action: AuditLogEntry['action']) => {
    const icons = {
      import: FileInput,
      export: FileOutput,
      validation: CheckCircle2,
      reconciliation: FileCheck2,
      error: AlertCircle
    };
    const Icon = icons[action] || ClipboardList;
    return <Icon className="h-4 w-4" />;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Stats
  const stats = {
    total: logs.length,
    imports: logs.filter(l => l.action === 'import').length,
    exports: logs.filter(l => l.action === 'export').length,
    errors: logs.filter(l => l.action === 'error').length
  };

  return (
    <Card className="card-banking h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Journal d'Audit
            </CardTitle>
            <CardDescription>
              Historique des opérations et traçabilité
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refreshLogs}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={exportLogs}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="text-center p-2 bg-info/10 rounded-lg">
            <p className="text-2xl font-bold text-info">{stats.imports}</p>
            <p className="text-xs text-muted-foreground">Imports</p>
          </div>
          <div className="text-center p-2 bg-success/10 rounded-lg">
            <p className="text-2xl font-bold text-success">{stats.exports}</p>
            <p className="text-xs text-muted-foreground">Exports</p>
          </div>
          <div className="text-center p-2 bg-destructive/10 rounded-lg">
            <p className="text-2xl font-bold text-destructive">{stats.errors}</p>
            <p className="text-xs text-muted-foreground">Erreurs</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="import">Import</SelectItem>
              <SelectItem value="export">Export</SelectItem>
              <SelectItem value="validation">Validation</SelectItem>
              <SelectItem value="reconciliation">Réconciliation</SelectItem>
              <SelectItem value="error">Erreurs</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Log List */}
        <ScrollArea className="h-[400px] border rounded-lg">
          <div className="p-2 space-y-2">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucun événement enregistré</p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div 
                  key={log.id}
                  className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${getActionColorClass(log.action)}`}>
                    {getActionIcon(log.action)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {formatActionType(log.action)}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm truncate">{log.description}</p>
                    {log.details && (
                      <details className="mt-1">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          Détails
                        </summary>
                        <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
