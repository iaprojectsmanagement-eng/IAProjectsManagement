import React, { useState, useEffect, useRef } from 'react';
import { Project, ChatMessage } from '../types';
import { useAuth } from '../context/AuthContext';
import { DataService } from '../services/supabase';
import { AIService } from '../services/aiService';
import { Send, Bot, ShieldCheck, User, Sparkles } from 'lucide-react';

interface HybridChatProps {
  project: Project;
}

export const HybridChat: React.FC<HybridChatProps> = ({ project }) => {
  const { role, userName } = useAuth();
  const isSuperuser = role === 'superuser';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loaded = DataService.getMessagesByProject(project.id);
    setMessages(loaded);
  }, [project.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (isAiConsultation: boolean = false) => {
    if (!inputText.trim()) return;

    const senderRole = isSuperuser ? 'superuser' : 'student';
    const userMsg = DataService.sendMessage({
      projectId: project.id,
      senderId: isSuperuser ? 'superuser-1' : 'student-1',
      senderName: userName,
      senderRole,
      message: inputText,
      isAiConsultation,
      isReadByMonitor: isSuperuser,
    });

    const updated = [...messages, userMsg];
    setMessages(updated);
    const questionText = inputText;
    setInputText('');

    // If AI Consultation button clicked
    if (isAiConsultation) {
      setIsAiLoading(true);
      const aiReplyText = await AIService.generateChatbotResponse(questionText, project.title);

      const aiMsg = DataService.sendMessage({
        projectId: project.id,
        senderId: 'ai-bot',
        senderName: 'Asistente IA del Curso',
        senderRole: 'ai',
        message: aiReplyText,
        isAiConsultation: true,
        isReadByMonitor: false,
      });

      setMessages((prev) => [...prev, aiMsg]);
      setIsAiLoading(false);
    }
  };

  return (
    <div className="flex h-[550px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-[#0D9488]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0E2C40]">Canal Híbrido: {project.code}</h3>
            <p className="text-[11px] text-slate-400">Estudiantes + Asistente IA + Monitor</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[11px]">
          <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 font-semibold text-teal-800">
            🤖 IA Activa
          </span>
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
            🟢 Monitor en Línea
          </span>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 space-y-3 overflow-y-auto py-4 pr-2">
        {messages.map((msg) => {
          const isMe = (isSuperuser && msg.senderRole === 'superuser') || (!isSuperuser && msg.senderRole === 'student');
          const isAI = msg.senderRole === 'ai';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] ${
                isMe ? 'ml-auto' : 'mr-auto'
              }`}
            >
              <div className="mb-1 flex items-center space-x-1.5 text-[10px] font-medium text-slate-400">
                {isAI ? (
                  <Bot className="h-3.5 w-3.5 text-[#0D9488]" />
                ) : msg.senderRole === 'superuser' ? (
                  <ShieldCheck className="h-3.5 w-3.5 text-[#0D9488]" />
                ) : (
                  <User className="h-3.5 w-3.5 text-slate-500" />
                )}
                <span>{msg.senderName}</span>
                <span className="text-slate-400">
                  • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div
                className={`rounded-2xl p-3.5 text-xs leading-relaxed ${
                  isAI
                    ? 'rounded-tl-none border border-teal-200 bg-teal-50/70 text-slate-800 shadow-sm'
                    : msg.senderRole === 'superuser'
                      ? 'rounded-tr-none bg-[#0D9488] font-medium text-white shadow-sm'
                      : 'rounded-tl-none border border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                {msg.message}
              </div>
            </div>
          );
        })}

        {isAiLoading && (
          <div className="flex w-fit animate-pulse items-center space-x-2 rounded-2xl border border-teal-200 bg-teal-50 p-3 text-xs text-[#0D9488]">
            <Bot className="h-4 w-4" />
            <span>La IA está analizando tu consulta…</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input controls & Dual Action Buttons */}
      <div className="space-y-2 border-t border-slate-100 pt-3">
        <textarea
          rows={2}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            isSuperuser
              ? 'Escribe tu respuesta como Monitor al grupo…'
              : 'Escribe tu duda sobre el proyecto, entregables o código…'
          }
          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {!isSuperuser && (
              <button
                type="button"
                onClick={() => handleSendMessage(true)}
                disabled={!inputText.trim() || isAiLoading}
                className="flex items-center space-x-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-[#0D9488] transition hover:bg-teal-100 disabled:opacity-50"
              >
                <Bot className="h-3.5 w-3.5" />
                <span>Consultar a IA 🤖</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleSendMessage(false)}
            disabled={!inputText.trim()}
            className="flex items-center space-x-1.5 rounded-xl bg-[#0D9488] px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0F766E] disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{isSuperuser ? 'Responder en el Chat' : 'Enviar al Monitor'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
