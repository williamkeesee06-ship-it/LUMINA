import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Minus, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { askLumina } from '../services/gemini';
import type { ConstructionJob } from '../types/lumina';

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: ConstructionJob[];
  driveFiles?: any[];
  onFlyTo: (job: ConstructionJob) => void;
}

export function ChatInterface({ onClose, jobs, driveFiles = [], onFlyTo }: Omit<ChatInterfaceProps, 'isOpen'>) {
  const [messages, setMessages] = useState<{ role: 'ai' | 'user', text: string }[]>([
    { role: 'ai', text: "Greetings. I am Lumina. I have full visibility into your active Smartsheet jobs. Ask me anything." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input;
    const currentInput = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);

    try {
      const aiResponse = await askLumina(currentInput, jobs, null);
      
      // Handle Fly-To commands
      if (aiResponse.includes('FLY_TO:')) {
        const match = aiResponse.match(/FLY_TO:([^\s]+)/);
        if (match) {
          const job = jobs.find(j => j.jobNumber.includes(match[1]));
          if (job) onFlyTo(job);
        }
      }

      // Handle Open URL commands
      if (aiResponse.includes('OPEN_URL:')) {
        const urlMatch = aiResponse.match(/OPEN_URL:([^\s]+)/);
        if (urlMatch) {
          window.open(urlMatch[1], '_blank');
        }
      }

      const cleanResponse = aiResponse
        .replace(/FLY_TO:[^\s]+/, '')
        .replace(/OPEN_URL:[^\s]+/, '')
        .trim();

      setMessages(prev => [...prev, { 
        role: 'ai', 
        text: cleanResponse || (aiResponse.includes('OPEN_URL') ? "Opening the requested site for you now." : "Command acknowledged.")
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: "Connection to the cosmic uplink failed." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        drag
        dragMomentum={false}
        dragConstraints={{
          top: -window.innerHeight + 150,
          bottom: 0,
          left: -window.innerWidth / 2 + 150,
          right: window.innerWidth / 2 - 150
        }}
        initial={{ y: 200, opacity: 0 }}
        animate={{ 
          y: isMinimized ? 440 : 0, 
          opacity: 1
        }}
        exit={{ y: 200, opacity: 0 }}
        className="chat-terminal-fixed"
        style={{ 
          height: isMinimized ? '60px' : undefined,
          resize: isMinimized ? 'none' : 'both',
          minHeight: isMinimized ? '60px' : '200px',
          overflow: 'hidden'
        }}
      >
        <div className="chat-module-container flex-col h-full border-t-2 border-cyan-500/40">
          <div className="scanline" />
          
          {/* Tech Corners */}
          <div className="tech-corner tech-corner-tl" />
          <div className="tech-corner tech-corner-tr" />
          {!isMinimized && (
            <>
              <div className="tech-corner tech-corner-bl" />
              <div className="tech-corner tech-corner-br" />
            </>
          )}

          {/* Header */}
          <div className="bg-zinc-900/60 backdrop-blur-md p-4 flex-row items-center justify-between border-b border-cyan-500/20 cursor-grab active:cursor-grabbing">
            <div className="flex-row items-center gap-3">
              <div className="signal-dot" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-cyan-400/60 font-medium mb-0.5">Lumina Uplink</p>
                <h3 className="text-xs font-bold text-white tracking-wider flex-row items-center gap-2 border-b-neon pb-1 px-1">
                  <Terminal size={12} /> SYSTEM_TERMINAL_01
                </h3>
              </div>
            </div>
            <div className="flex-row items-center gap-1">
              <button 
                onClick={() => setIsMinimized(!isMinimized)}
                className="btn-neon btn-neon-cyan"
                title={isMinimized ? "Maximize" : "Minimize"}
              >
                <Minus size={16} />
              </button>
              <button 
                onClick={onClose}
                className="btn-neon btn-neon-red"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Scrollable area */}
              <div 
                ref={scrollRef}
                className="chat-message-list neon-scrollbar"
              >
                {messages.map((msg, i) => (
                  <div 
                    key={i} 
                    className={`flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <span className={`text-[10px] uppercase tracking-widest mb-1.5 opacity-60 font-bold ${msg.role === 'user' ? 'text-neon-red mr-1' : 'text-neon-blue ml-1'}`}>
                      {msg.role === 'user' ? 'User' : 'Lumina'}
                    </span>
                    <div className={`holographic-message-bubble${msg.role === 'user' ? '-user' : ''} p-3 rounded-lg max-w-[85%]`}>
                      <p className="text-sm leading-relaxed text-white/90">
                        {msg.text}
                      </p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex-row items-center gap-2 text-cyan-400/50 italic text-xs ml-2">
                    <div className="signal-dot animate-pulse" />
                    LUMINA is processing...
                  </div>
                )}

                {/* Drive Files Context */}
                {driveFiles.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-cyan-500/10">
                    <div className="text-[10px] uppercase tracking-widest text-cyan-400 mb-3 opacity-60 flex-row items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                      Secure Drive Uplink
                    </div>
                    <div className="flex-col gap-2">
                      {driveFiles.map((file: any) => (
                        <a 
                          key={file.id} 
                          href={file.webViewLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-row items-center gap-3 p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded overflow-hidden transition-all group"
                        >
                          <div className="w-6 h-6 flex items-center justify-center bg-cyan-500/20 rounded border border-cyan-500/30 text-cyan-400">
                            <Terminal size={12} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-white/80 font-medium truncate group-hover:text-cyan-300">
                              {file.name}
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="holographic-input-area">
                <form 
                  onSubmit={handleSubmit}
                  className="relative flex-row items-center"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="System command..."
                    className="holographic-input"
                  />
                  <button 
                    type="submit"
                    disabled={loading}
                    className="absolute right-4 text-cyan-500 hover:text-cyan-300 transition-colors disabled:opacity-30"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>

              {/* Resize Handle Indicator */}
              <div className="absolute bottom-1 right-1 pointer-events-none opacity-20">
                <div className="w-4 h-4 border-r-2 border-b-2 border-cyan-400" />
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
