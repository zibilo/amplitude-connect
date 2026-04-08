## Plan de mise en œuvre

### 1. Page Référentiel Sociétaire (`ReferentielManager.tsx`)
- Interface d'import Excel/CSV pour alimenter `account_status_cache`
- Modes "Écraser tout" vs "Mettre à jour"
- Auto-détection des colonnes, nettoyage automatique (majuscules, espaces, clé RIB)
- Rapport d'intégration (ajoutés, mis à jour, rejetés)

### 2. Refonte du format d'import de paie
- Nouveau format : **PÉRIODE | NOM ET PRÉNOM | RIB COMPLET | MONTANT**
- Suppression des colonnes MATRICULE, CODE CAISSE, CCO de l'import
- Mise à jour du parseur Excel et de la validation

### 3. Module de Réconciliation RIB à l'import
- Comparaison automatique RIB fichier vs RIB référentiel (`account_status_cache`)
- Blocage des lignes dont le RIB est inconnu/invalide
- Interface côte à côte (données Excel vs données certifiées)
- Bouton [Réconciliation] pour correction en un clic
- Audit trail des corrections

### 4. Navigation
- Ajout de l'onglet "Référentiel" dans la sidebar

### ⚠️ Points d'attention
- La table `account_status_cache` servira de référentiel certifié
- Les `import_entries` et `import_sessions` restent pour l'historique
- Le format actuel (avec matricule/CCO) sera remplacé par le nouveau format simplifié
