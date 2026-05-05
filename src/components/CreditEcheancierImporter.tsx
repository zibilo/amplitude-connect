import { GenericExcelImporter, transformers } from './GenericExcelImporter';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

/**
 * Import des échéanciers — nécessite que les engagements existent au préalable.
 * Le composant résout engagement_id à partir de numero_pret avant insertion.
 */
export function CreditEcheancierImporter() {
  const [engagementMap, setEngagementMap] = useState<Map<string, string> | null>(null);

  const loadEngagements = async () => {
    const { data } = await supabase.from('cl_engagement').select('id, numero_pret');
    const m = new Map<string, string>();
    data?.forEach((e) => m.set(e.numero_pret, e.id));
    setEngagementMap(m);
    return m;
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Les engagements (CL_ENGAGEMENT) doivent être importés <strong>avant</strong> les échéanciers.
          Le numéro de prêt doit correspondre exactement.
        </AlertDescription>
      </Alert>
      <GenericExcelImporter
        title="Import Échéancier de Crédit"
        description="Calendrier mensuel de remboursement (CL_ECHEANCIER)"
        tableName="cl_echeancier"
        columns={[
          { dbField: 'numero_pret', aliases: ['numero_pret', 'pret'], required: true, transform: transformers.text },
          { dbField: 'matricule', aliases: ['matricule', 'mat'], required: true, transform: transformers.text },
          { dbField: 'numero_echeance', aliases: ['numero_echeance', 'echeance', 'no'], required: true, transform: transformers.integer },
          { dbField: 'date_prelevement', aliases: ['date_prelevement', 'date'], required: true, transform: transformers.date },
          { dbField: 'capital', aliases: ['capital'], transform: transformers.number },
          { dbField: 'interets', aliases: ['interets', 'interêts', 'interet'], transform: transformers.number },
          { dbField: 'assurance', aliases: ['assurance'], transform: transformers.number },
          { dbField: 'montant_total', aliases: ['montant_total', 'montant'], required: true, transform: transformers.number },
          { dbField: 'statut', aliases: ['statut', 'status'], transform: (v) => (v ? String(v).toUpperCase() : 'A_PAYER') },
        ]}
        templateRows={[
          {
            numero_pret: 'PRT-2026-001',
            matricule: '00123',
            numero_echeance: 1,
            date_prelevement: '2026-02-15',
            capital: 130000,
            interets: 25000,
            assurance: 3000,
            montant_total: 158000,
            statut: 'A_PAYER',
          },
        ]}
        buildRow={(row) => {
          // engagement_id needs to be resolved; we let the user click "Charger engagements" first
          if (!engagementMap) {
            return null;
          }
          const id = engagementMap.get(String(row.numero_pret));
          if (!id) return null;
          const { numero_pret, ...rest } = row;
          return { ...rest, numero_pret, engagement_id: id };
        }}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Étape 1 — Charger la liste des engagements</CardTitle>
          <CardDescription>
            Cliquez ci-dessous pour récupérer les numéros de prêt existants en base avant l'import.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <button
            onClick={async () => {
              const m = await loadEngagements();
              alert(`${m.size} engagements chargés. Vous pouvez maintenant importer l'échéancier.`);
            }}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
          >
            {engagementMap ? `✓ ${engagementMap.size} engagements chargés` : 'Charger les engagements'}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}