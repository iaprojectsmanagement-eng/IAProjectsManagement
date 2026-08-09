import { OperationsService } from './operationsService';
import { supabaseClient } from './supabaseClient';
import { SyncService } from './syncService';

interface CalendarResult {
  mode: 'google' | 'simulado';
  action: 'upsert' | 'cancel';
  meetingId: string;
  eventUrl?: string;
  message?: string;
}

export const CalendarService = {
  sync: async (meetingId: string, action: 'upsert' | 'cancel' = 'upsert') => {
    if (!SyncService.isRemoteMode() || !supabaseClient) {
      const meeting = OperationsService.updateMeeting(meetingId, { calendarSync: 'simulado' });
      return { mode: 'simulado', action, meetingId, message: 'Calendar está simulado en modo local.', meeting };
    }

    await SyncService.flush();
    const syncState = SyncService.getState();
    if (syncState.pending || syncState.status === 'error') {
      throw new Error(syncState.error || 'La reunión aún no se ha guardado en Supabase.');
    }

    const { data, error } = await supabaseClient.functions.invoke<CalendarResult>('sync-google-calendar', {
      body: { meetingId, action },
    });
    if (error) throw error;
    if (!data) throw new Error('Calendar no devolvió una respuesta válida.');

    const meeting = OperationsService.updateMeeting(meetingId, {
      calendarSync: data.mode === 'google' ? 'sincronizado' : 'simulado',
      calendarEventUrl: action === 'cancel' ? undefined : data.eventUrl,
    });
    return { ...data, meeting };
  },
};
