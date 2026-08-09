import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserRole } from '../types';
import { supabaseClient } from '../services/supabaseClient';

interface AuthContextType {
  role: UserRole;
  userEmail: string;
  userName: string;
  studentCode?: string;
  assignedProjectId: string | null;
  userId: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLocalDemo: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchRoleToggle: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const localDemoEnabled = import.meta.env.VITE_DATA_MODE === 'local'
  && (import.meta.env.DEV || import.meta.env.VITE_ALLOW_LOCAL_DEMO === 'true');

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>(localDemoEnabled ? 'superuser' : 'student_group');
  const [userEmail, setUserEmail] = useState(localDemoEnabled ? 'monitor.ia@u.icesi.edu.co' : '');
  const [userName, setUserName] = useState(localDemoEnabled ? 'Monitor Principal (Superuser)' : '');
  const [studentCode, setStudentCode] = useState<string | undefined>(localDemoEnabled ? 'SUPERUSER-001' : undefined);
  const [assignedProjectId, setAssignedProjectId] = useState<string | null>(null);
  const [userId, setUserId] = useState(localDemoEnabled ? 'monitor-demo' : '');
  const [isAuthenticated, setIsAuthenticated] = useState(localDemoEnabled);
  const [isLoading, setIsLoading] = useState(!localDemoEnabled && Boolean(supabaseClient));

  const loadUser = async (user: { id: string; email?: string | null } | null) => {
    if (!user || !supabaseClient) {
      setIsAuthenticated(false); setUserId(''); setUserEmail(''); setUserName(''); setAssignedProjectId(null); setIsLoading(false); return;
    }
    const { data: profile, error } = await supabaseClient.from('profiles').select('full_name,email,student_code,role,project_id').eq('id', user.id).single();
    if (error) console.warn('No se pudo cargar el perfil de Supabase.', error.message);
    const nextRole = profile?.role;
    setRole(nextRole === 'superuser' || nextRole === 'company_contact' ? nextRole : 'student_group');
    setUserId(user.id);
    setUserEmail(profile?.email || user.email || '');
    setUserName(profile?.full_name || user.email?.split('@')[0] || 'Usuario');
    setStudentCode(profile?.student_code || undefined);
    setAssignedProjectId(profile?.project_id || null);
    setIsAuthenticated(true); setIsLoading(false);
  };

  useEffect(() => {
    if (localDemoEnabled || !supabaseClient) { setIsLoading(false); return; }
    void supabaseClient.auth.getSession().then(({ data }) => loadUser(data.session?.user || null));
    const { data: subscription } = supabaseClient.auth.onAuthStateChange((_event, session) => { void loadUser(session?.user || null); });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabaseClient) throw new Error('Supabase no está configurado en este entorno.');
    setIsLoading(true);
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { setIsLoading(false); throw new Error(error.message); }
    await loadUser(data.user);
  };
  const logout = async () => {
    if (localDemoEnabled) return;
    await supabaseClient?.auth.signOut();
    await loadUser(null);
  };
  const switchRoleToggle = () => {
    if (!localDemoEnabled) return;
    if (role === 'superuser') {
      setRole('student_group'); setUserId('student-demo-a'); setUserEmail('angela6309gonzalez@gmail.com'); setUserName('Ángela González'); setStudentCode('2201001'); setAssignedProjectId('proj-1');
    } else {
      setRole('superuser'); setUserId('monitor-demo'); setUserEmail('monitor.ia@u.icesi.edu.co'); setUserName('Monitor Principal (Superuser)'); setStudentCode('SUPERUSER-001'); setAssignedProjectId(null);
    }
  };

  return <AuthContext.Provider value={{ role, userId, userEmail, userName, studentCode, assignedProjectId, isAuthenticated, isLoading, isLocalDemo: localDemoEnabled, signIn, logout, switchRoleToggle }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};
