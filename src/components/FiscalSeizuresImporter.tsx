import { GenericExcelImporter, transformers } from './GenericExcelImporter';

export function FiscalSeizuresImporter() {
  return (
    <GenericExcelImporter
      title="Import Saisies Fiscales (SATD)"
      description="Saisies-attribution à tiers détenteur (priorité absolue sur la paie)"
      tableName="fiscal_seizures"
      columns={[
        { dbField: 'reference_satd', aliases: ['reference_satd', 'reference', 'ref'], required: true, transform: transformers.text },
        { dbField: 'matricule', aliases: ['matricule', 'mat'], required: true, transform: transformers.text },
        { dbField: 'nom_employe', aliases: ['nom_employe', 'nom', 'employe'], transform: transformers.upper },
        { dbField: 'organisme', aliases: ['organisme', 'tresor'], transform: (v) => (v ? String(v).trim() : 'TRESOR_PUBLIC') },
        { dbField: 'motif', aliases: ['motif', 'objet'], transform: transformers.text },
        { dbField: 'rib_beneficiaire', aliases: ['rib_beneficiaire', 'rib', 'compte beneficiaire'], required: true, transform: transformers.text },
        { dbField: 'montant_du', aliases: ['montant_du', 'montant'], required: true, transform: transformers.number },
        { dbField: 'plafond_mensuel', aliases: ['plafond_mensuel', 'plafond'], transform: transformers.number },
        { dbField: 'date_notification', aliases: ['date_notification', 'notification'], required: true, transform: transformers.date },
        { dbField: 'date_debut', aliases: ['date_debut', 'debut'], required: true, transform: transformers.date },
        { dbField: 'date_fin', aliases: ['date_fin', 'fin'], transform: transformers.date },
        { dbField: 'priorite', aliases: ['priorite', 'priority'], transform: transformers.integer },
        { dbField: 'statut', aliases: ['statut', 'status'], transform: (v) => (v ? String(v).toUpperCase() : 'ACTIVE') },
      ]}
      templateRows={[
        {
          reference_satd: 'SATD-2026-0001',
          matricule: '00123',
          nom_employe: 'DUPONT JEAN',
          organisme: 'TRESOR_PUBLIC',
          motif: 'Impôts impayés 2025',
          rib_beneficiaire: '30001000010000000000099',
          montant_du: 850000,
          plafond_mensuel: 100000,
          date_notification: '2026-01-10',
          date_debut: '2026-02-01',
          date_fin: '',
          priorite: 1,
          statut: 'ACTIVE',
        },
      ]}
    />
  );
}