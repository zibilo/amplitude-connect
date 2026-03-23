import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { GitBranch, Plus, Edit, Trash2, Search, CheckCircle2, XCircle, Gavel, PiggyBank, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

interface SplittingRule {
  id: string;
  rule_name: string;
  rule_type: string;
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
  // Garnishment fields
  beneficiaire_nom: string | null;
  beneficiaire_rib: string | null;
  reference_juridique: string | null;
  motif_saisie: string | null;
  montant_saisie: number | null;
  plafond_total: number | null;
  total_deja_preleve: number | null;
  date_debut: string | null;
  date_fin: string | null;
  created_at: string;
}

const defaultForm = {
  rule_name: '',
  rule_type: 'VENTILATION',
  matricule: '',
  id_societaire: '',
  employeur_code: '',
  percentage_courant: 60,
  percentage_epargne: 40,
  rib_courant_cible: '',
  rib_epargne_cible: '',
  montant_minimum_split: 10000,
  is_active: true,
  priority: 1,
  beneficiaire_nom: '',
  beneficiaire_rib: '',
  reference_juridique: '',
  motif_saisie: '',
  montant_saisie: 0,
  plafond_total: 0,
  date_debut: '',
  date_fin: '',
};

export function SplittingRulesManager() {
  const [rules, setRules] = useState<SplittingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SplittingRule | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();
  const [formData, setFormData] = useState({ ...defaultForm });

  useEffect(() => { fetchRules(); }, []);

  const fetchRules = async () => {
    try {
      const { data, error } = await (supabase
        .from('splitting_rules')
        .select('*')
        .order('priority', { ascending: false }) as any);
      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error fetching splitting rules:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger les règles', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.rule_type === 'VENTILATION' && formData.percentage_courant + formData.percentage_epargne !== 100) {
      toast({ title: 'Erreur', description: 'La somme des pourcentages doit être égale à 100%', variant: 'destructive' });
      return;
    }

    if (formData.rule_type === 'SAISIE_ARRET' && !formData.beneficiaire_nom) {
      toast({ title: 'Erreur', description: 'Le nom du bénéficiaire est obligatoire pour une saisie arrêt', variant: 'destructive' });
      return;
    }

    try {
      const data: any = {
        rule_name: formData.rule_name,
        rule_type: formData.rule_type,
        matricule: formData.matricule || null,
        id_societaire: formData.id_societaire || null,
        employeur_code: formData.employeur_code || null,
        percentage_courant: formData.rule_type === 'SAISIE_ARRET' ? 100 : formData.percentage_courant,
        percentage_epargne: formData.rule_type === 'SAISIE_ARRET' ? 0 : formData.percentage_epargne,
        rib_courant_cible: formData.rib_courant_cible || null,
        rib_epargne_cible: formData.rib_epargne_cible || null,
        montant_minimum_split: formData.montant_minimum_split,
        is_active: formData.is_active,
        priority: formData.priority,
        beneficiaire_nom: formData.beneficiaire_nom || null,
        beneficiaire_rib: formData.beneficiaire_rib || null,
        reference_juridique: formData.reference_juridique || null,
        motif_saisie: formData.motif_saisie || null,
        montant_saisie: formData.montant_saisie || null,
        plafond_total: formData.plafond_total || null,
        date_debut: formData.date_debut || null,
        date_fin: formData.date_fin || null,
      };

      if (editingRule) {
        const { error } = await (supabase.from('splitting_rules').update(data).eq('id', editingRule.id) as any);
        if (error) throw error;
        toast({ title: 'Succès', description: 'Règle mise à jour' });
      } else {
        const { error } = await (supabase.from('splitting_rules').insert(data) as any);
        if (error) throw error;
        toast({ title: 'Succès', description: 'Règle créée' });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchRules();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder la règle', variant: 'destructive' });
    }
  };

  const handleEdit = (rule: SplittingRule) => {
    setEditingRule(rule);
    setFormData({
      rule_name: rule.rule_name,
      rule_type: rule.rule_type || 'VENTILATION',
      matricule: rule.matricule || '',
      id_societaire: rule.id_societaire || '',
      employeur_code: rule.employeur_code || '',
      percentage_courant: rule.percentage_courant,
      percentage_epargne: rule.percentage_epargne,
      rib_courant_cible: rule.rib_courant_cible || '',
      rib_epargne_cible: rule.rib_epargne_cible || '',
      montant_minimum_split: rule.montant_minimum_split || 10000,
      is_active: rule.is_active ?? true,
      priority: rule.priority || 1,
      beneficiaire_nom: rule.beneficiaire_nom || '',
      beneficiaire_rib: rule.beneficiaire_rib || '',
      reference_juridique: rule.reference_juridique || '',
      motif_saisie: rule.motif_saisie || '',
      montant_saisie: rule.montant_saisie || 0,
      plafond_total: rule.plafond_total || 0,
      date_debut: rule.date_debut || '',
      date_fin: rule.date_fin || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette règle ?')) return;
    try {
      const { error } = await supabase.from('splitting_rules').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Succès', description: 'Règle supprimée' });
      fetchRules();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de supprimer la règle', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setEditingRule(null);
    setFormData({ ...defaultForm });
  };

  const filteredRules = rules.filter(r => {
    const matchesSearch = r.rule_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.matricule && r.matricule.includes(searchTerm)) ||
      (r.beneficiaire_nom && r.beneficiaire_nom.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'ventilation') return matchesSearch && r.rule_type === 'VENTILATION';
    if (activeTab === 'saisie') return matchesSearch && r.rule_type === 'SAISIE_ARRET';
    return matchesSearch;
  });

  const saisieCount = rules.filter(r => r.rule_type === 'SAISIE_ARRET' && r.is_active).length;
  const ventilationCount = rules.filter(r => r.rule_type === 'VENTILATION' && r.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Moteur de Règles</h1>
          <p className="text-muted-foreground mt-1">
            Saisies Arrêts, Ventilation Épargne & Triple Check
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle Règle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Modifier la règle' : 'Nouvelle règle'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Rule Type Selector */}
              <div className="space-y-2">
                <Label>Type de Règle</Label>
                <Select
                  value={formData.rule_type}
                  onValueChange={v => setFormData(prev => ({ ...prev, rule_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VENTILATION">
                      <span className="flex items-center gap-2"><PiggyBank className="h-4 w-4" /> Ventilation Épargne</span>
                    </SelectItem>
                    <SelectItem value="SAISIE_ARRET">
                      <span className="flex items-center gap-2"><Gavel className="h-4 w-4" /> Saisie Arrêt (Judiciaire)</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom de la règle *</Label>
                  <Input value={formData.rule_name} onChange={e => setFormData(prev => ({ ...prev, rule_name: e.target.value }))} placeholder="Ex: Saisie Thomas DUPONT" required />
                </div>
                <div className="space-y-2">
                  <Label>Matricule *</Label>
                  <Input value={formData.matricule} onChange={e => setFormData(prev => ({ ...prev, matricule: e.target.value }))} placeholder="Matricule de l'employé" />
                </div>
              </div>

              {/* SAISIE ARRET specific fields */}
              {formData.rule_type === 'SAISIE_ARRET' && (
                <div className="space-y-4 p-4 border-2 border-destructive/30 rounded-lg bg-destructive/5">
                  <div className="flex items-center gap-2 text-destructive font-semibold">
                    <Gavel className="h-5 w-5" />
                    Informations Judiciaires
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Bénéficiaire (Nom) *</Label>
                      <Input value={formData.beneficiaire_nom} onChange={e => setFormData(prev => ({ ...prev, beneficiaire_nom: e.target.value }))} placeholder="Ex: Mme DUPONT Marie" />
                    </div>
                    <div className="space-y-2">
                      <Label>RIB Bénéficiaire</Label>
                      <Input value={formData.beneficiaire_rib} onChange={e => setFormData(prev => ({ ...prev, beneficiaire_rib: e.target.value }))} placeholder="RIB du bénéficiaire" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Référence Juridique</Label>
                      <Input value={formData.reference_juridique} onChange={e => setFormData(prev => ({ ...prev, reference_juridique: e.target.value }))} placeholder="N° du jugement" />
                    </div>
                    <div className="space-y-2">
                      <Label>Motif</Label>
                      <Select value={formData.motif_saisie} onValueChange={v => setFormData(prev => ({ ...prev, motif_saisie: v }))}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENSION_ALIMENTAIRE">Pension Alimentaire</SelectItem>
                          <SelectItem value="DETTE_FISCALE">Dette Fiscale</SelectItem>
                          <SelectItem value="HUISSIER">Huissier</SelectItem>
                          <SelectItem value="PRET_INTERNE">Prêt Interne Banque</SelectItem>
                          <SelectItem value="AUTRE">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Montant à retenir (XAF) *</Label>
                      <Input type="number" value={formData.montant_saisie} onChange={e => setFormData(prev => ({ ...prev, montant_saisie: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Plafond Total (XAF)</Label>
                      <Input type="number" value={formData.plafond_total} onChange={e => setFormData(prev => ({ ...prev, plafond_total: Number(e.target.value) }))} placeholder="0 = illimité" />
                    </div>
                    <div className="space-y-2">
                      <Label>Priorité</Label>
                      <Input type="number" value={formData.priority} onChange={e => setFormData(prev => ({ ...prev, priority: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date Début</Label>
                      <Input type="date" value={formData.date_debut} onChange={e => setFormData(prev => ({ ...prev, date_debut: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Date Fin</Label>
                      <Input type="date" value={formData.date_fin} onChange={e => setFormData(prev => ({ ...prev, date_fin: e.target.value }))} />
                    </div>
                  </div>
                </div>
              )}

              {/* VENTILATION specific fields */}
              {formData.rule_type === 'VENTILATION' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>RIB Compte Courant</Label>
                      <Input value={formData.rib_courant_cible} onChange={e => setFormData(prev => ({ ...prev, rib_courant_cible: e.target.value }))} placeholder="RIB du compte courant" />
                    </div>
                    <div className="space-y-2">
                      <Label>RIB Compte Épargne</Label>
                      <Input value={formData.rib_epargne_cible} onChange={e => setFormData(prev => ({ ...prev, rib_epargne_cible: e.target.value }))} placeholder="RIB du compte épargne" />
                    </div>
                  </div>
                  <div className="space-y-4 p-4 bg-muted rounded-lg">
                    <Label>Répartition Courant / Épargne</Label>
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
                        ...prev, percentage_courant: value, percentage_epargne: 100 - value
                      }))}
                      min={0} max={100} step={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Montant Minimum (XAF)</Label>
                    <Input type="number" value={formData.montant_minimum_split} onChange={e => setFormData(prev => ({ ...prev, montant_minimum_split: Number(e.target.value) }))} />
                  </div>
                </>
              )}

              <div className="flex items-center gap-2">
                <Switch checked={formData.is_active} onCheckedChange={checked => setFormData(prev => ({ ...prev, is_active: checked }))} />
                <Label>Règle active</Label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>Annuler</Button>
                <Button type="submit">{editingRule ? 'Mettre à jour' : 'Créer'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Gavel className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{saisieCount}</p>
                <p className="text-sm text-muted-foreground">Saisies Arrêts actives</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <PiggyBank className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{ventilationCount}</p>
                <p className="text-sm text-muted-foreground">Ventilations Épargne actives</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <GitBranch className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rules.filter(r => r.is_active).length}</p>
                <p className="text-sm text-muted-foreground">Règles totales actives</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table with Tabs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">Toutes ({rules.length})</TabsTrigger>
                <TabsTrigger value="saisie" className="gap-1">
                  <Gavel className="h-3 w-3" /> Saisies Arrêts
                </TabsTrigger>
                <TabsTrigger value="ventilation" className="gap-1">
                  <PiggyBank className="h-3 w-3" /> Ventilation
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : filteredRules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Aucune règle trouvée' : 'Aucune règle enregistrée'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Règle</TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Détail</TableHead>
                  <TableHead>Progression</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map(rule => (
                  <TableRow key={rule.id} className={!rule.is_active ? 'opacity-50' : ''}>
                    <TableCell>
                      {rule.rule_type === 'SAISIE_ARRET' ? (
                        <Badge variant="destructive" className="gap-1">
                          <Gavel className="h-3 w-3" /> Saisie
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 bg-green-500/20 text-green-700">
                          <PiggyBank className="h-3 w-3" /> Épargne
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>{rule.rule_name}</div>
                      {rule.rule_type === 'SAISIE_ARRET' && rule.beneficiaire_nom && (
                        <div className="text-xs text-muted-foreground">→ {rule.beneficiaire_nom}</div>
                      )}
                      {rule.motif_saisie && (
                        <Badge variant="outline" className="text-xs mt-1">{rule.motif_saisie.replace('_', ' ')}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {rule.matricule ? (
                        <code className="px-2 py-1 bg-muted rounded text-sm">{rule.matricule}</code>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {rule.rule_type === 'SAISIE_ARRET' ? (
                        <div className="text-sm">
                          <span className="font-semibold">{(rule.montant_saisie || 0).toLocaleString()} XAF</span>
                          <span className="text-muted-foreground">/mois</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="default">{rule.percentage_courant}%</Badge>
                          <span>/</span>
                          <Badge variant="secondary" className="bg-green-500/20 text-green-600">{rule.percentage_epargne}%</Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {rule.rule_type === 'SAISIE_ARRET' && rule.plafond_total && rule.plafond_total > 0 ? (
                        <div className="space-y-1 w-32">
                          <Progress value={((rule.total_deja_preleve || 0) / rule.plafond_total) * 100} className="h-2" />
                          <div className="text-xs text-muted-foreground">
                            {(rule.total_deja_preleve || 0).toLocaleString()} / {rule.plafond_total.toLocaleString()}
                          </div>
                          {(rule.total_deja_preleve || 0) >= rule.plafond_total && (
                            <Badge variant="default" className="text-xs bg-green-600">Soldé ✓</Badge>
                          )}
                        </div>
                      ) : rule.rule_type === 'SAISIE_ARRET' ? (
                        <span className="text-xs text-muted-foreground">Illimité</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
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
