import { GenericExcelImporter, transformers } from './GenericExcelImporter';

export function CreditEngagementImporter() {
  return (
    <GenericExcelImporter
      title="Import Engagements de Crédit"
      description="Liste des dossiers de crédits actifs (CL_ENGAGEMENT)"
      tableName="cl_engagement"
      columns={[
        { dbField: 'numero_pret', aliases: ['numero_pret', 'numero pret', 'pret', 'loan'], required: true, transform: transformers.text },
        { dbField: 'matricule', aliases: ['matricule', 'mat'], required: true, transform: transformers.text },
        { dbField: 'nom_client', aliases: ['nom_client', 'nom', 'client'], transform: transformers.upper },
        { dbField: 'montant_total', aliases: ['montant_total', 'montant total', 'montant'], required: true, transform: transformers.number },
        { dbField: 'capital_restant', aliases: ['capital_restant', 'capital restant', 'rcrd'], transform: transformers.number },
        { dbField: 'taux_interet', aliases: ['taux_interet', 'taux', 'interet'], transform: transformers.number },
        { dbField: 'duree_mois', aliases: ['duree_mois', 'duree', 'mois'], required: true, transform: transformers.integer },
        { dbField: 'mensualite', aliases: ['mensualite', 'echeance mensuelle'], transform: transformers.number },
        { dbField: 'date_debut', aliases: ['date_debut', 'date debut', 'debut'], required: true, transform: transformers.date },
        { dbField: 'date_fin', aliases: ['date_fin', 'date fin', 'fin'], required: true, transform: transformers.date },
        { dbField: 'rib_remboursement', aliases: ['rib_remboursement', 'rib', 'compte'], transform: transformers.text },
        { dbField: 'compte_remboursement_interne', aliases: ['compte_remboursement_interne', 'compte interne'], transform: transformers.text },
        { dbField: 'id_societaire', aliases: ['id_societaire', 'societaire'], transform: transformers.text },
      ]}
      templateRows={[
        {
          numero_pret: 'PRT-2026-001',
          matricule: '00123',
          nom_client: 'DUPONT JEAN',
          montant_total: 5000000,
          capital_restant: 4500000,
          taux_interet: 8.5,
          duree_mois: 36,
          mensualite: 158000,
          date_debut: '2026-01-15',
          date_fin: '2029-01-15',
          rib_remboursement: '30001007941234567890185',
          compte_remboursement_interne: '38100000123',
          id_societaire: 'SOC-001',
        },
      ]}
    />
  );
}