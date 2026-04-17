import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, Keyboard, ShieldAlert, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface WorkflowItem {
  id: string;
  import_id: string | null;
  session_id: string | null;
  ville: string;
  status: string;
  submitted_by: string | null;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
}

export function ValidationPanel() {
  const { isAdmin, isSuperAdmin, adminVille, profile } = useAuth();
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [selected, setSelected] = useState<WorkflowItem | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('validation_workflow')
      .select('*')
      .order('created_at', { ascending: false });
    setItems((data as WorkflowItem[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const validate = useCallback(
    async (item: WorkflowItem, method: string) => {
      if (!isAdmin) {
        toast.error('Action réservée aux administrateurs');
        return;
      }
      if (!isSuperAdmin && adminVille && item.ville !== adminVille) {
        toast.error(`Vous ne pouvez valider que les flux de ${adminVille}`);
        return;
      }
      const { error } = await supabase
        .from('validation_workflow')
        .update({
          status: 'validated',
          validated_by: profile?.user_id,
          validated_at: new Date().toISOString(),
          validation_method: method,
        })
        .eq('id', item.id);

      if (error) {
        toast.error('Erreur: ' + error.message);
      } else {
        toast.success(`Flux validé via ${method}. Transmission Amplitude programmée.`);
        await supabase.from('audit_logs').insert({
          action: 'VALIDATE_PAYROLL',
          description: `Validation de paie (${method}) pour ${item.ville}`,
          entity_type: 'validation_workflow',
          entity_id: item.id,
          severity: 'info',
        });
        load();
      }
    },
    [isAdmin, isSuperAdmin, adminVille, profile]
  );

  const reject = async (item: WorkflowItem) => {
    const reason = prompt('Motif du rejet ?');
    if (!reason) return;
    const { error } = await supabase
      .from('validation_workflow')
      .update({ status: 'rejected', rejection_reason: reason, validated_by: profile?.user_id, validated_at: new Date().toISOString() })
      .eq('id', item.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Flux rejeté');
      load();
    }
  };

  // CTRL+V handler — only when an item is selected
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selected) return;
      const target = e.target as HTMLElement;
      // Skip if user is typing in an input/textarea (let paste work normally)
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        validate(selected, 'CTRL+V');
        setSelected(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, validate]);

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            <p>Accès réservé aux Administrateurs régionaux.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const visible = isSuperAdmin ? items : items.filter((i) => i.ville === adminVille);

  const statusBadge = (s: string) => {
    if (s === 'validated') return <Badge className="bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Validé</Badge>;
    if (s === 'rejected') return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejeté</Badge>;
    if (s === 'transferred') return <Badge className="bg-primary text-primary-foreground">Transféré</Badge>;
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Validation des Paies</h1>
        <p className="text-muted-foreground mt-1">
          Sélectionnez un flux puis appuyez sur <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">CTRL + V</kbd> pour valider la transmission Amplitude.
        </p>
      </div>

      {selected && (
        <Card className="border-primary border-2 animate-pulse">
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Keyboard className="h-6 w-6 text-primary" />
              <div>
                <p className="font-semibold">Flux sélectionné — {selected.ville.replace('_', '-')}</p>
                <p className="text-sm text-muted-foreground">Appuyez sur CTRL+V pour valider</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSelected(null)}>Annuler</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Flux à valider</CardTitle>
          <CardDescription>
            {isSuperAdmin ? 'Tous les flux (Super Admin)' : `Flux de ${adminVille === 'POINTE_NOIRE' ? 'Pointe-Noire' : 'Brazzaville'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Chargement...</p>
          ) : visible.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucun flux à valider</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Validé par</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((item) => (
                  <TableRow
                    key={item.id}
                    className={selected?.id === item.id ? 'bg-primary/10' : ''}
                  >
                    <TableCell className="text-xs">{new Date(item.created_at).toLocaleString('fr-FR')}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.ville === 'POINTE_NOIRE' ? 'Pointe-Noire' : 'Brazzaville'}</Badge>
                    </TableCell>
                    <TableCell>{statusBadge(item.status)}</TableCell>
                    <TableCell className="text-xs font-mono">{item.validated_by?.substring(0, 8) || '—'}</TableCell>
                    <TableCell className="text-right">
                      {item.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant={selected?.id === item.id ? 'default' : 'outline'}
                            onClick={() => setSelected(selected?.id === item.id ? null : item)}
                          >
                            <Keyboard className="h-4 w-4 mr-1" />
                            {selected?.id === item.id ? 'Sélectionné' : 'Sélectionner'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => reject(item)}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
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
