import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface ColumnMapping {
  /** DB column name */
  dbField: string;
  /** Possible Excel header names (case-insensitive, partial match) */
  aliases: string[];
  required?: boolean;
  /** Coerce raw cell value to DB-ready value */
  transform?: (value: unknown) => unknown;
}

interface GenericExcelImporterProps {
  title: string;
  description: string;
  tableName: string;
  columns: ColumnMapping[];
  templateRows: Record<string, unknown>[];
  /** Optional post-processing of a row before insert */
  buildRow?: (mapped: Record<string, unknown>) => Record<string, unknown> | null;
}

function findCell(row: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    const lower = alias.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === lower) return row[key];
    }
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().includes(lower)) return row[key];
    }
  }
  return undefined;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const cleaned = String(v).replace(/[^\d,.-]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function toDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return v.toISOString().split('T')[0];
  if (typeof v === 'number') {
    // Excel serial date
    const date = new Date(Math.round((v - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? String(v) : d.toISOString().split('T')[0];
}

export const transformers = {
  text: (v: unknown) => (v === null || v === undefined ? null : String(v).trim()),
  upper: (v: unknown) => (v === null || v === undefined ? null : String(v).trim().toUpperCase()),
  number: toNumber,
  integer: (v: unknown) => {
    const n = toNumber(v);
    return n === null ? null : Math.round(n);
  },
  date: toDate,
};

export function GenericExcelImporter({
  title,
  description,
  tableName,
  columns,
  templateRows,
  buildRow,
}: GenericExcelImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ inserted: number; rejected: number; errors: string[] } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(templateRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${tableName}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const processImport = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

      if (rows.length === 0) throw new Error('Fichier vide');

      const validRows: Record<string, unknown>[] = [];
      const errors: string[] = [];

      rows.forEach((row, i) => {
        const mapped: Record<string, unknown> = {};
        let rowError: string | null = null;

        for (const col of columns) {
          const raw = findCell(row, col.aliases);
          const value = col.transform ? col.transform(raw) : raw;
          if (col.required && (value === null || value === undefined || value === '')) {
            rowError = `Ligne ${i + 2}: champ requis "${col.dbField}" manquant`;
            break;
          }
          mapped[col.dbField] = value;
        }

        if (rowError) {
          errors.push(rowError);
          return;
        }

        const finalRow = buildRow ? buildRow(mapped) : mapped;
        if (finalRow) validRows.push(finalRow);
        else errors.push(`Ligne ${i + 2}: rejetée par validation métier`);
      });

      if (validRows.length === 0) {
        throw new Error('Aucune ligne valide à importer');
      }

      // Insert by chunks of 500
      let inserted = 0;
      for (let i = 0; i < validRows.length; i += 500) {
        const chunk = validRows.slice(i, i + 500);
        const { error } = await supabase.from(tableName as never).insert(chunk as never);
        if (error) {
          errors.push(`Lot ${i / 500 + 1}: ${error.message}`);
        } else {
          inserted += chunk.length;
        }
      }

      setResult({ inserted, rejected: errors.length, errors: errors.slice(0, 10) });
      toast({
        title: 'Import terminé',
        description: `${inserted} lignes insérées, ${errors.length} erreurs`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      toast({ title: "Erreur d'import", description: msg, variant: 'destructive' });
      setResult({ inserted: 0, rejected: 0, errors: [msg] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Télécharger le modèle
          </Button>
          <Badge variant="secondary">Table: {tableName}</Badge>
          <Badge variant="outline">{columns.filter((c) => c.required).length} champs requis</Badge>
        </div>

        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
          <input
            id={`file-${tableName}`}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            className="hidden"
          />
          <label htmlFor={`file-${tableName}`} className="cursor-pointer flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">
              {file ? file.name : 'Cliquez pour sélectionner un fichier Excel'}
            </span>
          </label>
        </div>

        <Button onClick={processImport} disabled={!file || loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Import en cours...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" /> Importer dans {tableName}
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 p-3 rounded-lg bg-success/10 border border-success/30">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-semibold">{result.inserted}</span>
                  <span className="text-sm">insérées</span>
                </div>
              </div>
              <div className="flex-1 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-semibold">{result.rejected}</span>
                  <span className="text-sm">rejetées</span>
                </div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="p-3 rounded-lg bg-muted text-xs space-y-1 max-h-40 overflow-auto">
                {result.errors.map((e, i) => (
                  <div key={i} className="text-destructive">{e}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}