import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Building2, Plus, Edit, Trash2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type FeeOption = 'OUI' | 'NON' | 'DEUXIEME_FLUX';

interface CompanyProfile {
  id: string;
  nom_entreprise: string;
  code_client: string;
  fee_option: FeeOption;
  montant_frais: number | null;
  contact_email: string | null;
  contact_telephone: string | null;
  adresse: string | null;
  compte_prelevement: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

const FEE_OPTION_LABELS: Record<FeeOption, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  OUI: { label: 'Standard (2000 FCFA)', variant: 'default' },
  NON: { label: 'Exonéré (0 FCFA)', variant: 'secondary' },
  DEUXIEME_FLUX: { label: '2ème Flux', variant: 'outline' }
};

export function CompanyProfilesManager() {
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyProfile | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    nom_entreprise: '',
    code_client: '',
    fee_option: 'OUI' as FeeOption,
    montant_frais: 2000,
    contact_email: '',
    contact_telephone: '',
    adresse: '',
    compte_prelevement: ''
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('company_profiles')
        .select('*')
        .order('nom_entreprise');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les entreprises',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingCompany) {
        const { error } = await supabase
          .from('company_profiles')
          .update({
            nom_entreprise: formData.nom_entreprise,
            code_client: formData.code_client,
            fee_option: formData.fee_option,
            montant_frais: formData.fee_option === 'NON' ? 0 : formData.montant_frais,
            contact_email: formData.contact_email || null,
            contact_telephone: formData.contact_telephone || null,
            adresse: formData.adresse || null,
            compte_prelevement: formData.compte_prelevement || null
          })
          .eq('id', editingCompany.id);

        if (error) throw error;
        toast({ title: 'Succès', description: 'Entreprise mise à jour' });
      } else {
        const { error } = await supabase
          .from('company_profiles')
          .insert({
            nom_entreprise: formData.nom_entreprise,
            code_client: formData.code_client,
            fee_option: formData.fee_option,
            montant_frais: formData.fee_option === 'NON' ? 0 : formData.montant_frais,
            contact_email: formData.contact_email || null,
            contact_telephone: formData.contact_telephone || null,
            adresse: formData.adresse || null,
            compte_prelevement: formData.compte_prelevement || null
          });

        if (error) throw error;
        toast({ title: 'Succès', description: 'Entreprise créée' });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchCompanies();
    } catch (error) {
      console.error('Error saving company:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder l\'entreprise',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (company: CompanyProfile) => {
    setEditingCompany(company);
    setFormData({
      nom_entreprise: company.nom_entreprise,
      code_client: company.code_client,
      fee_option: company.fee_option,
      montant_frais: company.montant_frais || 2000,
      contact_email: company.contact_email || '',
      contact_telephone: company.contact_telephone || '',
      adresse: company.adresse || '',
      compte_prelevement: company.compte_prelevement || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette entreprise ?')) return;

    try {
      const { error } = await supabase
        .from('company_profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Succès', description: 'Entreprise supprimée' });
      fetchCompanies();
    } catch (error) {
      console.error('Error deleting company:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer l\'entreprise',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setEditingCompany(null);
    setFormData({
      nom_entreprise: '',
      code_client: '',
      fee_option: 'OUI',
      montant_frais: 2000,
      contact_email: '',
      contact_telephone: '',
      adresse: '',
      compte_prelevement: ''
    });
  };

  const filteredCompanies = companies.filter(c =>
    c.nom_entreprise.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code_client.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Profils Entreprises</h1>
          <p className="text-muted-foreground mt-1">
            Gestion des entreprises et de leurs options de facturation
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle Entreprise
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCompany ? 'Modifier l\'entreprise' : 'Nouvelle entreprise'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nom_entreprise">Nom de l'entreprise *</Label>
                  <Input
                    id="nom_entreprise"
                    value={formData.nom_entreprise}
                    onChange={e => setFormData(prev => ({ ...prev, nom_entreprise: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code_client">Code Client *</Label>
                  <Input
                    id="code_client"
                    value={formData.code_client}
                    onChange={e => setFormData(prev => ({ ...prev, code_client: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fee_option">Option de Frais *</Label>
                  <Select
                    value={formData.fee_option}
                    onValueChange={(value: FeeOption) => setFormData(prev => ({ ...prev, fee_option: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OUI">OUI - Standard (2000 FCFA)</SelectItem>
                      <SelectItem value="NON">NON - Exonéré (0 FCFA)</SelectItem>
                      <SelectItem value="DEUXIEME_FLUX">DEUXIÈME_FLUX - Report 2e envoi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="montant_frais">Montant Frais (FCFA)</Label>
                  <Input
                    id="montant_frais"
                    type="number"
                    value={formData.montant_frais}
                    onChange={e => setFormData(prev => ({ ...prev, montant_frais: Number(e.target.value) }))}
                    disabled={formData.fee_option === 'NON'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Email de contact</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={e => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_telephone">Téléphone</Label>
                  <Input
                    id="contact_telephone"
                    value={formData.contact_telephone}
                    onChange={e => setFormData(prev => ({ ...prev, contact_telephone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="compte_prelevement">Compte de Prélèvement</Label>
                <Input
                  id="compte_prelevement"
                  value={formData.compte_prelevement}
                  onChange={e => setFormData(prev => ({ ...prev, compte_prelevement: e.target.value }))}
                  placeholder="RIB du compte à débiter"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adresse">Adresse</Label>
                <Input
                  id="adresse"
                  value={formData.adresse}
                  onChange={e => setFormData(prev => ({ ...prev, adresse: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                  Annuler
                </Button>
                <Button type="submit">
                  {editingCompany ? 'Mettre à jour' : 'Créer'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Liste des Entreprises ({filteredCompanies.length})
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
          ) : filteredCompanies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Aucune entreprise trouvée' : 'Aucune entreprise enregistrée'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entreprise</TableHead>
                  <TableHead>Code Client</TableHead>
                  <TableHead>Option Frais</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map(company => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.nom_entreprise}</TableCell>
                    <TableCell>
                      <code className="px-2 py-1 bg-muted rounded text-sm">{company.code_client}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={FEE_OPTION_LABELS[company.fee_option].variant}>
                        {FEE_OPTION_LABELS[company.fee_option].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {company.fee_option === 'NON' ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span>{(company.montant_frais || 2000).toLocaleString()} FCFA</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {company.contact_email && <div>{company.contact_email}</div>}
                        {company.contact_telephone && <div className="text-muted-foreground">{company.contact_telephone}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(company)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(company.id)}>
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
