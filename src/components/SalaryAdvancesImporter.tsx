import { GenericExcelImporter, transformers } from './GenericExcelImporter';

export function SalaryAdvancesImporter() {
  return (
    <GenericExcelImporter
      title="Import Avances sur Salaire"
      description="Avances accordées par l'employeur à déduire de la paie"
      tableName="salary_advances"
      columns={[
        { dbField: 'matricule', aliases: ['matricule', 'mat'], required: true, transform: transformers.text },
        { dbField: 'nom_employe', aliases: ['nom_employe', 'nom', 'employe'], transform: transformers.upper },
        { dbField: 'periode', aliases: ['periode', 'période', 'mois'], required: true, transform: transformers.text },
        { dbField: 'montant', aliases: ['montant', 'amount'], required: true, transform: transformers.number },
        { dbField: 'motif', aliases: ['motif', 'raison'], transform: transformers.text },
        { dbField: 'date_avance', aliases: ['date_avance', 'date'], required: true, transform: transformers.date },
        { dbField: 'deduit', aliases: ['deduit', 'paye'], transform: (v) => v === true || String(v).toLowerCase() === 'oui' || String(v) === '1' },
      ]}
      templateRows={[
        {
          matricule: '00123',
          nom_employe: 'DUPONT JEAN',
          periode: '02/2026',
          montant: 75000,
          motif: 'Avance sur salaire février',
          date_avance: '2026-01-20',
          deduit: 'non',
        },
      ]}
    />
  );
}