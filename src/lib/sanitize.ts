import DOMPurify from 'dompurify';

/**
 * Sanitize user input to prevent XSS attacks
 * Use this for any user-generated content that will be rendered as HTML
 */
export const sanitizeHTML = (dirty: string): string => {
    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
        ALLOWED_ATTR: ['href', 'target'],
    });
};

/**
 * Sanitize and truncate text
 */
export const sanitizeText = (text: string, maxLength?: number): string => {
    const sanitized = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
    if (maxLength && sanitized.length > maxLength) {
        return sanitized.substring(0, maxLength) + '...';
    }
    return sanitized;
};

/**
 * Validate and sanitize URL
 */
export const sanitizeURL = (url: string): string | null => {
    try {
        const parsed = new URL(url);
        // Only allow http and https protocols
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.href;
        }
        return null;
    } catch {
        return null;
    }
};
