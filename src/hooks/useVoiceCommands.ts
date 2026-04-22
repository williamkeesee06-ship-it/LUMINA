import { useState, useEffect, useCallback } from 'react';
import { useLumina } from '../store/LuminaContext';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export function useVoiceCommands(enabled: boolean) {
  const [isListening, setIsListening] = useState(false);
  const { 
    resetUI, 
    setActiveStatus, 
    setFocusedGalaxy, 
    setViewMode,
    viewMode
  } = useLumina();

  const processCommand = useCallback((transcript: string) => {
    const command = transcript.toLowerCase().trim();
    console.log('[Lumina Voice] Heard:', command);

    if (command.includes('reset') || command.includes('home')) {
      resetUI();
    } else if (command.includes('fielding')) {
      setActiveStatus('Needs Fielding');
      setFocusedGalaxy('Needs Fielding');
      setViewMode('galaxy');
    } else if (command.includes('rts') || command.includes('ready')) {
      setActiveStatus('Fielded-RTS');
      setFocusedGalaxy('Fielded-RTS');
      setViewMode('galaxy');
    } else if (command.includes('scheduled')) {
      setActiveStatus('Scheduled');
      setFocusedGalaxy('Scheduled');
      setViewMode('galaxy');
    } else if (command.includes('earth') || command.includes('switch view')) {
      setViewMode(viewMode === 'earth' ? 'galaxy' : 'earth');
    } else if (command.includes('map')) {
      setViewMode(viewMode === 'map' ? 'galaxy' : 'map');
    } else if (command.includes('galaxy')) {
      setViewMode('galaxy');
    }
  }, [resetUI, setActiveStatus, setFocusedGalaxy, setViewMode, viewMode]);

  useEffect(() => {
    if (!enabled) return;

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
      if (enabled) recognition.start(); // Auto-restart if still enabled
    };

    recognition.start();
    setIsListening(true);

    return () => {
        recognition.stop();
        setIsListening(false);
    };
  }, [enabled, processCommand]);

  return { isListening };
}
