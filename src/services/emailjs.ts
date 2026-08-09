export interface EmailPayload {
  toEmail: string;
  toName: string;
  projectName: string;
  message: string;
  appLink?: string;
}

export const EmailService = {
  /**
   * Sends weekly automated reminder or manual alert email
   */
  sendReminderEmail: async (payload: EmailPayload): Promise<{ success: boolean; message: string }> => {
    console.log('[EmailJS Service] Sending notification to:', payload.toEmail);
    console.log('[EmailJS Service] Content:', payload.message);

    // Simulate API call to EmailJS endpoint
    await new Promise((resolve) => setTimeout(resolve, 600));

    return {
      success: true,
      message: `Notificación por correo enviada con éxito a ${payload.toEmail} (${payload.toName})`
    };
  },

  /**
   * Mass email dispatch to multiple student groups with empty progress
   */
  sendMassReminders: async (
    recipients: { email: string; name: string; projectCode: string }[]
  ): Promise<{ sentCount: number }> => {
    let sentCount = 0;
    for (const r of recipients) {
      await EmailService.sendReminderEmail({
        toEmail: r.email,
        toName: r.name,
        projectName: r.projectCode,
        message: `Hola ${r.name}, notamos que tu proyecto ${r.projectCode} tiene campos o avances pendientes por actualizar (>7 días). Por favor ingresa a la plataforma para registrar tu acta.`
      });
      sentCount++;
    }
    return { sentCount };
  }
};
