import React from 'react';
import { Html } from '@react-three/drei';

interface ErrorBoundaryProps {
  fallback: (error: Error | null) => React.ReactNode;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.state.error);
    }
    return this.props.children;
  }
}

export function SceneErrorFallback(err: Error | null) {
  return (
    <Html center>
      <div className="bg-black/80 border border-red-500 p-6 backdrop-blur-xl rounded-lg">
        <h2 className="text-red-500 font-bold uppercase tracking-tighter mb-2">Experience Context Lost</h2>
        <p className="text-white/60 text-xs font-mono">{err?.message || 'Unknown graphics failure'}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-1 border border-red-500/50 text-red-500 text-[10px] uppercase hover:bg-red-500/10 transition-colors"
        >
          Initialize Recovery
        </button>
      </div>
    </Html>
  );
}
