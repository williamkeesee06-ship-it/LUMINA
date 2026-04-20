import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Mic, Terminal, Volume2, Lock, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { askLumina } from '../services/gemini';
import type { JobOrbit } from '../types/lumina';

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void; // Used to minimize in this new dock context
  jobs: JobOrbit[];
  driveFiles?: any[];
  onFlyTo: (job: JobOrbit) => void;
  viewLevel: 'universe' | 'galaxy' | 'planet';
  focusedGalaxy: string | null;
}

export function ChatInterface({ isOpen, onClose, jobs, driveFiles = [], onFlyTo, viewLevel, focusedGalaxy }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<{ role: 'ai' | 'user', text: string }[]>([
    { role: 'ai', text: "Lumina Uplink active. Local ops mode engaged. How may I assist your coordination?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [isFullVoice, setIsFullVoice] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const addMessage = useCallback((role: 'ai' | 'user', text: string) => {
    setMessages(prev => [...prev, { role, text }]);
    if (role === 'ai' && (isFullVoice || isDictating)) {
        speak(text);
    }
  }, [isFullVoice, isDictating]);

  const handleSubmitMessage = async (textToSubmit: string) => {
    if (!textToSubmit.trim() || loading) return;

    setLoading(true);
    try {
      const aiResponse = await askLumina(textToSubmit, jobs, {
        viewLevel,
        focusedGalaxy,
        googleConnected: !!localStorage.getItem('google_token') // basic check or just use truthy value if passed
      });
      
      // Clean up commands from response
      const cleanResponse = aiResponse
        .replace(/FLY_TO:[^\s]+/, '')
        .replace(/OPEN_URL:[^\s]+/, '')
        .trim();

      addMessage('ai', cleanResponse || "Command acknowledged.");

      // Executive Fly-To logic
      if (aiResponse.includes('FLY_TO:')) {
        const match = aiResponse.match(/FLY_TO:([^\s]+)/);
        if (match) {
          const job = jobs.find(j => j.jobNumber.includes(match[1]));
          if (job) onFlyTo(job);
        }
      }

      if (aiResponse.includes('FLY_TO_GALAXY:')) {
        const match = aiResponse.match(/FLY_TO_GALAXY:([^\s]+)/);
        if (match) {
          window.dispatchEvent(new CustomEvent('lumina-zoom-to-status', { 
            detail: { status: match[1] } 
          }));
        }
      }
    } catch (err) {
      addMessage('ai', "Orbital uplink failure. Retrying connection...");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput('');
    addMessage('user', text);
    handleSubmitMessage(text);
  };

  // ─── Voice Logic ───────────────────────────────────────────────────────────
  
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = isFullVoice;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        if (isDictating) {
            setInput(transcript);
            addMessage('user', transcript);
            handleSubmitMessage(transcript);
            setIsDictating(false);
            rec.stop();
        } else if (isFullVoice) {
            addMessage('user', transcript);
            handleSubmitMessage(transcript);
        }
      };

      rec.onend = () => {
        if (isFullVoice) rec.start(); // Keep session alive
        else setIsDictating(false);
      };

      recognitionRef.current = rec;
    }
  }, [isFullVoice, isDictating, jobs, onFlyTo, addMessage]);

  const toggleDictation = () => {
    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
    } else {
      setIsFullVoice(false);
      setIsDictating(true);
      recognitionRef.current?.start();
    }
  };

  const toggleFullVoice = () => {
    // Locked for now as per directive
    return; // Remove this to enable
    /*
    if (isFullVoice) {
      recognitionRef.current?.stop();
      setIsFullVoice(false);
    } else {
      setIsDictating(false);
      setIsFullVoice(true);
      recognitionRef.current?.start();
    }
    */
  };

  return (
    <div className="lumina-dock-outer">
      <motion.div 
        initial={false}
        animate={{ 
          height: isOpen ? '65vh' : '48px',
          y: 0,
          opacity: 1
        }}
        className={`lumina-dock-container ${isOpen ? 'lumina-dock-expanded' : 'lumina-dock-minimized'}`}
        onClick={!isOpen ? onClose : undefined}
      >
        {/* Header */}
        <div className="dock-header">
          <div className="dock-status-text">
            <div className="mini-orb" />
            <span>Lumina — Local Ops Mode</span>
          </div>

          {isOpen && (
            <div className="voice-icon-group">
              {/* Dictation Mode */}
              <button 
                className={`voice-icon-btn ${isDictating ? 'is-active' : ''}`}
                onClick={(e) => { e.stopPropagation(); toggleDictation(); }}
                title="Tap to Dictate"
              >
                <Mic size={18} />
                {isDictating && <div className="mic-ring" />}
              </button>

              {/* Full Voice Session (Locked) */}
              <button 
                className="voice-icon-btn is-locked"
                onClick={(e) => e.stopPropagation()}
                title="Full voice pending approval"
              >
                <div className="mini-orb" style={{ opacity: 0.5 }} />
                <Lock size={10} className="absolute bottom-0 right-0 text-amber-500" />
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="p-1 hover:text-cyan-400 transition-colors ml-2"
              >
                <Minus size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-col flex-1 overflow-hidden"
            >
              <div ref={scrollRef} className="dock-transcript neon-scrollbar">
                {messages.map((msg, i) => (
                  <div 
                    key={i} 
                    className={`holographic-bubble bubble-${msg.role === 'user' ? 'user' : 'lumina'}`}
                  >
                    {msg.text}
                  </div>
                ))}
                {loading && (
                  <div className="text-[10px] text-cyan-400/50 flex items-center gap-2 font-bold tracking-widest uppercase">
                    <div className="w-1 h-1 bg-cyan-400 animate-ping rounded-full" />
                    Lumina Processing
                  </div>
                )}
              </div>

              <div className="dock-input-area">
                <form onSubmit={handleManualSubmit} className="dock-input-wrapper">
                  <input 
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="ENTER COMMAND..."
                    className="dock-input"
                  />
                  <button type="submit" className="absolute right-4 text-cyan-500 hover:text-cyan-300">
                    <Send size={20} />
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
