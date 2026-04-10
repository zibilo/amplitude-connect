import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Database, CheckCircle2, XCircle, Loader2, RefreshCw, Settings, Shield,
  Wifi, WifiOff, Clock, Download, Server, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OracleConfig {
  url: string;
  api_key: string;
}

interface SyncLog {
  id: string;
  created_at: string;
  description: string;
  details: {
    total_fetched?: number;
    total_upserted?: number;
    sync_timestamp?: string;
    source?: string;
  } | null;
}

export function OracleConfigManager() {
  const { toast } = useToast();
  const [config, setConfig] = useState<OracleConfig>({ url: '', api_key: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [healthData, setHealthData] = useState<Record<string, unknown> | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [accountCount, setAccountCount] = useState<number>(0);

  // Load config
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'oracle_middleware')
        .single();

      if (data?.value) {
        const val = data.value as Record<string, string>;
        setConfig({ url: val.url || '', api_key: val.api_key || '' });
      }

      // Load sync logs
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('id, created_at, description, details')
        .eq('action', 'oracle_sync')
        .order('created_at', { ascending: false })
        .limit(10);
      if (logs) setSyncLogs(logs as SyncLog[]);

      // Get last sync time
      const { data: lastSyncData } = await supabase
        .from('account_status_cache')
        .select('last_sync_at')
        .eq('oracle_source_id', 'oracle_sync')
        .order('last_sync_at', { ascending: false })
        .limit(1);
      // Fallback: check sync_hash
      const { data: syncHashData } = await supabase
        .from('account_status_cache')
        .select('last_sync_at')
        .not('oracle_source_id', 'is', null)
        .order('last_sync_at', { ascending: false })
        .limit(1);
      if (syncHashData?.[0]) setLastSync(syncHashData[0].last_sync_at);

      // Account count
      const { count } = await supabase
        .from('account_status_cache')
        .select('*', { count: 'exact', head: true });
      setAccountCount(count || 0);
    };
    load();
  }, []);

  const saveConfig = useCallback(async () => {
    setIsSaving(true);
    try {
      // Check if config exists first
      const { data: existing } = await supabase
        .from('system_config')
        .select('id')
        .eq('key', 'oracle_middleware')
        .single();

      let error;
      const valuePayload = JSON.parse(JSON.stringify({ url: config.url, api_key: config.api_key }));
      
      if (existing) {
        ({ error } = await supabase
          .from('system_config')
          .update({ value: valuePayload, description: 'Configuration du middleware Oracle Amplitude' })
          .eq('key', 'oracle_middleware'));
      } else {
        ({ error } = await supabase
          .from('system_config')
          .insert({ key: 'oracle_middleware', value: valuePayload, description: 'Configuration du middleware Oracle Amplitude' }));
      }

      if (error) throw error;
      toast({ title: 'Configuration sauvegardée' });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    }
    setIsSaving(false);
  }, [config, toast]);

  const testConnection = useCallback(async () => {
    setIsTesting(true);
    setConnectionStatus('unknown');
    try {
      const { data, error } = await supabase.functions.invoke('oracle-proxy', {
        body: {},
        headers: { 'Content-Type': 'application/json' },
      });

      // Use query param approach
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/oracle-proxy?action=health`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      const result = await resp.json();

      if (result.status === 'ok') {
        setConnectionStatus('connected');
        setHealthData(result);
        toast({ title: '✅ Connexion Oracle active', description: 'Le middleware répond correctement.' });
      } else {
        setConnectionStatus('error');
        setHealthData(result);
        toast({ title: '❌ Erreur de connexion', description: result.error || 'Oracle non accessible', variant: 'destructive' });
      }
    } catch (err) {
      setConnectionStatus('error');
      toast({ title: '❌ Erreur', description: String(err), variant: 'destructive' });
    }
    setIsTesting(false);
  }, [toast]);

  const syncFromOracle = useCallback(async () => {
    setIsSyncing(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/oracle-proxy?action=sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ limit: 50000 }),
        }
      );

      const result = await resp.json();

      if (result.success) {
        toast({
          title: '✅ Synchronisation terminée',
          description: `${result.total_upserted} comptes synchronisés depuis Oracle.`,
        });
        setLastSync(result.sync_timestamp);

        // Refresh account count
        const { count } = await supabase
          .from('account_status_cache')
          .select('*', { count: 'exact', head: true });
        setAccountCount(count || 0);

        // Refresh logs
        const { data: logs } = await supabase
          .from('audit_logs')
          .select('id, created_at, description, details')
          .eq('action', 'oracle_sync')
          .order('created_at', { ascending: false })
          .limit(10);
        if (logs) setSyncLogs(logs as SyncLog[]);
      } else {
        toast({ title: 'Erreur de synchronisation', description: result.error || 'Erreur inconnue', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    }
    setIsSyncing(false);
  }, [toast]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Database className="h-8 w-8 text-primary" />
          Connexion Oracle Amplitude
        </h1>
        <p className="text-muted-foreground mt-1">
          Configuration du middleware pour accéder à la base Oracle en temps réel
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Cards */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              {connectionStatus === 'connected' ? (
                <Wifi className="h-8 w-8 text-primary" />
              ) : connectionStatus === 'error' ? (
                <WifiOff className="h-8 w-8 text-destructive" />
              ) : (
                <Activity className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm text-muted-foreground">Statut Oracle</p>
                <p className="text-lg font-bold">
                  {connectionStatus === 'connected' ? 'Connecté' :
                   connectionStatus === 'error' ? 'Déconnecté' : 'Non testé'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Server className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Comptes en cache</p>
                <p className="text-lg font-bold">{accountCount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Dernière sync</p>
                <p className="text-lg font-bold">
                  {lastSync ? new Date(lastSync).toLocaleString('fr-FR') : 'Jamais'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration du Middleware
          </CardTitle>
          <CardDescription>
            Renseignez l'URL du middleware Node.js déployé sur votre réseau interne
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>URL du Middleware</Label>
              <Input
                placeholder="http://192.168.1.100:3100"
                value={config.url}
                onChange={e => setConfig(prev => ({ ...prev, url: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Adresse du serveur Node.js avec node-oracledb
              </p>
            </div>
            <div className="space-y-2">
              <Label>Clé API</Label>
              <Input
                type="password"
                placeholder="Clé d'authentification"
                value={config.api_key}
                onChange={e => setConfig(prev => ({ ...prev, api_key: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Header X-API-Key pour sécuriser les appels
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={saveConfig} disabled={isSaving || !config.url}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
              Sauvegarder
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={isTesting || !config.url}>
              {isTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
              Tester la connexion
            </Button>
            <Button variant="secondary" onClick={syncFromOracle} disabled={isSyncing || connectionStatus !== 'connected'}>
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Synchroniser depuis Oracle
            </Button>
          </div>

          {connectionStatus === 'connected' && healthData && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Connexion Oracle active</AlertTitle>
              <AlertDescription>
                Le middleware est opérationnel. Timestamp: {(healthData as Record<string, string>).timestamp || 'N/A'}
              </AlertDescription>
            </Alert>
          )}

          {connectionStatus === 'error' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Connexion échouée</AlertTitle>
              <AlertDescription>
                Vérifiez que le middleware Node.js est démarré et accessible depuis le réseau.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Sync History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Historique des synchronisations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {syncLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucune synchronisation effectuée</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Comptes récupérés</TableHead>
                  <TableHead>Comptes mis à jour</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {new Date(log.created_at).toLocaleString('fr-FR')}
                    </TableCell>
                    <TableCell>{log.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.details?.total_fetched || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge>{log.details?.total_upserted || 0}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Architecture Info */}
      <Card>
        <CardHeader>
          <CardTitle>Architecture de connexion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 py-6 flex-wrap">
            <div className="text-center p-4 border rounded-lg">
              <Database className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="font-semibold text-sm">Oracle Amplitude</p>
              <p className="text-xs text-muted-foreground">Base Linux</p>
            </div>
            <div className="text-2xl text-muted-foreground">→</div>
            <div className="text-center p-4 border rounded-lg bg-muted/30">
              <Server className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="font-semibold text-sm">Middleware Node.js</p>
              <p className="text-xs text-muted-foreground">Express + oracledb</p>
            </div>
            <div className="text-2xl text-muted-foreground">→</div>
            <div className="text-center p-4 border rounded-lg">
              <Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="font-semibold text-sm">Edge Function</p>
              <p className="text-xs text-muted-foreground">Supabase Proxy</p>
            </div>
            <div className="text-2xl text-muted-foreground">→</div>
            <div className="text-center p-4 border rounded-lg">
              <Activity className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="font-semibold text-sm">MUCO App</p>
              <p className="text-xs text-muted-foreground">React UI</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
