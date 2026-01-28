import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle2, 
  Clock,
  Eye,
  Filter
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
type AlertType = 'FLUX_MANQUANT' | 'FRAIS_NON_PRELEVES' | 'MATRICULE_INCONNU' | 'RIB_SUSPECT' | 'SPLIT_IDENTITE' | 'CLM_NON_TROUVE';

interface IntegrityAlert {
  id: string;
  alert_type: AlertType;
  alert_severity: AlertSeverity | null;
  title: string;
  description: string;
  suggested_action: string | null;
  is_resolved: boolean | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string | null;
  company_id: string | null;
  import_id: string | null;
}

const SEVERITY_CONFIG: Record<AlertSeverity, { icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
  INFO: { icon: <Info className="h-4 w-4" />, variant: 'secondary', color: 'text-blue-500' },
  WARNING: { icon: <AlertTriangle className="h-4 w-4" />, variant: 'outline', color: 'text-amber-500' },
  CRITICAL: { icon: <AlertCircle className="h-4 w-4" />, variant: 'destructive', color: 'text-red-500' }
};

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  FLUX_MANQUANT: 'Flux Manquant',
  FRAIS_NON_PRELEVES: 'Frais Non Prélevés',
  MATRICULE_INCONNU: 'Matricule Inconnu',
  RIB_SUSPECT: 'RIB Suspect',
  SPLIT_IDENTITE: 'Erreur Identité Split',
  CLM_NON_TROUVE: 'CLM Non Trouvé'
};

export function IntegrityAlertsPanel() {
  const [alerts, setAlerts] = useState<IntegrityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [selectedAlert, setSelectedAlert] = useState<IntegrityAlert | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const fetchAlerts = async () => {
    try {
      let query = supabase
        .from('integrity_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'pending') {
        query = query.eq('is_resolved', false);
      } else if (filter === 'resolved') {
        query = query.eq('is_resolved', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les alertes',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async () => {
    if (!selectedAlert) return;

    try {
      const { error } = await supabase
        .from('integrity_alerts')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: 'Agent',
          resolution_notes: resolutionNotes || null
        })
        .eq('id', selectedAlert.id);

      if (error) throw error;
      
      toast({ title: 'Succès', description: 'Alerte résolue' });
      setSelectedAlert(null);
      setResolutionNotes('');
      fetchAlerts();
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de résoudre l\'alerte',
        variant: 'destructive'
      });
    }
  };

  const stats = {
    total: alerts.length,
    critical: alerts.filter(a => a.alert_severity === 'CRITICAL' && !a.is_resolved).length,
    warning: alerts.filter(a => a.alert_severity === 'WARNING' && !a.is_resolved).length,
    pending: alerts.filter(a => !a.is_resolved).length
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Alertes d'Intégrité</h1>
          <p className="text-muted-foreground mt-1">
            Contrôle et résolution des anomalies détectées
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            onClick={() => setFilter('pending')}
            size="sm"
          >
            <Clock className="h-4 w-4 mr-1" />
            En attente
          </Button>
          <Button
            variant={filter === 'resolved' ? 'default' : 'outline'}
            onClick={() => setFilter('resolved')}
            size="sm"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Résolues
          </Button>
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            size="sm"
          >
            <Filter className="h-4 w-4 mr-1" />
            Toutes
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Alertes</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Critiques</p>
                <p className="text-2xl font-bold">{stats.critical}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avertissements</p>
                <p className="text-2xl font-bold">{stats.warning}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En Attente</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Liste des Alertes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {filter === 'pending' ? 'Aucune alerte en attente' : 'Aucune alerte'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sévérité</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Créée le</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map(alert => {
                  const severity = alert.alert_severity || 'WARNING';
                  const config = SEVERITY_CONFIG[severity];
                  
                  return (
                    <TableRow key={alert.id}>
                      <TableCell>
                        <Badge variant={config.variant} className="gap-1">
                          {config.icon}
                          {severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ALERT_TYPE_LABELS[alert.alert_type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{alert.title}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {alert.description}
                      </TableCell>
                      <TableCell>
                        {alert.created_at 
                          ? new Date(alert.created_at).toLocaleDateString('fr-FR')
                          : '—'
                        }
                      </TableCell>
                      <TableCell>
                        {alert.is_resolved ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Résolu
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <Clock className="h-3 w-3" />
                            En attente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedAlert(alert)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAlert && SEVERITY_CONFIG[selectedAlert.alert_severity || 'WARNING'].icon}
              Détail de l'Alerte
            </DialogTitle>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <Badge variant="outline" className="mt-1">
                    {ALERT_TYPE_LABELS[selectedAlert.alert_type]}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sévérité</p>
                  <Badge 
                    variant={SEVERITY_CONFIG[selectedAlert.alert_severity || 'WARNING'].variant}
                    className="mt-1"
                  >
                    {selectedAlert.alert_severity}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Titre</p>
                <p className="font-medium">{selectedAlert.title}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="text-sm">{selectedAlert.description}</p>
              </div>

              {selectedAlert.suggested_action && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Action Suggérée</p>
                  <p className="text-sm font-medium">{selectedAlert.suggested_action}</p>
                </div>
              )}

              {!selectedAlert.is_resolved && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Notes de résolution</p>
                  <Textarea
                    value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)}
                    placeholder="Décrivez les actions prises pour résoudre cette alerte..."
                  />
                </div>
              )}

              {selectedAlert.is_resolved && selectedAlert.resolution_notes && (
                <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                  <p className="text-sm text-muted-foreground">Résolu par {selectedAlert.resolved_by}</p>
                  <p className="text-sm">{selectedAlert.resolution_notes}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedAlert.resolved_at && new Date(selectedAlert.resolved_at).toLocaleString('fr-FR')}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setSelectedAlert(null)}>
                  Fermer
                </Button>
                {!selectedAlert.is_resolved && (
                  <Button onClick={resolveAlert}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Marquer comme Résolu
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
