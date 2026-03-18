import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Search, ArrowRight } from 'lucide-react';

interface Correction {
  id: string;
  matricule_errone: string;
  cco_errone: string | null;
  matricule_correct: string;
  cco_correct: string | null;
  commentaire: string | null;
}

export function ReferenceTableManager() {
  const { toast } = useToast();
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Correction | null>(null);
  const [form, setForm] = useState({ matricule_errone: '', cco_errone: '', matricule_correct: '', cco_correct: '', commentaire: '' });

  const fetchData = async () => {
    const { data } = await supabase.from('reference_corrections').select('*').order('created_at', { ascending: false });
    if (data) setCorrections(data as Correction[]);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    const payload = {
      matricule_errone: form.matricule_errone,
      cco_errone: form.cco_errone || null,
      matricule_correct: form.matricule_correct,
      cco_correct: form.cco_correct || null,
      commentaire: form.commentaire || null,
    };

    if (editing) {
      await supabase.from('reference_corrections').update(payload).eq('id', editing.id);
      toast({ title: 'Correction modifiée' });
    } else {
      await supabase.from('reference_corrections').insert(payload);
      toast({ title: 'Correction ajoutée' });
    }
    setDialogOpen(false);
    setEditing(null);
    setForm({ matricule_errone: '', cco_errone: '', matricule_correct: '', cco_correct: '', commentaire: '' });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('reference_corrections').delete().eq('id', id);
    toast({ title: 'Correction supprimée' });
    fetchData();
  };

  const openEdit = (c: Correction) => {
    setEditing(c);
    setForm({ 
      matricule_errone: c.matricule_errone, 
      cco_errone: c.cco_errone || '', 
      matricule_correct: c.matricule_correct, 
      cco_correct: c.cco_correct || '', 
      commentaire: c.commentaire || '' 
    });
    setDialogOpen(true);
  };

  const filtered = corrections.filter(c =>
    [c.matricule_errone, c.matricule_correct, c.cco_errone, c.cco_correct, c.commentaire]
      .filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Table de Référence</h1>
        <p className="text-muted-foreground mt-1">Corrections automatiques des CCO et matricules erronés</p>
      </div>

      {/* Info card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-mono text-destructive">Donnée erronée</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span>Cherche dans table ref</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-success">Valeur corrigée</span>
          </div>
        </CardContent>
      </Card>

      {/* Toolbar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Rechercher..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setForm({ matricule_errone: '', cco_errone: '', matricule_correct: '', cco_correct: '', commentaire: '' }); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Ajouter</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Modifier' : 'Ajouter'} une correction</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Matricule erroné</Label>
                  <Input value={form.matricule_errone} onChange={e => setForm(f => ({ ...f, matricule_errone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>CCO erroné</Label>
                  <Input value={form.cco_errone} onChange={e => setForm(f => ({ ...f, cco_errone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Matricule correct</Label>
                  <Input value={form.matricule_correct} onChange={e => setForm(f => ({ ...f, matricule_correct: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>CCO correct</Label>
                  <Input value={form.cco_correct} onChange={e => setForm(f => ({ ...f, cco_correct: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Commentaire</Label>
                <Input value={form.commentaire} onChange={e => setForm(f => ({ ...f, commentaire: e.target.value }))} />
              </div>
              <Button onClick={handleSave} className="w-full">Enregistrer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matricule erroné</TableHead>
                <TableHead>CCO erroné</TableHead>
                <TableHead>→</TableHead>
                <TableHead>Matricule correct</TableHead>
                <TableHead>CCO correct</TableHead>
                <TableHead>Commentaire</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucune correction enregistrée</TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-destructive">{c.matricule_errone}</TableCell>
                  <TableCell className="font-mono text-destructive">{c.cco_errone || '—'}</TableCell>
                  <TableCell><ArrowRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  <TableCell className="font-mono text-success">{c.matricule_correct}</TableCell>
                  <TableCell className="font-mono text-success">{c.cco_correct || '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.commentaire || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
