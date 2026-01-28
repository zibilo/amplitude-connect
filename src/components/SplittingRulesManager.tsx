import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
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
import { GitBranch, Plus, Edit, Trash2, Search, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SplittingRule {
  id: string;
  rule_name: string;
  matricule: string | null;
  id_societaire: string | null;
  employeur_code: string | null;
  percentage_courant: number;
  percentage_epargne: number;
  rib_courant_cible: string | null;
  rib_epargne_cible: string | null;
  montant_minimum_split: number | null;
  is_active: boolean | null;
  identity_verified: boolean | null;
  priority: number | null;
  created_at: string;
}

export function SplittingRulesManager() {
  const [rules, setRules] = useState<SplittingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SplittingRule | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    rule_name: '',
    matricule: '',
    id_societaire: '',
    employeur_code: '',
    percentage_courant: 60,
    percentage_epargne: 40,
    rib_courant_cible: '',
    rib_epargne_cible: '',
    montant_minimum_split: 10000,
    is_active: true,
    priority: 1
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const { data, error } = await supabase
        .from('splitting_rules')
        .select('*')
        .order('priority', { ascending: false });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error fetching splitting rules:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les règles de splitting',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate percentages
    if (formData.percentage_courant + formData.percentage_epargne !== 100) {
      toast({
        title: 'Erreur',
        description: 'La somme des pourcentages doit être égale à 100%',
        variant: 'destructive'
      });
      return;
    }

    try {
      const data = {
        rule_name: formData.rule_name,
        matricule: formData.matricule || null,
        id_societaire: formData.id_societaire || null,
        employeur_code: formData.employeur_code || null,
        percentage_courant: formData.percentage_courant,
        percentage_epargne: formData.percentage_epargne,
        rib_courant_cible: formData.rib_courant_cible || null,
        rib_epargne_cible: formData.rib_epargne_cible || null,
        montant_minimum_split: formData.montant_minimum_split,
        is_active: formData.is_active,
        priority: formData.priority
      };

      if (editingRule) {
        const { error } = await supabase
          .from('splitting_rules')
          .update(data)
          .eq('id', editingRule.id);

        if (error) throw error;
        toast({ title: 'Succès', description: 'Règle mise à jour' });
      } else {
        const { error } = await supabase
          .from('splitting_rules')
          .insert(data);

        if (error) throw error;
        toast({ title: 'Succès', description: 'Règle créée' });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchRules();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder la règle',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (rule: SplittingRule) => {
    setEditingRule(rule);
    setFormData({
      rule_name: rule.rule_name,
      matricule: rule.matricule || '',
      id_societaire: rule.id_societaire || '',
      employeur_code: rule.employeur_code || '',
      percentage_courant: rule.percentage_courant,
      percentage_epargne: rule.percentage_epargne,
      rib_courant_cible: rule.rib_courant_cible || '',
      rib_epargne_cible: rule.rib_epargne_cible || '',
      montant_minimum_split: rule.montant_minimum_split || 10000,
      is_active: rule.is_active ?? true,
      priority: rule.priority || 1
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette règle ?')) return;

    try {
      const { error } = await supabase
        .from('splitting_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Succès', description: 'Règle supprimée' });
      fetchRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer la règle',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setEditingRule(null);
    setFormData({
      rule_name: '',
      matricule: '',
      id_societaire: '',
      employeur_code: '',
      percentage_courant: 60,
      percentage_epargne: 40,
      rib_courant_cible: '',
      rib_epargne_cible: '',
      montant_minimum_split: 10000,
      is_active: true,
      priority: 1
    });
  };

  const filteredRules = rules.filter(r =>
    r.rule_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.matricule && r.matricule.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Règles de Splitting</h1>
          <p className="text-muted-foreground mt-1">
            Configuration de la répartition Courant/Épargne par employé
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle Règle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Modifier la règle' : 'Nouvelle règle de splitting'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rule_name">Nom de la règle *</Label>
                  <Input
                    id="rule_name"
                    value={formData.rule_name}
                    onChange={e => setFormData(prev => ({ ...prev, rule_name: e.target.value }))}
                    placeholder="Ex: Split Jean DUPONT"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="matricule">Matricule</Label>
                  <Input
                    id="matricule"
                    value={formData.matricule}
                    onChange={e => setFormData(prev => ({ ...prev, matricule: e.target.value }))}
                    placeholder="Matricule de l'employé"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rib_courant_cible">RIB Compte Courant</Label>
                  <Input
                    id="rib_courant_cible"
                    value={formData.rib_courant_cible}
                    onChange={e => setFormData(prev => ({ ...prev, rib_courant_cible: e.target.value }))}
                    placeholder="RIB du compte courant"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rib_epargne_cible">RIB Compte Épargne</Label>
                  <Input
                    id="rib_epargne_cible"
                    value={formData.rib_epargne_cible}
                    onChange={e => setFormData(prev => ({ ...prev, rib_epargne_cible: e.target.value }))}
                    placeholder="RIB du compte épargne"
                  />
                </div>
              </div>

              {/* Percentage Slider */}
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <Label>Répartition</Label>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-primary rounded" />
                    Courant: {formData.percentage_courant}%
                  </span>
                  <span className="flex items-center gap-2">
                    Épargne: {formData.percentage_epargne}%
                    <div className="w-3 h-3 bg-green-500 rounded" />
                  </span>
                </div>
                <Slider
                  value={[formData.percentage_courant]}
                  onValueChange={([value]) => setFormData(prev => ({
                    ...prev,
                    percentage_courant: value,
                    percentage_epargne: 100 - value
                  }))}
                  min={0}
                  max={100}
                  step={5}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="montant_minimum">Montant Minimum (FCFA)</Label>
                  <Input
                    id="montant_minimum"
                    type="number"
                    value={formData.montant_minimum_split}
                    onChange={e => setFormData(prev => ({ ...prev, montant_minimum_split: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priorité</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={e => setFormData(prev => ({ ...prev, priority: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={checked => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label>Règle active</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                  Annuler
                </Button>
                <Button type="submit">
                  {editingRule ? 'Mettre à jour' : 'Créer'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              Règles de Répartition ({filteredRules.length})
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
          ) : filteredRules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Aucune règle trouvée' : 'Aucune règle de splitting enregistrée'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Règle</TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Répartition</TableHead>
                  <TableHead>Minimum</TableHead>
                  <TableHead>Identité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map(rule => (
                  <TableRow key={rule.id} className={!rule.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{rule.rule_name}</TableCell>
                    <TableCell>
                      {rule.matricule ? (
                        <code className="px-2 py-1 bg-muted rounded text-sm">{rule.matricule}</code>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">{rule.percentage_courant}%</Badge>
                        <span>/</span>
                        <Badge variant="secondary" className="bg-green-500/20 text-green-600">
                          {rule.percentage_epargne}%
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {(rule.montant_minimum_split || 0).toLocaleString()} FCFA
                    </TableCell>
                    <TableCell>
                      {rule.identity_verified ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Vérifié
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Non vérifié
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch checked={rule.is_active ?? true} disabled />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
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
