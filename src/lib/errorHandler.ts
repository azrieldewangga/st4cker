import { toast } from 'sonner';

export class AppError extends Error {
    constructor(
        message: string,
        public code: string,
        public severity: 'error' | 'warning' | 'info' = 'error'
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export const handleError = (error: unknown, context: string = 'Unknown') => {
    console.error(`[${context}]`, error);

    if (error instanceof AppError) {
        switch (error.severity) {
            case 'error':
                toast.error(error.message);
                break;
            case 'warning':
                toast.warning(error.message);
                break;
            case 'info':
                toast.info(error.message);
                break;
        }
    } else if (error instanceof Error) {
        toast.error(error.message || 'An unexpected error occurred');
    } else {
        toast.error('An unexpected error occurred');
    }

    // TODO: Send to error tracking service (Sentry, etc.)
    // if (isDev) return;
    // Sentry.captureException(error, { tags: { context } });
};

export const createValidationError = (message: string) => {
    return new AppError(message, 'VALIDATION_ERROR', 'warning');
};

export const createNetworkError = (message: string = 'Network error occurred') => {
    return new AppError(message, 'NETWORK_ERROR', 'error');
};

export const createNotFoundError = (resource: string) => {
    return new AppError(`${resource} not found`, 'NOT_FOUND', 'error');
};
