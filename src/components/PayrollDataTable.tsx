import { useMemo, useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Search, 
  Filter,
  ArrowUpDown,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PayrollEntry, ImportResult } from '@/types/payroll';
import { formatRIB } from '@/utils/ribValidation';

interface PayrollDataTableProps {
  data: ImportResult | null;
  onUpdateEntry?: (id: string, updates: Partial<PayrollEntry>) => void;
}

type FilterType = 'all' | 'valid' | 'invalid';
type SortField = 'matricule' | 'nom' | 'montant';
type SortOrder = 'asc' | 'desc';

export function PayrollDataTable({ data, onUpdateEntry }: PayrollDataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortField, setSortField] = useState<SortField>('matricule');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedEntry, setSelectedEntry] = useState<PayrollEntry | null>(null);

  const filteredAndSortedData = useMemo(() => {
    if (!data?.entries) return [];

    let result = [...data.entries];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(entry =>
        entry.matricule.toLowerCase().includes(term) ||
        entry.nom.toLowerCase().includes(term) ||
        entry.prenom.toLowerCase().includes(term) ||
        entry.rib.includes(term)
      );
    }

    // Apply status filter
    if (filter !== 'all') {
      result = result.filter(entry => entry.status === filter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'matricule':
          comparison = a.matricule.localeCompare(b.matricule);
          break;
        case 'nom':
          comparison = a.nom.localeCompare(b.nom);
          break;
        case 'montant':
          comparison = a.montant - b.montant;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [data?.entries, searchTerm, filter, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getStatusBadge = (entry: PayrollEntry) => {
    if (entry.status === 'valid') {
      return (
        <Badge className="status-valid gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Valide
        </Badge>
      );
    }
    return (
      <Badge className="status-invalid gap-1">
        <XCircle className="h-3 w-3" />
        Invalide
      </Badge>
    );
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (!data) {
    return (
      <Card className="card-banking">
        <CardContent className="py-12 text-center">
          <div className="text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Aucune donnée importée</p>
            <p className="text-sm mt-1">Importez un fichier Excel pour commencer</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="card-banking">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg">
              Données de Paie
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({filteredAndSortedData.length} / {data.entries.length} entrées)
              </span>
            </CardTitle>
            
            {/* Summary Stats */}
            <div className="flex gap-3">
              <Badge variant="outline" className="gap-1 bg-success/10 text-success border-success/30">
                <CheckCircle2 className="h-3 w-3" />
                {data.totalValid} valides
              </Badge>
              <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/30">
                <XCircle className="h-3 w-3" />
                {data.totalInvalid} invalides
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par matricule, nom ou RIB..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="valid">Valides</SelectItem>
                <SelectItem value="invalid">Invalides</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data Table */}
          <div className="border rounded-lg overflow-hidden">
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead className="w-[100px]">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => toggleSort('matricule')}
                        className="-ml-3 h-8"
                      >
                        Matricule
                        <ArrowUpDown className="h-3 w-3 ml-1" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => toggleSort('nom')}
                        className="-ml-3 h-8"
                      >
                        Nom & Prénom
                        <ArrowUpDown className="h-3 w-3 ml-1" />
                      </Button>
                    </TableHead>
                    <TableHead>RIB</TableHead>
                    <TableHead className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => toggleSort('montant')}
                        className="-mr-3 h-8"
                      >
                        Montant
                        <ArrowUpDown className="h-3 w-3 ml-1" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-center w-[100px]">Statut</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedData.map((entry) => (
                    <TableRow 
                      key={entry.id}
                      className={entry.status === 'invalid' ? 'data-table-row-error' : ''}
                    >
                      <TableCell className="font-mono text-sm">{entry.matricule}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{entry.nom}</span>
                          <span className="text-muted-foreground ml-1">{entry.prenom}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatRIB(entry.rib)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatAmount(entry.montant)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(entry)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEntry(entry)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {filteredAndSortedData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Aucun résultat trouvé
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center pt-4 border-t">
            <span className="text-muted-foreground">
              Total des virements valides:
            </span>
            <span className="text-2xl font-bold text-primary">
              {formatAmount(data.totalAmount)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détail de l'entrée</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Matricule</label>
                  <p className="font-mono font-medium">{selectedEntry.matricule}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Statut</label>
                  <div className="mt-1">{getStatusBadge(selectedEntry)}</div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Nom</label>
                  <p className="font-medium">{selectedEntry.nom}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Prénom</label>
                  <p className="font-medium">{selectedEntry.prenom}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground">RIB</label>
                  <p className="font-mono text-sm bg-muted p-2 rounded mt-1">
                    {formatRIB(selectedEntry.rib)}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground">Montant</label>
                  <p className="text-2xl font-bold text-primary">
                    {formatAmount(selectedEntry.montant)}
                  </p>
                </div>
                
                {selectedEntry.ribError && (
                  <div className="col-span-2">
                    <label className="text-sm text-destructive">Erreur de validation</label>
                    <p className="text-sm bg-destructive/10 text-destructive p-2 rounded mt-1 border border-destructive/30">
                      {selectedEntry.ribError}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
