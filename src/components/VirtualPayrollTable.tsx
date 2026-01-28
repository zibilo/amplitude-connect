import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { PayrollEntry } from '@/types/payroll';
import { formatLargeNumber } from '@/lib/streaming/virtualScroller';

interface VirtualPayrollTableProps {
  entries: PayrollEntry[];
  isLoading?: boolean;
  loadingProgress?: number;
}

export function VirtualPayrollTable({ 
  entries, 
  isLoading = false,
  loadingProgress = 0 
}: VirtualPayrollTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 20
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  const stats = {
    total: entries.length,
    valid: entries.filter(e => e.status === 'valid').length,
    invalid: entries.filter(e => e.status === 'invalid').length,
    totalAmount: entries.reduce((sum, e) => sum + e.montant, 0)
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Table className="h-5 w-5 text-primary" />
            Données de Paie
          </CardTitle>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {formatLargeNumber(stats.total)} lignes
            </span>
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {formatLargeNumber(stats.valid)}
            </Badge>
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              {formatLargeNumber(stats.invalid)}
            </Badge>
          </div>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement... {loadingProgress}%
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        {entries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Aucune donnée à afficher
          </div>
        ) : (
          <>
            {/* Fixed Header */}
            <div className="flex border-b bg-muted/50 text-sm font-medium sticky top-0 z-10">
              <div className="w-24 px-4 py-3">Matricule</div>
              <div className="flex-1 px-4 py-3">Nom</div>
              <div className="w-48 px-4 py-3">RIB</div>
              <div className="w-32 px-4 py-3 text-right">Montant</div>
              <div className="w-24 px-4 py-3 text-center">Statut</div>
            </div>

            {/* Virtual Scroll Container */}
            <div
              ref={parentRef}
              className="overflow-auto"
              style={{ height: 'calc(100% - 45px)' }}
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative'
                }}
              >
                {virtualRows.map((virtualRow) => {
                  const entry = entries[virtualRow.index];
                  return (
                    <div
                      key={virtualRow.key}
                      className="flex items-center border-b hover:bg-muted/30 transition-colors"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`
                      }}
                    >
                      <div className="w-24 px-4 py-2">
                        <code className="text-xs bg-muted px-1 rounded">
                          {entry.matricule}
                        </code>
                      </div>
                      <div className="flex-1 px-4 py-2 truncate">
                        <span className="font-medium">{entry.nom}</span>
                        {entry.prenom && (
                          <span className="text-muted-foreground ml-1">{entry.prenom}</span>
                        )}
                      </div>
                      <div className="w-48 px-4 py-2">
                        <code className="text-xs">{entry.rib}</code>
                      </div>
                      <div className="w-32 px-4 py-2 text-right font-medium">
                        {entry.montant.toLocaleString()} <span className="text-xs text-muted-foreground">FCFA</span>
                      </div>
                      <div className="w-24 px-4 py-2 text-center">
                        {entry.status === 'valid' ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
