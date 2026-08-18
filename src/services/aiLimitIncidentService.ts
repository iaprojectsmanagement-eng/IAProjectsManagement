import { supabaseClient } from './supabaseClient';
import { SyncService } from './syncService';

export interface AiLimitIncident {
  id: string;
  actorName: string;
  actorEmail: string;
  projectLabel: string;
  limitWindow: 'minute' | 'hour' | 'day';
  operation: 'transcript' | 'document';
  status: 'abierta' | 'archivada';
  createdAt: string;
}

const mapIncident = (row: any): AiLimitIncident => ({
  id: row.id,
  actorName: row.profiles?.full_name || 'Usuario',
  actorEmail: row.profiles?.email || 'Sin correo',
  projectLabel: row.projects?.folder_name ? `${row.projects.folder_name} · ${row.projects.title || 'Proyecto'}` : 'Proyecto',
  limitWindow: row.limit_window,
  operation: row.operation,
  status: row.status,
  createdAt: row.created_at,
});

export const AiLimitIncidentService = {
  list: async (status: 'abierta' | 'archivada' = 'abierta'): Promise<AiLimitIncident[]> => {
    if (!SyncService.isRemoteMode() || !supabaseClient) return [];
    const { data, error } = await supabaseClient
      .from('ai_limit_incidents')
      .select('id,limit_window,operation,status,created_at,profiles!ai_limit_incidents_actor_id_fkey(full_name,email),projects(folder_name,title)')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []).map(mapIncident);
  },
  archive: async (incidentId: string) => {
    if (!supabaseClient) throw new Error('Supabase no está configurado.');
    const { error } = await supabaseClient.from('ai_limit_incidents').update({ status: 'archivada', archived_at: new Date().toISOString() }).eq('id', incidentId);
    if (error) throw error;
  },
  remove: async (incidentId: string) => {
    if (!supabaseClient) throw new Error('Supabase no está configurado.');
    const { error } = await supabaseClient.from('ai_limit_incidents').delete().eq('id', incidentId);
    if (error) throw error;
  },
};
