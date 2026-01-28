import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Calendar, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type FluxStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED';

interface MonthlyFlux {
  id: string;
  company_id: string;
  year_month: string;
  flux_number: number;
  flux_status: FluxStatus;
  frais_appliques: number | null;
  frais_attendus: number | null;
  processed_at: string | null;
  alert_generated: boolean | null;
  alert_message: string | null;
  company?: {
    nom_entreprise: string;
    code_client: string;
    fee_option: string;
  };
}

const FLUX_STATUS_CONFIG: Record<FluxStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ReactNode }> = {
  PENDING: { label: 'En attente', variant: 'outline', icon: <Calendar className="h-3 w-3" /> },
  COMPLETED: { label: 'Terminé', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  SKIPPED: { label: 'Ignoré', variant: 'secondary', icon: <AlertTriangle className="h-3 w-3" /> }
};

export function MonthlyFluxTracker() {
  const [fluxData, setFluxData] = useState<MonthlyFlux[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const { toast } = useToast();

  // Generate last 12 months for selection
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    };
  });

  useEffect(() => {
    fetchFluxData();
  }, [selectedMonth]);

  const fetchFluxData = async () => {
    try {
      const { data, error } = await supabase
        .from('monthly_flux_counter')
        .select(`
          *,
          company:company_profiles(nom_entreprise, code_client, fee_option)
        `)
        .eq('year_month', selectedMonth)
        .order('flux_number');

      if (error) throw error;
      
      // Transform the data to handle the company relationship
      const transformedData = (data || []).map(item => ({
        ...item,
        company: Array.isArray(item.company) ? item.company[0] : item.company
      }));
      
      setFluxData(transformedData);
    } catch (error) {
      console.error('Error fetching flux data:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données de flux',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Group by company
  const groupedByCompany = fluxData.reduce((acc, flux) => {
    const companyId = flux.company_id;
    if (!acc[companyId]) {
      acc[companyId] = {
        company: flux.company,
        fluxes: []
      };
    }
    acc[companyId].fluxes.push(flux);
    return acc;
  }, {} as Record<string, { company: MonthlyFlux['company']; fluxes: MonthlyFlux[] }>);

  const stats = {
    totalCompanies: Object.keys(groupedByCompany).length,
    totalFluxes: fluxData.length,
    completedFluxes: fluxData.filter(f => f.flux_status === 'COMPLETED').length,
    pendingAlerts: fluxData.filter(f => f.alert_generated).length,
    totalFrais: fluxData.reduce((sum, f) => sum + (f.frais_appliques || 0), 0)
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Compteur de Flux Mensuel</h1>
          <p className="text-muted-foreground mt-1">
            Suivi des envois mensuels et séquençage de la facturation
          </p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map(month => (
              <SelectItem key={month.value} value={month.value}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Entreprises</p>
                <p className="text-2xl font-bold">{stats.totalCompanies}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Flux</p>
                <p className="text-2xl font-bold">{stats.totalFluxes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Complétés</p>
                <p className="text-2xl font-bold">{stats.completedFluxes}</p>
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
                <p className="text-sm text-muted-foreground">Alertes</p>
                <p className="text-2xl font-bold">{stats.pendingAlerts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Frais Collectés</p>
              <p className="text-2xl font-bold">{stats.totalFrais.toLocaleString()} <span className="text-sm font-normal">FCFA</span></p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flux Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Détail des Flux - {months.find(m => m.value === selectedMonth)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : Object.keys(groupedByCompany).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun flux enregistré pour ce mois
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entreprise</TableHead>
                  <TableHead>Code Client</TableHead>
                  <TableHead>Option</TableHead>
                  <TableHead>N° Flux</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Frais Appliqués</TableHead>
                  <TableHead>Traité le</TableHead>
                  <TableHead>Alerte</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fluxData.map(flux => (
                  <TableRow key={flux.id}>
                    <TableCell className="font-medium">
                      {flux.company?.nom_entreprise || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <code className="px-2 py-1 bg-muted rounded text-sm">
                        {flux.company?.code_client || 'N/A'}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{flux.company?.fee_option}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Flux #{flux.flux_number}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={FLUX_STATUS_CONFIG[flux.flux_status].variant}
                        className="gap-1"
                      >
                        {FLUX_STATUS_CONFIG[flux.flux_status].icon}
                        {FLUX_STATUS_CONFIG[flux.flux_status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {flux.frais_appliques !== null ? (
                        <span className="font-medium">
                          {flux.frais_appliques.toLocaleString()} FCFA
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {flux.processed_at ? (
                        new Date(flux.processed_at).toLocaleDateString('fr-FR')
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {flux.alert_generated ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Alerte
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
