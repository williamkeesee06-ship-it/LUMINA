import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export function useVoiceCommands(enabled: boolean) {
  const [isListening, setIsListening] = useState(false);

  const processCommand = useCallback((transcript: string) => {
    const command = transcript.toLowerCase().trim();
    console.log('[Lumina Voice] Heard:', command);

    if (command.includes('reset') || command.includes('home')) {
      window.dispatchEvent(new CustomEvent('lumina-reset-camera'));
    } else if (command.includes('fielding')) {
      window.dispatchEvent(new CustomEvent('lumina-zoom-to-status', { detail: { status: 'Fielding' } }));
    } else if (command.includes('rts') || command.includes('ready')) {
      window.dispatchEvent(new CustomEvent('lumina-zoom-to-status', { detail: { status: 'RTS' } }));
    } else if (command.includes('scheduled')) {
      window.dispatchEvent(new CustomEvent('lumina-zoom-to-status', { detail: { status: 'Scheduled' } }));
    } else if (command.includes('earth') || command.includes('switch view')) {
      window.dispatchEvent(new CustomEvent('lumina-toggle-view'));
    } else if (command.includes('galaxy')) {
        window.dispatchEvent(new CustomEvent('lumina-toggle-view')); // simple toggle for now
    }
  }, []);

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
