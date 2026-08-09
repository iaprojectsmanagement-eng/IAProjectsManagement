import React, { useState, useEffect, useRef } from 'react';
import { Project, ChatMessage } from '../types';
import { useAuth } from '../context/AuthContext';
import { DataService } from '../services/supabase';
import { AIService } from '../services/aiService';
import { Send, Bot, ShieldCheck, User, Sparkles, HelpCircle, MessageSquare } from 'lucide-react';

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
      isReadByMonitor: isSuperuser
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
        isReadByMonitor: false
      });

      setMessages((prev) => [...prev, aiMsg]);
      setIsAiLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-[550px] shadow-xl">
      {/* Chat Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-outfit">Canal Híbrido: {project.code}</h3>
            <p className="text-[11px] text-slate-400">Estudiantes + Asistente IA + Monitor</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[11px]">
          <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-semibold">
            🤖 IA Activa
          </span>
          <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-semibold">
            🟢 Monitor en Línea
          </span>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-2">
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
              <div className="flex items-center space-x-1.5 mb-1 text-[10px] text-slate-400 font-medium">
                {isAI ? (
                  <Bot className="h-3.5 w-3.5 text-indigo-400" />
                ) : msg.senderRole === 'superuser' ? (
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                ) : (
                  <User className="h-3.5 w-3.5 text-emerald-400" />
                )}
                <span>{msg.senderName}</span>
                <span className="text-slate-600">
                  • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div
                className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                  isAI
                    ? 'bg-gradient-to-r from-indigo-950 to-slate-950 text-indigo-100 border border-indigo-800/80 rounded-tl-none shadow-md'
                    : msg.senderRole === 'superuser'
                    ? 'bg-indigo-600 text-white rounded-tr-none shadow-md font-medium'
                    : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                }`}
              >
                {msg.message}
              </div>
            </div>
          );
        })}

        {isAiLoading && (
          <div className="flex items-center space-x-2 text-xs text-indigo-400 bg-indigo-950/60 p-3 rounded-2xl w-fit border border-indigo-800/60 animate-pulse">
            <Bot className="h-4 w-4 text-indigo-400" />
            <span>La IA está analizando tu consulta...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input controls & Dual Action Buttons */}
      <div className="pt-3 border-t border-slate-800 space-y-2">
        <textarea
          rows={2}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            isSuperuser
              ? 'Escribe tu respuesta como Monitor al grupo...'
              : 'Escribe tu duda sobre el proyecto, entregables o código...'
          }
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {!isSuperuser && (
              <button
                type="button"
                onClick={() => handleSendMessage(true)}
                disabled={!inputText.trim() || isAiLoading}
                className="px-3 py-1.5 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 text-xs font-semibold flex items-center space-x-1.5 disabled:opacity-50 transition"
              >
                <Bot className="h-3.5 w-3.5 text-indigo-400" />
                <span>Consultar a IA 🤖</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleSendMessage(false)}
            disabled={!inputText.trim()}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-1.5 disabled:opacity-50 transition shadow-md shadow-indigo-600/20"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{isSuperuser ? 'Responder en el Chat' : 'Enviar al Monitor'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
