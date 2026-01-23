import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { DashboardOverview } from '@/components/DashboardOverview';
import { FileImportZone } from '@/components/FileImportZone';
import { PayrollDataTable } from '@/components/PayrollDataTable';
import { FileGenerator } from '@/components/FileGenerator';
import { ReconciliationModule } from '@/components/ReconciliationModule';
import { AuditDashboard } from '@/components/AuditDashboard';
import { ImportResult, GeneratedFile, ReconciliationReport } from '@/types/payroll';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [importData, setImportData] = useState<ImportResult | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [reconciliationReport, setReconciliationReport] = useState<ReconciliationReport | null>(null);

  const handleImportComplete = (result: ImportResult) => {
    setImportData(result);
    // Auto-switch to data view after import
    setActiveTab('import');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
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
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Génération de Fichiers</h1>
              <p className="text-muted-foreground mt-1">
                Générez les fichiers de virement pour Sopra Banking Amplitude
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FileGenerator data={importData} />
              <PayrollDataTable data={importData} />
            </div>
          </div>
        );
      
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
