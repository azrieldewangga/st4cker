import { DURATION_REGEX_HOURS, DURATION_REGEX_MINS, MARKDOWN_ESCAPE_REGEX } from './constants.js';

export function escapeMarkdown(text) {
    if (!text) return '';
    return text.toString().replace(MARKDOWN_ESCAPE_REGEX, '\\$1');
}

export function parseDuration(str) {
    if (!str) return null;

    let totalMinutes = 0;
    const hours = str.match(DURATION_REGEX_HOURS);
    const mins = str.match(DURATION_REGEX_MINS);

    if (hours) totalMinutes += parseFloat(hours[1]) * 60;
    if (mins) totalMinutes += parseFloat(mins[1]);

    // Fallback: if just a number is given, assume minutes? 
    // Or follow original logic which seemed to support plain numbers
    if (!hours && !mins && !isNaN(parseFloat(str))) {
        totalMinutes = parseFloat(str);
    }

    return totalMinutes > 0 ? Math.round(totalMinutes) : null;
}

export function formatDate(dateObj) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}
