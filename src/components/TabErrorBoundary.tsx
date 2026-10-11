import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronRight, Copy, Check, Bug } from 'lucide-react';
import { reportClientError } from '../lib/clientErrorReporter';

interface Props {
  children: ReactNode;
  tabName?: string;
  onNavigateHome?: () => void;
  onReportBug?: (trackingCode?: string, errorMsg?: string) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  trackingCode: string | null;
  copied: boolean;
}

export class TabErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    trackingCode: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const code = reportClientError({
      eventType: 'client_error',
      severity: 'error',
      sectionName: this.props.tabName || 'بخش نامشخص',
      shortMessage: error.message || 'خطای بارگذاری در تب',
      stack: error.stack,
      metadata: { componentStack: errorInfo.componentStack?.substring(0, 300) }
    });
    this.setState({ trackingCode: code });
    console.warn(`[TabErrorBoundary] Error caught in tab: ${this.props.tabName || 'unknown'}:`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, trackingCode: null, copied: false });
  };

  private handleCopyError = () => {
    const info = `کد پیگیری: ${this.state.trackingCode || 'ثبت نشده'}
بخش: ${this.props.tabName || 'نامشخص'}
پیام خطا: ${this.state.error?.message || 'خطای نامشخص'}
زمان: ${new Date().toLocaleTimeString('fa-IR')}
سامانه مدرسه علمیه تخصصی امام کاظم (ع)`;

    navigator.clipboard.writeText(info).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 3000);
    }).catch(() => {});
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
            {this.state.trackingCode && (
              <div className="inline-block mt-1 px-3 py-1 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono font-bold rounded-lg">
                کد پیگیری خطا: {this.state.trackingCode}
              </div>
            )}
          </div>
          {this.state.error && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-right font-mono text-[11px] text-rose-700 max-w-lg mx-auto overflow-x-auto">
              {this.state.error.message || String(this.state.error)}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <RefreshCw size={14} />
              <span>تلاش مجدد</span>
            </button>
            <button
              type="button"
              onClick={this.handleCopyError}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {this.state.copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{this.state.copied ? 'اطلاعات کپی شد' : 'کپی اطلاعات خطا'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (this.props.onReportBug) {
                  this.props.onReportBug(this.state.trackingCode || undefined, this.state.error?.message);
                } else if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('open-bug-report-modal', {
                    detail: {
                      trackingCode: this.state.trackingCode,
                      errorMessage: this.state.error?.message,
                      sectionName: this.props.tabName
                    }
                  }));
                }
              }}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Bug size={14} />
              <span>گزارش مشکل به پشتیبانی</span>
            </button>
            {this.props.onNavigateHome && (
              <button
                type="button"
                onClick={this.props.onNavigateHome}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <ChevronRight size={14} />
                <span>بازگشت</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
