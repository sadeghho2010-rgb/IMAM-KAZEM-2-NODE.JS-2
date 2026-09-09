import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React Component tree:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetApp = () => {
    try {
      localStorage.removeItem('system_auth_current_user_v2');
      localStorage.removeItem('current_mentor_id');
      localStorage.removeItem('shahpoori_active_filter');
    } catch (e) {
      console.error('Error clearing app storage:', e);
    }
    window.location.reload();
  };

  private handleFullClear = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error('Error clearing storage:', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white font-vazir flex items-center justify-center p-4 sm:p-6" dir="rtl">
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center space-y-6 shadow-2xl backdrop-blur-xl">
            <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/30 shadow-inner">
              <AlertTriangle size={32} />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-white">سامانه بازیابی شد</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                به دلیل تغییرات اخیر یا خطای موقت در داده‌های مرورگر، صفحه متوقف شد. با کلیک بر روی دکمه‌های زیر می‌توانید بلافاصله برنامه را دوباره فعال نمایید.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl text-right font-mono text-[11px] text-rose-300 overflow-x-auto max-h-36 leading-relaxed select-all">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleResetApp}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>بازنشانی نشست و ورود مجدد</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home size={14} />
                <span>تازه‌سازی صفحه</span>
              </button>

              <button
                type="button"
                onClick={this.handleFullClear}
                className="w-full sm:w-auto px-3.5 py-2.5 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 active:scale-95 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                title="پاکسازی کامل حافظه موقت در صورت تداوم مشکل"
              >
                <Trash2 size={13} />
                <span>پاکسازی حافظه</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
