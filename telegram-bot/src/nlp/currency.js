// currency.js - Parse Indonesian currency formats

const SLANG = {
    'gocap': 50000,
    'cepe': 100000,
    'gopek': 500000,
    'sejuta': 1000000,
    'duajuta': 2000000
};

/**
 * Parse amount from Indonesian currency format
 * Supports: 50rb, 50ribu, 50k, 2jt, 2juta, gocap, cepe, etc.
 * @param {string} text - Text containing amount
 * @returns {number} Parsed amount in IDR
 */
export function parseAmount(text) {
    if (!text) return 0;

    const lower = text.toString().toLowerCase().replace(/\./g, '').replace(/,/g, '.');

    // Check slang first
    if (SLANG[lower]) {
        return SLANG[lower];
    }

    // Pattern: number + suffix (rb, ribu, k, jt, juta)
    if (lower.match(/[\d.]+\s*(rb|ribu)$/)) {
        return parseFloat(lower.replace(/[^\d.]/g, '')) * 1000;
    }

    if (lower.match(/[\d.]+\s*k$/)) {
        return parseFloat(lower.replace(/[^\d.]/g, '')) * 1000;
    }

    if (lower.match(/[\d.]+\s*(jt|juta)$/)) {
        return parseFloat(lower.replace(/[^\d.]/g, '')) * 1000000;
    }

    // Handle decimal juta: 1.5jt -> 1500000
    if (lower.match(/[\d.]+\s*(jt|juta)/)) {
        const num = parseFloat(lower.match(/[\d.]+/)[0]);
        return num * 1000000;
    }

    // Plain number
    // Plain number
    const cleaned = lower.replace(/[^\d.]/g, '');
    if (!cleaned) return 0;
    const plainNum = parseFloat(cleaned);

    // Intuitive fix: If user types "200" or "50", they usually mean "200k" or "50k"
    // because 200 rupiah is negligible.
    if (!isNaN(plainNum) && plainNum > 0 && plainNum < 1000) {
        return plainNum * 1000;
    }

    return isNaN(plainNum) ? 0 : plainNum;
}

/**
 * Format amount to Indonesian format
 * @param {number} amount - Amount in IDR
 * @returns {string} Formatted string (e.g., "50rb", "2jt")
 */
export function formatAmount(amount) {
    if (amount >= 1000000) {
        const jt = amount / 1000000;
        return jt % 1 === 0 ? `${jt}jt` : `${jt.toFixed(1)}jt`;
    }
    if (amount >= 1000) {
        const rb = amount / 1000;
        return rb % 1 === 0 ? `${rb}rb` : `${rb.toFixed(1)}rb`;
    }
    return amount.toString();
}
