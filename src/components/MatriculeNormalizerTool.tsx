import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Hash, 
  Search, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  Zap
} from 'lucide-react';
import {
  sanitizeMatricule,
  normalizeMatricule,
  padMatricule,
  detectMatriculeFormat,
  generateMatriculeVariants,
  calculateSimilarity
} from '@/lib/matricule/normalizer';

export function MatriculeNormalizerTool() {
  const [input, setInput] = useState('');
  const [compareWith, setCompareWith] = useState('');
  const [result, setResult] = useState<{
    sanitized: string;
    normalized: string;
    padded: string;
    format: string;
    variants: string[];
    similarity?: number;
  } | null>(null);

  const handleAnalyze = () => {
    if (!input.trim()) return;

    const sanitized = sanitizeMatricule(input);
    const normalized = normalizeMatricule(input);
    const padded = padMatricule(input);
    const format = detectMatriculeFormat(input);
    const variants = generateMatriculeVariants(input);
    
    let similarity: number | undefined;
    if (compareWith.trim()) {
      similarity = calculateSimilarity(input, compareWith);
    }

    setResult({
      sanitized,
      normalized,
      padded,
      format,
      variants,
      similarity
    });
  };

  const getFormatBadge = (format: string) => {
    switch (format) {
      case 'numeric':
        return <Badge variant="default">Numérique</Badge>;
      case 'alphanumeric':
        return <Badge variant="secondary">Alphanumérique</Badge>;
      case 'special':
        return <Badge variant="outline">Caractères Spéciaux</Badge>;
      default:
        return <Badge variant="outline">Inconnu</Badge>;
    }
  };

  const getSimilarityBadge = (similarity: number) => {
    if (similarity >= 90) {
      return <Badge variant="default" className="bg-green-500">Excellent ({similarity}%)</Badge>;
    } else if (similarity >= 70) {
      return <Badge variant="secondary" className="bg-amber-500">Bon ({similarity}%)</Badge>;
    } else if (similarity >= 50) {
      return <Badge variant="outline">Moyen ({similarity}%)</Badge>;
    } else {
      return <Badge variant="destructive">Faible ({similarity}%)</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Outil de Normalisation</h1>
        <p className="text-muted-foreground mt-1">
          Test et analyse des matricules avec l'algorithme de normalisation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />
              Entrée Matricule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="matricule">Matricule à analyser</Label>
              <Input
                id="matricule"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ex: 00889, M-123, PR2023/01"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="compare">Comparer avec (optionnel)</Label>
              <Input
                id="compare"
                value={compareWith}
                onChange={e => setCompareWith(e.target.value)}
                placeholder="Matricule de référence pour comparaison"
              />
            </div>

            <Button onClick={handleAnalyze} className="w-full gap-2">
              <Zap className="h-4 w-4" />
              Analyser
            </Button>
          </CardContent>
        </Card>

        {/* Result Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Résultats
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="text-center py-8 text-muted-foreground">
                Entrez un matricule et cliquez sur Analyser
              </div>
            ) : (
              <div className="space-y-4">
                {/* Transformation Steps */}
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Original</span>
                    <code className="px-2 py-1 bg-background rounded">{input}</code>
                  </div>
                  <div className="flex items-center justify-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Nettoyé</span>
                    <code className="px-2 py-1 bg-background rounded">{result.sanitized}</code>
                  </div>
                  <div className="flex items-center justify-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Normalisé</span>
                    <code className="px-2 py-1 bg-primary/10 text-primary rounded font-bold">
                      {result.normalized}
                    </code>
                  </div>
                  <div className="flex items-center justify-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Paddé (7 chiffres)</span>
                    <code className="px-2 py-1 bg-background rounded">{result.padded}</code>
                  </div>
                </div>

                {/* Format Detection */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Format Détecté</span>
                  {getFormatBadge(result.format)}
                </div>

                {/* Similarity Score */}
                {result.similarity !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Similarité</span>
                    {getSimilarityBadge(result.similarity)}
                  </div>
                )}

                {/* Variants */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Variantes générées pour recherche</span>
                  <div className="flex flex-wrap gap-2">
                    {result.variants.slice(0, 8).map((variant, i) => (
                      <code key={i} className="px-2 py-1 bg-muted rounded text-xs">
                        {variant}
                      </code>
                    ))}
                    {result.variants.length > 8 && (
                      <Badge variant="outline">+{result.variants.length - 8} autres</Badge>
                    )}
                  </div>
                </div>

                {/* Match Status */}
                {result.similarity !== undefined && (
                  <div className={`p-3 rounded-lg border ${
                    result.similarity >= 70 
                      ? 'bg-green-500/10 border-green-500/30' 
                      : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <div className="flex items-center gap-2">
                      {result.similarity >= 70 ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className="font-medium">
                        {result.similarity >= 70 
                          ? 'Correspondance probable' 
                          : 'Correspondance improbable'
                        }
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {result.similarity >= 90 
                        ? 'Ces matricules sont très probablement identiques.'
                        : result.similarity >= 70
                        ? 'Ces matricules pourraient correspondre, vérification recommandée.'
                        : 'Ces matricules semblent différents.'
                      }
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Exemples de Normalisation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Matricules Numériques</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <code>00889</code>
                  <ArrowRight className="h-4 w-4" />
                  <code className="text-primary">889</code>
                </div>
                <div className="flex justify-between">
                  <code>" 123 "</code>
                  <ArrowRight className="h-4 w-4" />
                  <code className="text-primary">123</code>
                </div>
                <div className="flex justify-between">
                  <code>0000055</code>
                  <ArrowRight className="h-4 w-4" />
                  <code className="text-primary">55</code>
                </div>
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Alphanumériques</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <code>m-123</code>
                  <ArrowRight className="h-4 w-4" />
                  <code className="text-primary">M-123</code>
                </div>
                <div className="flex justify-between">
                  <code>PR2023</code>
                  <ArrowRight className="h-4 w-4" />
                  <code className="text-primary">PR2023</code>
                </div>
                <div className="flex justify-between">
                  <code>emp 001</code>
                  <ArrowRight className="h-4 w-4" />
                  <code className="text-primary">EMP001</code>
                </div>
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Caractères Spéciaux</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <code>123/ABC</code>
                  <ArrowRight className="h-4 w-4" />
                  <code className="text-primary">123/ABC</code>
                </div>
                <div className="flex justify-between">
                  <code>EMP-001</code>
                  <ArrowRight className="h-4 w-4" />
                  <code className="text-primary">EMP-001</code>
                </div>
                <div className="flex justify-between">
                  <code>2023_01</code>
                  <ArrowRight className="h-4 w-4" />
                  <code className="text-primary">2023_01</code>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
