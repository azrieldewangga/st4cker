import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        // You can also log the error to an error reporting service here
    }

    public handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
                    <Card className="max-w-md w-full border-destructive/20 shadow-lg">
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit mb-2">
                                <AlertTriangle className="h-8 w-8 text-destructive" />
                            </div>
                            <CardTitle className="text-xl">Something went wrong</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center space-y-2">
                            <p className="text-muted-foreground text-sm">
                                The application encountered an unexpected error and needs to restart.
                            </p>
                            {/* Optional: Show error message in dev mode */}
                            {import.meta.env.DEV && this.state.error && (
                                <div className="mt-4 p-3 bg-muted rounded-md text-xs text-left font-mono overflow-auto max-h-32 border">
                                    {this.state.error.message}
                                </div>
                            )}
                        </CardContent>
                        <CardFooter>
                            <Button onClick={this.handleReload} className="w-full">
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reload Application
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}
