import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Landmark, Plus, Edit, Trash2, Search, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CLMAgency {
  id: string;
  nom_clm: string;
  code_banque: string;
  code_guichet: string;
  compte_produit: string;
  compte_commission: string;
  frais_virement: number;
  is_active: boolean | null;
  created_at: string;
}

export function CLMAgencyManager() {
  const [agencies, setAgencies] = useState<CLMAgency[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<CLMAgency | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nom_clm: '',
    code_banque: '',
    code_guichet: '',
    compte_produit: '',
    compte_commission: '',
    frais_virement: 2000,
    is_active: true
  });

  useEffect(() => {
    fetchAgencies();
  }, []);

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('clm_agency_codes')
        .select('*')
        .order('nom_clm');

      if (error) throw error;
      setAgencies(data || []);
    } catch (error) {
      console.error('Error fetching CLM agencies:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les agences CLM',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingAgency) {
        const { error } = await supabase
          .from('clm_agency_codes')
          .update(formData)
          .eq('id', editingAgency.id);

        if (error) throw error;
        toast({ title: 'Succès', description: 'Agence CLM mise à jour' });
      } else {
        const { error } = await supabase
          .from('clm_agency_codes')
          .insert(formData);

        if (error) throw error;
        toast({ title: 'Succès', description: 'Agence CLM créée' });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchAgencies();
    } catch (error) {
      console.error('Error saving CLM agency:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder l\'agence CLM',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (agency: CLMAgency) => {
    setEditingAgency(agency);
    setFormData({
      nom_clm: agency.nom_clm,
      code_banque: agency.code_banque,
      code_guichet: agency.code_guichet,
      compte_produit: agency.compte_produit,
      compte_commission: agency.compte_commission,
      frais_virement: agency.frais_virement,
      is_active: agency.is_active ?? true
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette agence CLM ?')) return;

    try {
      const { error } = await supabase
        .from('clm_agency_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Succès', description: 'Agence CLM supprimée' });
      fetchAgencies();
    } catch (error) {
      console.error('Error deleting CLM agency:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer l\'agence CLM',
        variant: 'destructive'
      });
    }
  };

  const toggleActive = async (agency: CLMAgency) => {
    try {
      const { error } = await supabase
        .from('clm_agency_codes')
        .update({ is_active: !agency.is_active })
        .eq('id', agency.id);

      if (error) throw error;
      fetchAgencies();
    } catch (error) {
      console.error('Error toggling CLM agency status:', error);
    }
  };

  const resetForm = () => {
    setEditingAgency(null);
    setFormData({
      nom_clm: '',
      code_banque: '',
      code_guichet: '',
      compte_produit: '',
      compte_commission: '',
      frais_virement: 2000,
      is_active: true
    });
  };

  const filteredAgencies = agencies.filter(a =>
    a.nom_clm.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.code_guichet.includes(searchTerm)
  );

  const activeCount = agencies.filter(a => a.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agences CLM</h1>
          <p className="text-muted-foreground mt-1">
            Référentiel des Caisses Locales Mutualisées
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle Agence
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingAgency ? 'Modifier l\'agence CLM' : 'Nouvelle agence CLM'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nom_clm">Nom de la CLM *</Label>
                <Input
                  id="nom_clm"
                  value={formData.nom_clm}
                  onChange={e => setFormData(prev => ({ ...prev, nom_clm: e.target.value }))}
                  placeholder="Ex: CLM Brazzaville Centre"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code_banque">Code Banque *</Label>
                  <Input
                    id="code_banque"
                    value={formData.code_banque}
                    onChange={e => setFormData(prev => ({ ...prev, code_banque: e.target.value }))}
                    placeholder="Ex: 00001"
                    maxLength={5}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code_guichet">Code Guichet *</Label>
                  <Input
                    id="code_guichet"
                    value={formData.code_guichet}
                    onChange={e => setFormData(prev => ({ ...prev, code_guichet: e.target.value }))}
                    placeholder="Ex: 00401"
                    maxLength={5}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="compte_produit">Compte Produit *</Label>
                  <Input
                    id="compte_produit"
                    value={formData.compte_produit}
                    onChange={e => setFormData(prev => ({ ...prev, compte_produit: e.target.value }))}
                    placeholder="RIB du compte produit"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compte_commission">Compte Commission *</Label>
                  <Input
                    id="compte_commission"
                    value={formData.compte_commission}
                    onChange={e => setFormData(prev => ({ ...prev, compte_commission: e.target.value }))}
                    placeholder="RIB du compte commission"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="frais_virement">Frais par Virement (FCFA)</Label>
                  <Input
                    id="frais_virement"
                    type="number"
                    value={formData.frais_virement}
                    onChange={e => setFormData(prev => ({ ...prev, frais_virement: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <div className="flex items-center gap-2 pt-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={checked => setFormData(prev => ({ ...prev, is_active: checked }))}
                    />
                    <span>{formData.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                  Annuler
                </Button>
                <Button type="submit">
                  {editingAgency ? 'Mettre à jour' : 'Créer'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Landmark className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Agences</p>
                <p className="text-2xl font-bold">{agencies.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <MapPin className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Actives</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Frais Standard</p>
              <p className="text-2xl font-bold">2,000 <span className="text-sm font-normal">FCFA</span></p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              Référentiel CLM ({filteredAgencies.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : filteredAgencies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Aucune agence trouvée' : 'Aucune agence CLM enregistrée'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom CLM</TableHead>
                  <TableHead>Code Banque</TableHead>
                  <TableHead>Code Guichet</TableHead>
                  <TableHead>Compte Produit</TableHead>
                  <TableHead>Frais</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgencies.map(agency => (
                  <TableRow key={agency.id} className={!agency.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{agency.nom_clm}</TableCell>
                    <TableCell>
                      <code className="px-2 py-1 bg-muted rounded text-sm">{agency.code_banque}</code>
                    </TableCell>
                    <TableCell>
                      <code className="px-2 py-1 bg-primary/10 text-primary rounded text-sm font-bold">
                        {agency.code_guichet}
                      </code>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{agency.compte_produit}</code>
                    </TableCell>
                    <TableCell>{agency.frais_virement.toLocaleString()} FCFA</TableCell>
                    <TableCell>
                      <Switch
                        checked={agency.is_active ?? true}
                        onCheckedChange={() => toggleActive(agency)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(agency)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(agency.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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
