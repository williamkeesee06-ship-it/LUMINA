import { useState, useEffect, useCallback, useRef } from 'react';
import { useLumina } from '../store/LuminaContext';
import { askLumina } from '../services/gemini';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export function useVoiceCommands(enabled: boolean) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  const { 
    jobs,
    googleToken,
    viewMode,
    focusedGalaxy,
    resetUniverse, 
    setActiveStatus, 
    setFocusedGalaxy, 
    setViewMode,
    setOrbMode,
    selectJob
  } = useLumina();

  const processCommand = useCallback(async (transcript: string) => {
    const command = transcript.toLowerCase().trim();
    if (!command) return;

    // 1. Local Fast-Path (Instant latency for common nav)
    if (command.includes('reset') || command.includes('home')) {
      resetUniverse();
      return;
    }

    // 2. AI Intelligence Layer (The Persona)
    setOrbMode('thinking');
    try {
      const response = await askLumina(transcript, jobs, {
        viewMode,
        focusedGalaxy,
        googleConnected: !!googleToken
      });

      if (response.startsWith('FLY_TO:')) {
        const jobNumber = response.replace('FLY_TO:', '').trim();
        const job = jobs.find(j => j.jobNumber === jobNumber);
        if (job) {
          selectJob(job.rowId, job.jobNumber);
          setOrbMode('navigating');
        }
      } else if (response.startsWith('FLY_TO_GALAXY:')) {
        const cat = response.replace('FLY_TO_GALAXY:', '').trim();
        setActiveStatus(cat);
        setFocusedGalaxy(cat);
        setViewMode('galaxy');
        setOrbMode('navigating');
      } else if (response.startsWith('OPEN_URL:')) {
        const url = response.replace('OPEN_URL:', '').trim();
        window.open(url, '_blank');
      } else {
        // For text-only responses, we could display them in a "subtitles" area or just log
        // In a full implementation, we'd trigger a custom TTS here.
      }
    } catch (err) {
      console.error('[Lumina Voice] AI Processing Error:', err);
    } finally {
      setOrbMode(enabled ? 'voice' : 'connected');
    }
  }, [
    jobs, googleToken, viewMode, focusedGalaxy, 
    resetUniverse, setActiveStatus, setFocusedGalaxy, 
    setViewMode, setOrbMode, selectJob, enabled
  ]);

  useEffect(() => {
    if (!enabled) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[Lumina Voice] browser does not support Speech Recognition');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript;
      processCommand(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('[Lumina Voice] Error:', event.error);
    };

    recognition.onend = () => {
      if (enabled && recognitionRef.current) {
        try {
          recognition.start();
        } catch (e) {
          // Already started
        }
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsListening(false);
    };
  }, [enabled, processCommand]);

  return { isListening };
}

