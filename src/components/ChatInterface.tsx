import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Mic, Lock, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { askLumina } from '../services/gemini';
import { resolveGalaxy } from '../types/lumina';
import type { JobOrbit } from '../types/lumina';
import { useLumina } from '../store/LuminaContext';

function VoiceVisualizer() {
  return (
    <div className="voice-visualizer">
      {[...Array(5)].map((_, i) => (
        <div 
          key={i} 
          className="voice-bar" 
          style={{ animationDelay: `${i * 0.15}s` }} 
        />
      ))}
    </div>
  );
}

export function ChatInterface() {
  const { 
    isChatOpen: isOpen, 
    toggleChat: onClose, 
    jobs, 
    viewMode, 
    focusedGalaxy,
    setFocusedGalaxy,
    selectJob,
    googleToken,
    setActiveStatus,
    isDictating,
    setIsDictating,
    isFullVoice,
    setIsFullVoice
  } = useLumina();

  const [messages, setMessages] = useState<{ role: 'ai' | 'user', text: string }[]>([
    { role: 'ai', text: "Lumina Uplink active. Local ops mode engaged. How may I assist your coordination?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const onFlyTo = (job: JobOrbit) => {
    setFocusedGalaxy(resolveGalaxy(job.status));
    selectJob(job.rowId, job.jobNumber);
    onClose();
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const speak = (text: string) => {
    if (!text) return;
    // Cancel any ongoing speech to prevent overlap and maintain responsiveness
    window.speechSynthesis.cancel();
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
        viewMode,
        focusedGalaxy,
        googleConnected: !!googleToken
      });
      
      // Clean up commands from response
      const cleanResponse = aiResponse
        .replace(/FLY_TO:[^\s]+/, '')
        .replace(/FLY_TO_GALAXY:[^\s]+/, '')
        .trim();

      addMessage('ai', cleanResponse || "Command acknowledged.");

      // Executive Fly-To logic
      if (aiResponse.includes('FLY_TO:')) {
        const match = aiResponse.match(/FLY_TO:([^\s]+)/);
        if (match) {
          const job = jobs.find((j: any) => j.jobNumber.includes(match[1]));
          if (job) onFlyTo(job);
        }
      }

      if (aiResponse.includes('FLY_TO_GALAXY:')) {
        const match = aiResponse.match(/FLY_TO_GALAXY:([^\s]+)/);
        if (match) {
          setActiveStatus(match[1]);
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
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      if (isDictating) {
          setInput(transcript);
          addMessage('user', transcript);
          handleSubmitMessage(transcript);
          setIsDictating(false);
      } else if (isFullVoice) {
          addMessage('user', transcript);
          handleSubmitMessage(transcript);
      }
    };

    rec.onerror = (event: any) => {
      console.warn("[Lumina] Speech recognition error:", event.error);
      if (event.error === 'not-allowed') {
        setIsFullVoice(false);
        setIsDictating(false);
        addMessage('ai', "Microphone access denied. Please verify browser permissions to enable voice coordination.");
      } else if (event.error === 'network') {
        addMessage('ai', "Voice uplink unstable. Switching to manual telemetry.");
      }
    };

    rec.onend = () => {
      if (isFullVoice) {
        try { rec.start(); } catch (e) {}
      }
    };

    recognitionRef.current = rec;

    return () => {
      rec.stop();
    };
  }, [isFullVoice, isDictating, jobs, addMessage]);

  const toggleDictation = () => {
    if (!recognitionRef.current) return;
    if (isDictating) {
      recognitionRef.current.stop();
      setIsDictating(false);
    } else {
      setIsDictating(true);
      try { recognitionRef.current.start(); } catch (e) {}
    }
  };

  const toggleFullVoice = () => {
    if (!recognitionRef.current) return;
    if (isFullVoice) {
      recognitionRef.current.stop();
      setIsFullVoice(false);
    } else {
      setIsFullVoice(true);
      try { recognitionRef.current.start(); } catch (e) {}
    }
  };

  const hasSpeech = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);


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
            <div className={`mini-orb ${isFullVoice ? 'dyson-pulse' : ''}`} />
            <span>{isFullVoice ? 'Lumina — Dyson Session Active' : 'Lumina — Local Ops Mode'}</span>
            {(isFullVoice || isDictating) && <VoiceVisualizer />}
          </div>

          {isOpen && (
            <div className="voice-icon-group">
              {/* Dictation Mode (One-Shot) */}
              <button 
                className={`voice-icon-btn ${isDictating ? 'is-active' : ''} ${!hasSpeech ? 'is-locked' : ''}`}
                onClick={(e) => { e.stopPropagation(); toggleDictation(); }}
                disabled={!hasSpeech}
                title={hasSpeech ? "One-Shot Dictation" : "Speech Recognition Not Supported"}
              >
                {hasSpeech ? <Mic size={18} /> : <Lock size={18} />}
                {isDictating && <div className="mic-ring" />}
              </button>

              {/* Full Voice Session (Continuous) */}
              <button 
                className={`voice-icon-btn ${isFullVoice ? 'is-active' : ''} ${!hasSpeech ? 'is-locked' : ''}`}
                onClick={(e) => { e.stopPropagation(); toggleFullVoice(); }}
                disabled={!hasSpeech}
                title={hasSpeech ? "Full Voice Session" : "Speech Recognition Not Supported"}
              >
                <div className={`mini-orb ${isFullVoice ? 'dyson-pulse' : ''}`} style={{ width: 14, height: 14 }} />
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
