import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Send, Bot, User, MessageSquare, AlertTriangle, Cpu, Sparkles, Trash2 } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const CopilotPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hello! I am your secure, air-gapped Space Operations Copilot. I have direct access to OrbitGuard's database, including satellite catalogs, conjunction alerts, and space weather telemetries. How can I assist you with space safety today?"
    }
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [mode, setMode] = useState<'online' | 'offline'>('online');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Map frontend roles to backend expected schema: 'assistant' to 'assistant', 'user' to 'user'
      const payloadHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await axios.post(`${API_BASE_URL}/api/copilot/chat`, {
        message: text,
        history: payloadHistory
      });

      const { response: resText, mode: resMode } = response.data;
      setMode(resMode);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: resText
      }]);
    } catch (e) {
      console.error("Error calling copilot endpoint:", e);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "### ⚠️ Error\nFailed to establish connection with the backend AI service. Please verify that the OrbitGuard backend server is running."
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: "Secure session refreshed. OrbitGuard database is online. How can I assist you with space traffic management?"
      }
    ]);
  };

  const suggestionChips = [
    { label: "Show active conjunction hazards", prompt: "Show active conjunction hazards" },
    { label: "ISS (ZARYA) status report", prompt: "What is the status of ISS (ZARYA)?" },
    { label: "Get solar storm forecast", prompt: "Active space weather and solar storm forecast" }
  ];

  return (
    <div className="flex flex-col gap-5 w-full h-[calc(100vh-140px)] md:h-[calc(100vh-120px)] relative">
      
      {/* 1. HEADER SECTION */}
      <div className="glassmorphism p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200 tracking-wide uppercase font-mono flex items-center gap-2">
              <span>Secure Operations AI Copilot</span>
              <span className="text-[8px] font-sans font-bold px-1.5 py-0.5 rounded bg-blue-500 text-white animate-pulse">
                PS-10
              </span>
            </h3>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
              {mode === 'online' ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  <span>Local Llama 3.2 Active (Air-Gapped)</span>
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                  <span>Database Reporting Mode (Offline Fallback)</span>
                </>
              )}
            </div>
          </div>
        </div>

        <button 
          onClick={handleClearChat}
          className="p-2 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-slate-400 hover:text-slate-200 transition"
          title="Clear Chat Logs"
        >
          <Trash2 className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* 2. CHAT CANVAS */}
      <div className="flex-1 glassmorphism rounded-2xl border border-slate-800/80 p-5 overflow-y-auto flex flex-col gap-4 relative min-h-0 bg-slate-950/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.02),transparent_40%)] pointer-events-none"></div>
        
        {messages.map((msg, idx) => {
          const isAssistant = msg.role === 'assistant';
          const isOfflineReport = msg.content.includes("Offline Assistant Telemetry Report");
          
          return (
            <div 
              key={idx} 
              className={`flex gap-3 max-w-[85%] ${isAssistant ? 'self-start' : 'self-end flex-row-reverse'}`}
            >
              {/* Avatar Icon */}
              <div className={`h-8 w-8 rounded-lg shrink-0 border flex items-center justify-center 
                ${isAssistant 
                  ? isOfflineReport
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : 'bg-blue-600/10 border-blue-500/20 text-blue-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                {isAssistant ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>

              {/* Chat Bubble */}
              <div className={`p-4 rounded-2xl text-xs font-mono leading-relaxed border relative
                ${isAssistant 
                  ? isOfflineReport
                    ? 'bg-amber-950/20 border-amber-500/10 text-amber-100 rounded-tl-none'
                    : 'bg-slate-900/50 border-slate-800/80 text-slate-200 rounded-tl-none'
                  : 'bg-blue-600/10 border-blue-500/20 text-blue-100 rounded-tr-none'
                }`}
              >
                {/* Custom markdown formatting helper for linebreaks and bold text */}
                <div className="whitespace-pre-line space-y-1">
                  {msg.content.split('\n').map((line, lidx) => {
                    // Render headers
                    if (line.startsWith('###')) {
                      return <h4 key={lidx} className="text-slate-200 font-bold text-xs mt-2.5 mb-1 tracking-wider uppercase">{line.replace('###', '').trim()}</h4>;
                    }
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <strong key={lidx} className="text-slate-100 block mt-2 font-bold">{line.replace(/\*\*/g, '')}</strong>;
                    }
                    // Handle bullet points
                    if (line.startsWith('- ')) {
                      return <div key={lidx} className="pl-4 relative flex items-start gap-1.5"><span className="text-blue-500">•</span><span>{line.substring(2)}</span></div>;
                    }
                    return <p key={lidx}>{line}</p>;
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex gap-3 self-start max-w-[80%]">
            <div className="h-8 w-8 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Bot className="h-4 w-4 animate-bounce" />
            </div>
            <div className="bg-slate-900/50 border border-slate-800/80 text-slate-400 p-4 rounded-2xl rounded-tl-none text-xs font-mono flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping"></span>
              <span>Copilot parsing database state and formulating response...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* 3. INPUT PANEL & SUGGESTIONS */}
      <div className="shrink-0 flex flex-col gap-3">
        {/* Suggestion Chips */}
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2.5 px-1">
            {suggestionChips.map((chip, idx) => (
              <button
                key={idx}
                disabled={loading}
                onClick={() => handleSend(chip.prompt)}
                className="text-[10px] font-mono font-bold tracking-wide px-3.5 py-2 rounded-xl border border-slate-850 hover:border-slate-700 bg-slate-900/20 hover:bg-slate-900/40 text-slate-400 hover:text-slate-350 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3 text-blue-400" />
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Form Input */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder={loading ? "Generating agent response..." : "Ask Copilot about conjunction hazards, satellite catalog, or space weather..."}
            className="flex-1 px-5 py-4 rounded-2xl border border-slate-800/80 bg-slate-900/30 text-xs font-mono text-slate-200 outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition placeholder:text-slate-655"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white transition flex items-center justify-center shrink-0"
          >
            <Send className="h-4.5 w-4.5" />
          </button>
        </form>
      </div>

    </div>
  );
};
