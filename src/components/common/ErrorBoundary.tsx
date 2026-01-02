import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public handleReload = () => {
        window.location.reload();
    };

    public handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center min-h-screen p-6 bg-background">
                    <Card className="w-full max-w-md border-destructive/50 shadow-lg animate-in fade-in zoom-in-95 duration-200">
                        <CardHeader>
                            <div className="flex items-center gap-2 text-destructive mb-2">
                                <AlertCircle className="h-6 w-6" />
                                <CardTitle className="text-xl">Something went wrong</CardTitle>
                            </div>
                            <CardDescription>
                                We encountered an unexpected error. This might be a temporary issue.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md bg-muted p-4 font-mono text-xs text-destructive break-words max-h-40 overflow-auto">
                                {this.state.error?.message || "Unknown error occurred"}
                            </div>
                        </CardContent>
                        <CardFooter className="gap-2 justify-end">
                            <Button variant="outline" onClick={this.handleReload}>
                                <RefreshCw className="mr-2 h-4 w-4" /> Reload App
                            </Button>
                            <Button variant="default" onClick={this.handleReset}>
                                <RotateCcw className="mr-2 h-4 w-4" /> Try Again
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

                            </div >
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
                        </div >
                    </div >
                </div >
            );
        }

return this.props.children;
    }
}

export default ErrorBoundary;
