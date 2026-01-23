import { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { parsePayrollExcel, generateSampleTemplate } from '@/utils/excelParser';
import { ImportResult } from '@/types/payroll';
import { logAuditEvent } from '@/utils/auditLog';

interface FileImportZoneProps {
  onImportComplete: (result: ImportResult) => void;
}

export function FileImportZone({ onImportComplete }: FileImportZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setSelectedFile(file);

    try {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ];
      
      const isValidType = validTypes.includes(file.type) || 
        file.name.endsWith('.xlsx') || 
        file.name.endsWith('.xls') ||
        file.name.endsWith('.csv');

      if (!isValidType) {
        throw new Error('Format de fichier non supporté. Utilisez .xlsx, .xls ou .csv');
      }

      const result = await parsePayrollExcel(file);
      
      logAuditEvent('import', `Fichier importé: ${file.name}`, {
        fileName: file.name,
        entriesCount: result.entries.length,
        validCount: result.totalValid,
        invalidCount: result.totalInvalid,
        totalAmount: result.totalAmount
      });

      onImportComplete(result);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      
      logAuditEvent('error', `Erreur d'import: ${errorMessage}`, {
        fileName: file.name
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const downloadTemplate = () => {
    const blob = generateSampleTemplate();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template_paie.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    logAuditEvent('export', 'Template Excel téléchargé');
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setError(null);
  };

  return (
    <Card className="card-banking">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Import Fichier de Paie
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop Zone */}
        <div
          className={`dropzone cursor-pointer transition-all duration-200 ${
            isDragging ? 'dropzone-active border-primary bg-primary/5' : ''
          } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex flex-col items-center gap-3">
            <div className={`p-4 rounded-full transition-colors ${
              isDragging ? 'bg-primary/20' : 'bg-muted'
            }`}>
              <Upload className={`h-8 w-8 ${
                isDragging ? 'text-primary' : 'text-muted-foreground'
              }`} />
            </div>
            
            <div>
              <p className="font-medium text-foreground">
                {isProcessing ? 'Traitement en cours...' : 'Glissez votre fichier Excel ici'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                ou cliquez pour sélectionner un fichier (.xlsx, .xls, .csv)
              </p>
            </div>
          </div>
        </div>

        {/* Selected File Display */}
        {selectedFile && !error && (
          <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg border border-success/30 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="font-medium text-success">{selectedFile.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/30 animate-fade-in">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Erreur d'import</p>
              <p className="text-sm text-destructive/80">{error}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={clearSelection} className="ml-auto">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Template Download */}
        <div className="pt-2 border-t border-border">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={downloadTemplate}
            className="w-full"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Télécharger le modèle Excel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
