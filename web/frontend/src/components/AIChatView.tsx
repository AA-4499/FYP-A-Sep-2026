/**
 * Explainable AI & AI Chat View matching Figma Image 3
 * Features:
 * - Patient Vitals Header (HbA1c 8.1%, Fasting glucose 9.4 mmol/L, BMI 27.3, Current risk 68%)
 * - Interactive AI Chat with simulated domain-expert explanations
 * - Heuristic risk-factor attributions (illustrative, not SHAP)
 * - Clickable prompt chips
 */
import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import type { Patient } from '../types';

interface AIChatViewProps {
  patient: Patient;
  onNavigate: (module: any) => void;
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

export const AIChatView: React.FC<AIChatViewProps> = ({ patient, onNavigate }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: `I analyzed the latest HbA1c trend and the factors driving this patient's current risk. The model is highlighting elevated glucose levels and BMI as the strongest contributors.`,
      timestamp: '16:58 pm',
    },
    {
      id: '2',
      sender: 'user',
      text: 'What is the most important factor right now?',
      timestamp: '16:59 pm',
    },
    {
      id: '3',
      sender: 'ai',
      text: 'HbA1c is the strongest signal. The current reading is above the historical average, and the model is weighting it most heavily in the current risk assessment.',
      timestamp: '17:00 pm',
    },
    {
      id: '4',
      sender: 'ai',
      text: 'Fasting glucose and BMI are also contributing, but HbA1c is the clearest signal in the current longitudinal trend.',
      timestamp: '17:00 pm',
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const suggestedPrompts = [
    'How does BMI impact insulin resistance in this model?',
    'What would happen if HbA1c dropped to 7.0%?',
    'Explain the beta-cell kinetics for this patient.',
    'What dietary changes are recommended?',
  ];

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      let reply = '';
      const lower = query.toLowerCase();

      if (lower.includes('7.0%') || lower.includes('drop') || lower.includes('what if')) {
        reply = `Simulating a target HbA1c reduction from ${patient.hba1c}% to 7.0% yields a projected risk decrease from ${patient.currentRiskPct}% to 43% (-25% absolute risk drop). This primarily relieves the endocrine pancreas stress index from 78 down to 45.`;
      } else if (lower.includes('bmi') || lower.includes('weight')) {
        reply = `With BMI at ${patient.bmi} kg/m² (Class I Overweight), hepatic glucose output is elevated and peripheral GLUT-4 translocation efficiency is reduced. BMI is weighted as a contributing risk factor in the platform's heuristic risk score.`;
      } else if (lower.includes('beta-cell') || lower.includes('pancreas')) {
        reply = `The physiological digital twin models progressive beta-cell exhaustion driven by sustained glucotoxicity. Currently, high basal secretion demand is required to compensate for postprandial glucose surges above 180 mg/dL.`;
      } else {
        reply = `Based on longitudinal multi-visit telemetry across ${patient.visitsCount} visits, targeted carbohydrate damping and GLP-1/SGLT2 consideration would address the leading risk factors for ${patient.name}.`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setIsTyping(false);
    }, 800);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('patient_dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Patient Dashboard</span>
        </button>

        <span className="text-xs text-slate-400 font-medium">
          Module: <strong className="text-slate-700">Explainable AI & Assistant</strong>
        </span>
      </div>

      {/* 2. Top Patient Vitals Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-2">
        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">HbA1c</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {patient.hba1c}%
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Fasting glucose</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {patient.fastingGlucose} <span className="text-xs font-normal text-slate-500">mmol/L</span>
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">BMI</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {patient.bmi}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Current risk</p>
          <p className="text-2xl sm:text-3xl font-bold text-[#b91c1c] tracking-tight">
            {patient.currentRiskPct}%
          </p>
        </div>
      </div>

      {/* 3. Main Chat Interface Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
        {/* Chat Card Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">AI chat</h2>
            <p className="text-xs text-slate-400">Explainable model insights</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-600">Ready</span>
          </div>
        </div>

        {/* Chat Message Stream */}
        <div className="space-y-4 min-h-[340px] max-h-[460px] overflow-y-auto pr-2 pt-2">
          {messages.map((m) => {
            const isAi = m.sender === 'ai';
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isAi ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`max-w-xl rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    isAi
                      ? 'bg-slate-50 text-slate-800 border border-slate-200/70 rounded-tl-xs'
                      : 'bg-blue-600 text-white rounded-tr-xs shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 opacity-70 text-[10px] uppercase font-bold">
                    {isAi ? (
                      <>
                        <Bot className="w-3 h-3 text-blue-600" />
                        <span>AI Assistant</span>
                      </>
                    ) : (
                      <>
                        <User className="w-3 h-3 text-white" />
                        <span>You</span>
                      </>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {m.timestamp}
                </span>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
              <Bot className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>Analyzing risk factors...</span>
            </div>
          )}
        </div>

        {/* Suggested Prompts */}
        <div className="pt-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
            Suggested queries:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {suggestedPrompts.map((p) => (
              <button
                key={p}
                onClick={() => handleSendMessage(p)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 transition font-medium"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Input Bar */}
        <div className="pt-2 flex items-center gap-2">
          <input
            type="text"
            placeholder="Ask the model a question"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white transition"
          />

          <button
            onClick={() => handleSendMessage()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition shadow-xs"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
