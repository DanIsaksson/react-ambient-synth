import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

// ============================================================================
// ERROR BOUNDARY
// Catches React errors and provides graceful degradation with recovery options
// ============================================================================

interface ErrorBoundaryProps {
    children: ReactNode;
    /** Fallback UI to show when an error occurs */
    fallback?: ReactNode;
    /** Called when an error is caught */
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    /** Custom recovery action */
    onReset?: () => void;
    /** Level of error boundary (affects recovery strategy) */
    level?: 'app' | 'feature' | 'component';
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.setState({ errorInfo });
        
        // Log error to console with full details
        console.error('[ErrorBoundary] Caught error:', error);
        console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
        
        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);
    }

    handleReset = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        this.props.onReset?.();
    };

    handleReload = (): void => {
        window.location.reload();
    };

    handleGoHome = (): void => {
        window.location.href = '/';
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const { level = 'component' } = this.props;
            const { error } = this.state;

            // Different UI based on error level
            if (level === 'component') {
                return (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <div className="flex items-center gap-2 text-red-400 mb-2">
                            <AlertTriangle size={16} />
                            <span className="text-sm font-medium">Component Error</span>
                        </div>
                        <p className="text-xs text-gray-400 mb-3">
                            {error?.message || 'An unexpected error occurred'}
                        </p>
                        <button
                            onClick={this.handleReset}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                                     bg-red-500/20 hover:bg-red-500/30 text-red-300
                                     rounded-lg transition-colors"
                        >
                            <RefreshCw size={12} />
                            Retry
                        </button>
                    </div>
                );
            }

            if (level === 'feature') {
                return (
                    <div className="flex flex-col items-center justify-center p-8 
                                  bg-gray-900/80 border border-gray-800 rounded-2xl">
                        <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
                        <h3 className="text-lg font-semibold text-white mb-2">
                            Feature Unavailable
                        </h3>
                        <p className="text-sm text-gray-400 text-center mb-4 max-w-md">
                            {error?.message || 'This feature encountered an error and is temporarily unavailable.'}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={this.handleReset}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                                         bg-green-500/20 hover:bg-green-500/30 text-green-400
                                         rounded-lg transition-colors"
                            >
                                <RefreshCw size={14} />
                                Try Again
                            </button>
                        </div>
                    </div>
                );
            }

            // App-level error (most severe)
            return (
                <div className="fixed inset-0 flex items-center justify-center p-4 bg-black">
                    <div className="max-w-lg w-full bg-gray-900 border border-gray-800 
                                  rounded-2xl shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="p-6 bg-red-500/10 border-b border-red-500/20">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-red-500/20 
                                              flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-red-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-white">
                                        Something went wrong
                                    </h2>
                                    <p className="text-sm text-red-300/80">
                                        The app encountered an unexpected error
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Error details */}
                        <div className="p-6">
                            <div className="bg-black/50 rounded-lg p-4 mb-6 font-mono text-xs 
                                          text-gray-400 overflow-auto max-h-32">
                                <div className="text-red-400 font-medium mb-1">
                                    {error?.name}: {error?.message}
                                </div>
                                {this.state.errorInfo?.componentStack && (
                                    <pre className="text-gray-500 whitespace-pre-wrap">
                                        {this.state.errorInfo.componentStack.slice(0, 500)}
                                    </pre>
                                )}
                            </div>

                            {/* Recovery options */}
                            <div className="space-y-2">
                                <button
                                    onClick={this.handleReset}
                                    className="w-full flex items-center justify-center gap-2 
                                             px-4 py-3 text-sm font-medium
                                             bg-green-500/20 hover:bg-green-500/30 text-green-400
                                             rounded-xl transition-colors"
                                >
                                    <RefreshCw size={16} />
                                    Try to Recover
                                </button>
                                <button
                                    onClick={this.handleReload}
                                    className="w-full flex items-center justify-center gap-2 
                                             px-4 py-3 text-sm font-medium
                                             bg-gray-800 hover:bg-gray-700 text-white
                                             rounded-xl transition-colors"
                                >
                                    <RefreshCw size={16} />
                                    Reload Page
                                </button>
                                <button
                                    onClick={this.handleGoHome}
                                    className="w-full flex items-center justify-center gap-2 
                                             px-4 py-3 text-sm font-medium
                                             bg-gray-800/50 hover:bg-gray-800 text-gray-400
                                             rounded-xl transition-colors"
                                >
                                    <Home size={16} />
                                    Go to Home
                                </button>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-800">
                            <a 
                                href="https://github.com/DanIsaksson/react-ambient-synth/issues"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 text-xs 
                                         text-gray-500 hover:text-gray-400 transition-colors"
                            >
                                <Bug size={12} />
                                Report this issue on GitHub
                            </a>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
