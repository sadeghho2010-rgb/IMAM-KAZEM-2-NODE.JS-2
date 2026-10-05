import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react';

interface Props {
  children: ReactNode;
  tabName?: string;
  onNavigateHome?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class TabErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn(`[TabErrorBoundary] Error caught in tab: ${this.props.tabName || 'unknown'}:`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white rounded-3xl border border-rose-200/80 p-6 sm:p-8 text-center space-y-4 shadow-sm" dir="rtl">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
            <AlertTriangle size={28} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-black text-slate-800">
              خطای بارگذاری در {this.props.tabName || 'این بخش'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              مشکلی در بارگذاری داده‌های این بخش رخ داد. سایر بخش‌های سامانه کاملاً فعال هستند.
            </p>
          </div>
          {this.state.error && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-right font-mono text-[11px] text-rose-700 max-w-lg mx-auto overflow-x-auto">
              {this.state.error.message || String(this.state.error)}
            </div>
          )}
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <RefreshCw size={14} />
              <span>تلاش مجدد</span>
            </button>
            {this.props.onNavigateHome && (
              <button
                type="button"
                onClick={this.props.onNavigateHome}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <LayoutDashboard size={14} />
                <span>بازگشت به داشبورد</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
