// dateParser.js - Parse Indonesian date formats

const DAYS = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
const MONTHS = ['januari', 'februari', 'maret', 'april', 'mei', 'juni',
    'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];

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

/**
 * Parse Indonesian month name to month index
 */
function parseMonth(monthName) {
    const idx = MONTHS.indexOf(monthName.toLowerCase());
    return idx >= 0 ? idx : null;
}

/**
 * Parse Indonesian date/time text
 * Supports: besok, lusa, senin, selasa depan, 20 januari, tanggal 25, minggu ini, minggu depan
 * @param {string} text - Text containing date
 * @returns {Date|null} Parsed date or null
 */
export function parseDate(text) {
    if (!text) return null;

    const today = new Date();
    const lower = text.toLowerCase().trim();

    // Relative dates
    if (lower === 'besok' || lower === 'bsk') {
        return addDays(today, 1);
    }

    if (lower === 'lusa') {
        return addDays(today, 2);
    }

    if (lower === 'hari ini' || lower === 'today') {
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

    // Absolute dates: "20 januari", "tanggal 25"
    const dateMatch = lower.match(/(?:tanggal\s+)?(\d{1,2})(?:\s+(\w+))?/);
    if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        let month = today.getMonth();
        let year = today.getFullYear();

        if (dateMatch[2]) {
            const parsedMonth = parseMonth(dateMatch[2]);
            if (parsedMonth !== null) {
                month = parsedMonth;
                // If month is in the past, assume next year
                if (month < today.getMonth()) {
                    year++;
                }
            }
        } else {
            // No month specified - if day is in the past, assume next month
            if (day < today.getDate()) {
                month++;
                if (month > 11) {
                    month = 0;
                    year++;
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

    return `${day} ${month.charAt(0).toUpperCase() + month.slice(1)}`;
}

/**
 * Format date relative to today
 * @param {Date} date - Date to format
 * @returns {string} Relative string (e.g., "besok", "Senin depan", "15 Januari")
 */
export function formatDateRelative(date) {
    if (!date) return '';

    const today = new Date();
    const diffDays = Math.floor((date - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'hari ini';
    if (diffDays === 1) return 'besok';
    if (diffDays === 2) return 'lusa';
    if (diffDays < 7) {
        return DAYS[date.getDay()].charAt(0).toUpperCase() + DAYS[date.getDay()].slice(1);
    }

    return formatDate(date);
}
