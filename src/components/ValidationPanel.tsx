import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, Keyboard, ShieldAlert, XCircle, Lock, AlertTriangle } from 'lucide-react';
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

interface PaymentValidationRequest {
  id: string;
  ville: string;
  status: string;
  total_count: number;
  total_amount: number;
  neutralized_ribs: Array<{ nom: string; rib_original: string; redirected_to: string; montant: number; reason: string }>;
  requested_by: string;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
}

export function ValidationPanel() {
  const { isAdmin, isSuperAdmin, adminVille, profile } = useAuth();
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [selected, setSelected] = useState<WorkflowItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentRequests, setPaymentRequests] = useState<PaymentValidationRequest[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data: wf }, { data: pvr }] = await Promise.all([
      supabase.from('validation_workflow').select('*').order('created_at', { ascending: false }),
      supabase.from('payment_validation_requests').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    setItems((wf as WorkflowItem[]) || []);
    setPaymentRequests((pvr as unknown as PaymentValidationRequest[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const decidePaymentRequest = async (req: PaymentValidationRequest, decision: 'approved' | 'rejected') => {
    if (!isAdmin) {
      toast.error('Action réservée aux administrateurs');
      return;
    }
    if (!isSuperAdmin && adminVille && req.ville !== adminVille) {
      toast.error(`Vous ne pouvez valider que les flux de ${adminVille}`);
      return;
    }
    let notes: string | null = null;
    if (decision === 'rejected') {
      notes = prompt('Motif du refus du Bon à Tirer ?');
      if (!notes) return;
    }
    const { error } = await supabase
      .from('payment_validation_requests')
      .update({
        status: decision,
        validated_by: profile?.user_id,
        validated_at: new Date().toISOString(),
        validation_notes: notes ?? 'Bon à Tirer accordé',
      })
      .eq('id', req.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from('audit_logs').insert({
      action: decision === 'approved' ? 'APPROVE_PAYMENT_VALIDATION' : 'REJECT_PAYMENT_VALIDATION',
      description: `${decision === 'approved' ? 'Bon à Tirer accordé' : 'Bon à Tirer refusé'} pour ${req.total_count} virement(s) → compte technique 381 (${req.ville})`,
      entity_type: 'payment_validation_requests',
      entity_id: req.id,
      severity: decision === 'approved' ? 'warning' : 'info',
    });
    toast.success(decision === 'approved' ? 'Bon à Tirer accordé' : 'Demande refusée');
    load();
  };

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
  const visiblePvr = isSuperAdmin ? paymentRequests : paymentRequests.filter((p) => p.ville === adminVille);
  const pendingPvr = visiblePvr.filter((p) => p.status === 'pending');

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

      {/* ─── Compte Technique 381 — Bon à Tirer ─────────────────────── */}
      <Card className={pendingPvr.length > 0 ? 'border-warning border-2' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-warning" />
            Validation Compte Technique <span className="font-mono">381</span>
            {pendingPvr.length > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingPvr.length} en attente</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Bon à Tirer requis pour les virements redirigés vers le compte technique 38100000000.
            Tant qu'un Administrateur ou Chef de Service Paie n'a pas validé, l'opérateur ne peut
            ni télécharger le fichier ni le déposer pour Amplitude / WinSCP.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {visiblePvr.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">Aucune demande de Bon à Tirer</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead className="text-right">Virements</TableHead>
                  <TableHead className="text-right">Montant total</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePvr.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="text-xs">{new Date(req.created_at).toLocaleString('fr-FR')}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{req.ville === 'POINTE_NOIRE' ? 'Pointe-Noire' : 'Brazzaville'}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{req.total_count}</TableCell>
                    <TableCell className="text-right font-mono">
                      {new Intl.NumberFormat('fr-FR').format(req.total_amount)} XAF
                    </TableCell>
                    <TableCell>
                      {req.status === 'approved' ? (
                        <Badge className="bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Bon à Tirer</Badge>
                      ) : req.status === 'rejected' ? (
                        <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Refusé</Badge>
                      ) : (
                        <Badge variant="secondary"><AlertTriangle className="h-3 w-3 mr-1" />En attente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => decidePaymentRequest(req, 'approved')}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Bon à Tirer
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => decidePaymentRequest(req, 'rejected')}>
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
