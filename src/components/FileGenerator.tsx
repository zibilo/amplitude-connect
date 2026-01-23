import { useState } from 'react';
import { FileOutput, FileCode, FileText, Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { ImportResult, GeneratedFile } from '@/types/payroll';
import { generateMVTI008XML, generateINTVIRMU2Flat, downloadGeneratedFile } from '@/utils/fileGenerator';
import { logAuditEvent } from '@/utils/auditLog';

interface FileGeneratorProps {
  data: ImportResult | null;
}

export function FileGenerator({ data }: FileGeneratorProps) {
  const [format, setFormat] = useState<'xml' | 'flat'>('xml');
  const [reference, setReference] = useState(() => {
    const now = new Date();
    return `PAY${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFile, setGeneratedFile] = useState<GeneratedFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasInvalidEntries = data && data.totalInvalid > 0;
  const hasValidEntries = data && data.totalValid > 0;

  const handleGenerate = async () => {
    if (!data || !hasValidEntries) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedFile(null);

    try {
      // Simulate processing time for UX
      await new Promise(resolve => setTimeout(resolve, 800));

      let file: GeneratedFile;
      
      if (format === 'xml') {
        file = generateMVTI008XML(data.entries, reference);
      } else {
        file = generateINTVIRMU2Flat(data.entries, reference);
      }

      setGeneratedFile(file);

      logAuditEvent('export', `Fichier ${file.format} généré: ${file.fileName}`, {
        format: file.format,
        fileName: file.fileName,
        entriesCount: file.entriesCount,
        totalAmount: file.totalAmount
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la génération';
      setError(errorMessage);
      
      logAuditEvent('error', `Erreur de génération: ${errorMessage}`, { format });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (generatedFile) {
      downloadGeneratedFile(generatedFile);
      logAuditEvent('export', `Fichier téléchargé: ${generatedFile.fileName}`);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Card className="card-banking">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileOutput className="h-5 w-5 text-primary" />
          Génération de Fichiers
        </CardTitle>
        <CardDescription>
          Générer les fichiers pour Sopra Banking Amplitude
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Warning for invalid entries */}
        {hasInvalidEntries && (
          <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-warning">Entrées invalides détectées</p>
              <p className="text-muted-foreground">
                {data?.totalInvalid} entrée(s) avec des erreurs de validation seront exclues du fichier généré.
              </p>
            </div>
          </div>
        )}

        {/* Format Selection */}
        <div className="space-y-3">
          <Label>Format de sortie</Label>
          <RadioGroup 
            value={format} 
            onValueChange={(v) => setFormat(v as 'xml' | 'flat')}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <div className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-all ${
              format === 'xml' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}>
              <RadioGroupItem value="xml" id="xml" />
              <Label htmlFor="xml" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-primary" />
                  <span className="font-medium">XML (MVTI_008)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Format standard Amplitude, encodage UTF-16
                </p>
              </Label>
            </div>
            
            <div className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-all ${
              format === 'flat' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}>
              <RadioGroupItem value="flat" id="flat" />
              <Label htmlFor="flat" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-medium">Fichier Plat (INT-VIRMU2)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Format MUCODEC, 255 caractères/ligne
                </p>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Reference Input */}
        <div className="space-y-2">
          <Label htmlFor="reference">Référence du fichier</Label>
          <Input
            id="reference"
            value={reference}
            onChange={(e) => setReference(e.target.value.toUpperCase())}
            placeholder="PAY20240115"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Identifiant unique pour le suivi du lot de virements
          </p>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={!hasValidEntries || isGenerating}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <FileOutput className="h-4 w-4 mr-2" />
              Générer le fichier {format === 'xml' ? 'XML' : 'Plat'}
            </>
          )}
        </Button>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        {/* Generated File Info */}
        {generatedFile && (
          <div className="space-y-4 p-4 bg-success/5 border border-success/30 rounded-lg animate-fade-in">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Fichier généré avec succès</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Nom du fichier:</span>
                <p className="font-mono text-xs mt-1 bg-muted p-2 rounded">{generatedFile.fileName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Format:</span>
                <p className="mt-1">
                  <Badge variant="outline">{generatedFile.format}</Badge>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Nombre d'opérations:</span>
                <p className="font-medium mt-1">{generatedFile.entriesCount}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Montant total:</span>
                <p className="font-bold text-primary mt-1">{formatAmount(generatedFile.totalAmount)}</p>
              </div>
            </div>

            <Button onClick={handleDownload} className="w-full" variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Télécharger {generatedFile.fileName}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Destination recommandée: <code className="bg-muted px-1 rounded">C:\ODTSF\</code>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
