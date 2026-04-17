import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, Ville, AppRole } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, ShieldAlert, ShieldCheck, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

interface UserRow {
  user_id: string;
  email: string;
  display_name: string | null;
  ville: Ville;
  roles: { role: AppRole; ville: Ville | null }[];
}

export function UserManagement() {
  const { isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('user_id, email, display_name, ville');
    const { data: rolesData } = await supabase.from('user_roles').select('user_id, role, ville');
    const merged: UserRow[] = (profiles || []).map((p: any) => ({
      ...p,
      roles: (rolesData || []).filter((r: any) => r.user_id === p.user_id).map((r: any) => ({ role: r.role, ville: r.ville })),
    }));
    setUsers(merged);
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin]);

  const promoteToAdmin = async (userId: string, ville: Ville) => {
    // Remove 'user' role for that ville, add 'admin' role
    await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'user');
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'admin', ville });
    if (error) {
      toast.error('Erreur: ' + error.message);
    } else {
      toast.success('Promu administrateur');
      load();
    }
  };

  const demoteToUser = async (userId: string, ville: Ville) => {
    await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'user', ville });
    if (error) toast.error('Erreur: ' + error.message);
    else {
      toast.success('Rétrogradé en utilisateur');
      load();
    }
  };

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            <p>Accès réservé au Super Administrateur.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" />
          Gestion des Utilisateurs
        </h1>
        <p className="text-muted-foreground mt-1">
          Promouvoir des utilisateurs au rang d'administrateur régional.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Utilisateurs du système</CardTitle>
          <CardDescription>{users.length} compte(s) enregistré(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Chargement...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Rôles</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const isSA = u.roles.some((r) => r.role === 'super_admin');
                  const isAd = u.roles.some((r) => r.role === 'admin');
                  return (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-mono text-xs">{u.email}</TableCell>
                      <TableCell>{u.display_name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{u.ville === 'POINTE_NOIRE' ? 'Pointe-Noire' : 'Brazzaville'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {isSA && (
                            <Badge className="bg-destructive text-destructive-foreground">
                              <ShieldCheck className="h-3 w-3 mr-1" /> Super Admin
                            </Badge>
                          )}
                          {u.roles
                            .filter((r) => r.role === 'admin')
                            .map((r, i) => (
                              <Badge key={i} className="bg-primary text-primary-foreground">
                                Admin {r.ville === 'POINTE_NOIRE' ? 'PN' : 'BZ'}
                              </Badge>
                            ))}
                          {u.roles.some((r) => r.role === 'user') && (
                            <Badge variant="secondary">
                              <UserIcon className="h-3 w-3 mr-1" /> Utilisateur
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {!isSA && (
                          <div className="flex justify-end gap-2">
                            {!isAd ? (
                              <Select onValueChange={(v) => promoteToAdmin(u.user_id, v as Ville)}>
                                <SelectTrigger className="w-[180px] h-8">
                                  <SelectValue placeholder="Promouvoir admin..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="BRAZZAVILLE">Admin Brazzaville</SelectItem>
                                  <SelectItem value="POINTE_NOIRE">Admin Pointe-Noire</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => demoteToUser(u.user_id, u.ville)}>
                                Rétrograder
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
