import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
                    <div className="rounded-xl bg-card shadow-2xl max-w-lg w-full border border-border">
                        <div className="p-6 flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-2">
                                <AlertTriangle className="w-8 h-8 text-destructive" />
                            </div>
                            <h2 className="text-2xl font-bold text-card-foreground">Oops! Something went wrong.</h2>
                            <p className="opacity-70 mt-2">
                                We encountered an unexpected error. Please try reloading the application.
                            </p>

                            <div className="bg-muted p-4 rounded-lg w-full mt-4 text-left overflow-auto max-h-48 border border-border">
                                <code className="text-xs font-mono opacity-80 break-words">
                                    {this.state.error && this.state.error.toString()}
                                </code>
                            </div>

                            <div className="mt-6 w-full">
                                <button
                                    className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground h-10 px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
                                    onClick={() => window.location.reload()}
                                >
                                    <RefreshCw size={18} />
                                    Reload Application
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
