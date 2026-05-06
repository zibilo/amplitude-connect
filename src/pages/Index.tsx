import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { DashboardOverview } from '@/components/DashboardOverview';
import { FileImportZone } from '@/components/FileImportZone';
import { PayrollDataTable } from '@/components/PayrollDataTable';
import { FileGenerator } from '@/components/FileGenerator';
import { GenerationModule } from '@/components/GenerationModule';
import { ReconciliationModule } from '@/components/ReconciliationModule';
import { AuditDashboard } from '@/components/AuditDashboard';
import { CompanyProfilesManager } from '@/components/CompanyProfilesManager';
import { CLMAgencyManager } from '@/components/CLMAgencyManager';
import { SplittingRulesManager } from '@/components/SplittingRulesManager';
import { MonthlyFluxTracker } from '@/components/MonthlyFluxTracker';
import { IntegrityAlertsPanel } from '@/components/IntegrityAlertsPanel';
import { MatriculeNormalizerTool } from '@/components/MatriculeNormalizerTool';
import { ImportWizard } from '@/components/ImportWizard';
import { ReferenceTableManager } from '@/components/ReferenceTableManager';
import { CaissesManager } from '@/components/CaissesManager';
import { ImportHistory } from '@/components/ImportHistory';
import { ReferentielSocietaireManager } from '@/components/ReferentielSocietaireManager';
import { OracleConfigManager } from '@/components/OracleConfigManager';
import { UserManagement } from '@/components/UserManagement';
import { ValidationPanel } from '@/components/ValidationPanel';
import { CreditDebtImportHub } from '@/components/CreditDebtImportHub';
import { LumiaHomeMenu } from '@/components/LumiaHomeMenu';
import { ImportResult, GeneratedFile, ReconciliationReport } from '@/types/payroll';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [importData, setImportData] = useState<ImportResult | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [reconciliationReport, setReconciliationReport] = useState<ReconciliationReport | null>(null);

  const handleImportComplete = (result: ImportResult) => {
    setImportData(result);
    setActiveTab('import');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <LumiaHomeMenu onTileSelect={setActiveTab} />;

      case 'overview':
        return (
          <DashboardOverview
            importData={importData}
            generatedFiles={generatedFiles}
            reconciliationReport={reconciliationReport}
          />
        );
      
      case 'import':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Import de Fichiers</h1>
              <p className="text-muted-foreground mt-1">
                Importez vos fichiers de paie Excel pour validation
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <FileImportZone onImportComplete={handleImportComplete} />
              </div>
              <div className="lg:col-span-2">
                <PayrollDataTable data={importData} />
              </div>
            </div>
          </div>
        );
      
      case 'generate':
        return <GenerationModule />;
      
      case 'reconciliation':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Réconciliation</h1>
              <p className="text-muted-foreground mt-1">
                Importez les rapports de compensation pour suivre le statut des virements
              </p>
            </div>
            <ReconciliationModule originalData={importData?.entries || null} />
          </div>
        );
      
      case 'audit':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Journal d'Audit</h1>
              <p className="text-muted-foreground mt-1">
                Historique complet des opérations et traçabilité
              </p>
            </div>
            <AuditDashboard />
          </div>
        );

      case 'import-wizard':
        return <ImportWizard />;
      
      case 'history':
        return <ImportHistory />;

      // Configuration modules
      case 'referentiel':
        return <ReferentielSocietaireManager />;

      case 'reference-table':
        return <ReferenceTableManager />;
      
      case 'caisses':
        return <CaissesManager />;
      
      case 'companies':
        return <CompanyProfilesManager />;
      
      case 'clm':
        return <CLMAgencyManager />;
      
      case 'splitting':
        return <SplittingRulesManager />;

      // Tracking modules
      case 'flux':
        return <MonthlyFluxTracker />;
      
      case 'alerts':
        return <IntegrityAlertsPanel />;

      case 'oracle':
        return <OracleConfigManager />;

      case 'validation':
        return <ValidationPanel />;

      case 'users':
        return <UserManagement />;

      // Tools
      case 'matricule':
        return <MatriculeNormalizerTool />;

      case 'credits-debts':
        return <CreditDebtImportHub />;

      default:
        return null;
    }
  };

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </AppLayout>
  );
};

export default Index;
