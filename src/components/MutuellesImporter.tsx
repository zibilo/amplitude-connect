import { GenericExcelImporter, transformers } from './GenericExcelImporter';

export function MutuellesImporter() {
  return (
    <div className="space-y-6">
      <GenericExcelImporter
        title="Import Mutuelles"
        description="Mutuelles d'entreprise et comptes groupes"
        tableName="mutuelles"
        columns={[
          { dbField: 'code_mutuelle', aliases: ['code_mutuelle', 'code'], required: true, transform: transformers.upper },
          { dbField: 'nom_mutuelle', aliases: ['nom_mutuelle', 'nom'], required: true, transform: transformers.upper },
          { dbField: 'compte_groupe', aliases: ['compte_groupe', 'compte', 'rib'], required: true, transform: transformers.text },
          { dbField: 'cotisation_defaut', aliases: ['cotisation_defaut', 'cotisation'], transform: transformers.number },
          { dbField: 'is_active', aliases: ['is_active', 'actif'], transform: (v) => v !== false && String(v).toLowerCase() !== 'non' && String(v) !== '0' },
        ]}
        templateRows={[
          {
            code_mutuelle: 'MUT-001',
            nom_mutuelle: 'MUTUELLE DES AGENTS',
            compte_groupe: '38100000999',
            cotisation_defaut: 5000,
            is_active: 'oui',
          },
        ]}
      />

      <GenericExcelImporter
        title="Import Adhérents Mutuelles"
        description="Liste des employés cotisant à une mutuelle (saisir mutuelle_id)"
        tableName="mutuelle_members"
        columns={[
          { dbField: 'mutuelle_id', aliases: ['mutuelle_id', 'id mutuelle'], required: true, transform: transformers.text },
          { dbField: 'matricule', aliases: ['matricule', 'mat'], required: true, transform: transformers.text },
          { dbField: 'nom_employe', aliases: ['nom_employe', 'nom'], transform: transformers.upper },
          { dbField: 'cotisation', aliases: ['cotisation', 'montant'], required: true, transform: transformers.number },
          { dbField: 'date_adhesion', aliases: ['date_adhesion', 'adhesion'], transform: transformers.date },
          { dbField: 'is_active', aliases: ['is_active', 'actif'], transform: (v) => v !== false && String(v).toLowerCase() !== 'non' && String(v) !== '0' },
        ]}
        templateRows={[
          {
            mutuelle_id: '00000000-0000-0000-0000-000000000000',
            matricule: '00123',
            nom_employe: 'DUPONT JEAN',
            cotisation: 5000,
            date_adhesion: '2026-01-01',
            is_active: 'oui',
          },
        ]}
      />
    </div>
  );
}