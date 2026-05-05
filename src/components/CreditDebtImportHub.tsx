import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditEngagementImporter } from './CreditEngagementImporter';
import { CreditEcheancierImporter } from './CreditEcheancierImporter';
import { FiscalSeizuresImporter } from './FiscalSeizuresImporter';
import { SalaryAdvancesImporter } from './SalaryAdvancesImporter';
import { MutuellesImporter } from './MutuellesImporter';

export function CreditDebtImportHub() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Imports Crédits & Dettes</h1>
        <p className="text-muted-foreground mt-1">
          Alimentation des tables de gestion des crédits, saisies, avances et mutuelles
        </p>
      </div>

      <Tabs defaultValue="engagement" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="engagement">Engagements</TabsTrigger>
          <TabsTrigger value="echeancier">Échéanciers</TabsTrigger>
          <TabsTrigger value="satd">Saisies SATD</TabsTrigger>
          <TabsTrigger value="advances">Avances</TabsTrigger>
          <TabsTrigger value="mutuelles">Mutuelles</TabsTrigger>
        </TabsList>

        <TabsContent value="engagement" className="mt-6">
          <CreditEngagementImporter />
        </TabsContent>
        <TabsContent value="echeancier" className="mt-6">
          <CreditEcheancierImporter />
        </TabsContent>
        <TabsContent value="satd" className="mt-6">
          <FiscalSeizuresImporter />
        </TabsContent>
        <TabsContent value="advances" className="mt-6">
          <SalaryAdvancesImporter />
        </TabsContent>
        <TabsContent value="mutuelles" className="mt-6">
          <MutuellesImporter />
        </TabsContent>
      </Tabs>
    </div>
  );
}