import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AppleApp from './AppleApp.tsx';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F5F7] dark:bg-[#0A0A0C] p-6 text-center text-[#1D1D1F] dark:text-white">
          <div className="max-w-md rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1C1C1E] p-6 space-y-3 shadow-lg">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-xs font-mono text-[#0071E3] dark:text-[#64D2FF] break-all">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-[#0071E3] px-5 py-2 text-xs font-medium text-white cursor-pointer"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppleApp />
    </ErrorBoundary>
  </StrictMode>
);
