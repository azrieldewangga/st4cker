// dateParser.js - Parse Indonesian date formats

const DAYS = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
const MONTHS = ['januari', 'februari', 'maret', 'april', 'mei', 'juni',
    'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];

function getJakartaNow() {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
}

/**
 * Add days to a date
 */
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Get end of week (Sunday)
 */
function getEndOfWeek(date) {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() + (7 - day));
    return result;
}

function parseMonth(monthName) {
    const lower = monthName.toLowerCase();
    const map = {
        'jan': 0, 'januari': 0, 'january': 0,
        'feb': 1, 'februari': 1, 'february': 1, 'pebruari': 1,
        'mar': 2, 'maret': 2, 'march': 2,
        'apr': 3, 'april': 3,
        'mei': 4, 'may': 4,
        'jun': 5, 'juni': 5, 'june': 5,
        'jul': 6, 'juli': 6, 'july': 6,
        'agu': 7, 'agustus': 7, 'aug': 7, 'august': 7,
        'sep': 8, 'september': 8,
        'okt': 9, 'oktober': 9, 'oct': 9, 'october': 9,
        'nov': 10, 'november': 10,
        'des': 11, 'desember': 11, 'dec': 11, 'december': 11
    };

    if (map[lower] !== undefined) return map[lower];
    // Check startsWith for strict "jan", "feb" handling if map fails?
    // Map should cover it.

    return null;
}

/**
 * Parse Indonesian date/time text
 * Supports: besok, lusa, senin, selasa depan, 20 januari, tanggal 25, minggu ini, minggu depan
 * @param {string} text - Text containing date
 * @returns {Date|null} Parsed date or null
 */
export function parseDate(text) {
    if (!text) return null;

    const today = getJakartaNow();
    const lower = text.toLowerCase().trim();

    // ISO Date Format (YYYY-MM-DD) - Priority check for Gemini output
    const isoMatch = lower.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        const y = parseInt(isoMatch[1]);
        const m = parseInt(isoMatch[2]) - 1; // Month is 0-indexed
        const d = parseInt(isoMatch[3]);
        return new Date(y, m, d);
    }

    // Relative dates
    if (/\bbesok\b|\bbsk\b/i.test(lower)) {
        return addDays(today, 1);
    }

    if (/\blusa\b/i.test(lower)) {
        return addDays(today, 2);
    }

    if (/\bhari ini\b|\btoday\b/i.test(lower)) {
        return today;
    }

    if (lower === 'kemarin') {
        return addDays(today, -1);
    }

    // Week-based
    if (lower.includes('minggu ini')) {
        return getEndOfWeek(today);
    }

    if (lower.includes('minggu depan')) {
        return addDays(getEndOfWeek(today), 7);
    }

    if (lower.includes('bulan ini')) {
        return new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    if (lower.includes('bulan depan')) {
        return new Date(today.getFullYear(), today.getMonth() + 2, 0);
    }

    // Day names
    for (let i = 0; i < DAYS.length; i++) {
        if (lower.includes(DAYS[i])) {
            let diff = (i - today.getDay() + 7) % 7;
            if (diff === 0) diff = 7; // Same day = next week

            // Check for "depan" modifier
            if (lower.includes('depan')) {
                diff += 7;
            }

            return addDays(today, diff);
        }
    }

    // Absolute dates: "20 januari", "tanggal 25", "25 mar 2026"
    // Regex matches: Day (1-2 digits), separator, Month (word), separator, Year (4 digits, optional)
    const dateMatch = lower.match(/(?:tanggal\s+)?(\d{1,2})(?:[\s/-]+(\w+))?(?:[\s/-]+(\d{4}))?/);

    if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        let month = today.getMonth();
        let year = today.getFullYear();

        // Check for Year (Group 3)
        if (dateMatch[3]) {
            year = parseInt(dateMatch[3]);
        }

        if (dateMatch[2]) {
            const parsedMonth = parseMonth(dateMatch[2]);
            if (parsedMonth !== null) {
                month = parsedMonth;
                // Only auto-increment year if NO year was provided
                if (!dateMatch[3] && month < today.getMonth()) {
                    year++;
                }
            }
        } else {
            // No month specified - if day is in the past, assume next month
            if (day < today.getDate()) {
                month++;
                if (month > 11) {
                    month = 0;
                    // Only auto-increment year if NO year was provided
                    if (!dateMatch[3]) year++;
                }
            }
        }

        return new Date(year, month, day);
    }

    return null;
}

/**
 * Format date to Indonesian format
 * @param {Date} date - Date to format
 * @returns {string} Formatted string (e.g., "15 Januari", "Senin")
 */
export function formatDate(date) {
    if (!date) return '';

    const day = date.getDate();
    const month = MONTHS[date.getMonth()];

    // Capitalize month
    const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
    return `${day} ${monthCap}`;
}

/**
 * Format date relative to today
 * @param {Date} date - Date to format
 * @returns {string} Relative string (e.g., "besok", "Senin depan", "15 Januari")
 */
export function formatDateRelative(date) {
    if (!date) return '';

    const today = getJakartaNow();

    // Reset hours for pure day difference calculation
    const d1 = new Date(date); d1.setHours(0, 0, 0, 0);
    const d2 = new Date(today); d2.setHours(0, 0, 0, 0);

    const diffTime = d1 - d2;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'hari ini';
    if (diffDays === 1) return 'besok';
    if (diffDays === 2) return 'lusa';
    if (diffDays === -1) return 'kemarin';

    if (diffDays > 0 && diffDays < 7) {
        const dayName = DAYS[date.getDay()];
        return dayName.charAt(0).toUpperCase() + dayName.slice(1);
    }

    return formatDate(date);
}
