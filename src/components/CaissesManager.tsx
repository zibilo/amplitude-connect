import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Search, MapPin } from 'lucide-react';

interface Caisse {
  id: string;
  code_caisse: string;
  nom_caisse: string;
  zone_region: string | null;
  is_active: boolean;
}

export function CaissesManager() {
  const { toast } = useToast();
  const [caisses, setCaisses] = useState<Caisse[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Caisse | null>(null);
  const [form, setForm] = useState({ code_caisse: '', nom_caisse: '', zone_region: '' });

  const fetchData = async () => {
    const { data } = await supabase.from('caisses').select('*').order('code_caisse');
    if (data) setCaisses(data as Caisse[]);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    const payload = {
      code_caisse: form.code_caisse,
      nom_caisse: form.nom_caisse,
      zone_region: form.zone_region || null,
    };

    if (editing) {
      await supabase.from('caisses').update(payload).eq('id', editing.id);
      toast({ title: 'Caisse modifiée' });
    } else {
      await supabase.from('caisses').insert(payload);
      toast({ title: 'Caisse ajoutée' });
    }
    setDialogOpen(false);
    setEditing(null);
    setForm({ code_caisse: '', nom_caisse: '', zone_region: '' });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('caisses').delete().eq('id', id);
    toast({ title: 'Caisse supprimée' });
    fetchData();
  };

  const openEdit = (c: Caisse) => {
    setEditing(c);
    setForm({ code_caisse: c.code_caisse, nom_caisse: c.nom_caisse, zone_region: c.zone_region || '' });
    setDialogOpen(true);
  };

  const filtered = caisses.filter(c =>
    [c.code_caisse, c.nom_caisse, c.zone_region].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Table des Caisses</h1>
        <p className="text-muted-foreground mt-1">Correspondance code caisse → nom de caisse pour la génération de dossiers</p>
      </div>

      {/* Examples */}
      <div className="flex gap-3 flex-wrap">
        <Badge variant="secondary" className="gap-1"><MapPin className="h-3 w-3" /> 254 → Plateaux de 15 ans</Badge>
        <Badge variant="secondary" className="gap-1"><MapPin className="h-3 w-3" /> 310 → Bacongo</Badge>
        <Badge variant="secondary" className="gap-1"><MapPin className="h-3 w-3" /> 420 → Poto-Poto</Badge>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setForm({ code_caisse: '', nom_caisse: '', zone_region: '' }); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Ajouter</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Modifier' : 'Ajouter'} une caisse</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Code caisse</Label>
                <Input value={form.code_caisse} onChange={e => setForm(f => ({ ...f, code_caisse: e.target.value }))} placeholder="ex: 254" />
              </div>
              <div className="space-y-2">
                <Label>Nom de la caisse</Label>
                <Input value={form.nom_caisse} onChange={e => setForm(f => ({ ...f, nom_caisse: e.target.value }))} placeholder="ex: Plateaux de 15 ans" />
              </div>
              <div className="space-y-2">
                <Label>Zone / Région</Label>
                <Input value={form.zone_region} onChange={e => setForm(f => ({ ...f, zone_region: e.target.value }))} placeholder="ex: Brazzaville" />
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
                <TableHead>Code Caisse</TableHead>
                <TableHead>Nom de la Caisse</TableHead>
                <TableHead>Zone / Région</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucune caisse enregistrée</TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-bold">{c.code_caisse}</TableCell>
                  <TableCell>{c.nom_caisse}</TableCell>
                  <TableCell className="text-muted-foreground">{c.zone_region || '—'}</TableCell>
                  <TableCell>
                    <Badge className={c.is_active ? 'status-valid' : 'status-invalid'}>
                      {c.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </TableCell>
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
