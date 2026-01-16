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

    let str = text.toString().toLowerCase().trim();

    // 1. Check Slang
    if (SLANG[str]) return SLANG[str];

    // 2. Check Suffixes (rb, k, jt, m)
    // Suffix Logic: BOTH dot matches and comma matches are treated as Decimal Separators for multipliers
    // e.g. 1.5jt = 1.5 million. 1,5jt = 1.5 million.
    const suffixMatch = str.match(/([\d.,]+)\s*(rb|ribu|k|jt|juta|m|milyar|miliar)$/);
    if (suffixMatch) {
        let numberPart = suffixMatch[1];
        const suffix = suffixMatch[2];

        // Normalized: replace comma with dot to parse as float
        numberPart = numberPart.replace(',', '.');

        // Safety: more than one dot? e.g. 1.5.5jt -> Invalid
        if ((numberPart.match(/\./g) || []).length > 1) return 0;

        const val = parseFloat(numberPart);
        if (isNaN(val)) return 0;

        if (['rb', 'ribu', 'k'].includes(suffix)) return val * 1000;
        if (['jt', 'juta'].includes(suffix)) return val * 1000000;
        if (['m', 'milyar', 'miliar'].includes(suffix)) return val * 1000000000;
    }

    // 3. No Suffix -> Strict Indonesian Format
    // Allow dots as thousand separators. Comma as decimal.
    // e.g. 1.500.000 -> 1500000
    // e.g. 1.500 -> 1500
    // e.g. 1,5 -> 1.5 (float) -> Invalid for IDR usually, but valid math
    // e.g. 1.5 -> Invalid/Ambiguous (cannot be 1500 because 5 has only 1 digit)

    // Check for "Ambiguous Dot" (Format 1.X where X is 1-2 digits)
    // Valid thousand separator must be followed by 3 digits (1.000)
    // Regex: dot followed by strictly 3 digits, OR dot followed by 3 digits then end/another dot

    // Simplest STRICT strategy for NO SUFFIX:
    // - Remove all dots (thousand separators)
    // - Replace comma with dot (decimal)
    // - VALIDATE ORIGINAL STRING format

    // Pattern: Digits, optionally dots in correct places, optionally comma at end

    // If string contains dots, ensure they are 3-digit groups? 
    // Actually, "1.500" is valid (1500). "1.50" invalid. "1.5" invalid.

    // Logic: 
    // If it has dot but NO comma:
    // Check if every dot is followed by 3 digits. 

    if (str.includes('.')) {
        // Validation: Dots must be followed by 3 digits, unless it's the last group? 
        // No, standard thousand separator is ALWAYS 3 digits. 
        // 1.500 = OK. 1.50 = NOT OK. 1.5 = NOT OK. 
        // 10.000.000 = OK.

        const parts = str.split('.');
        // All parts except the first MUST be 3 digits
        for (let i = 1; i < parts.length; i++) {
            // Handle cases like "1.500,00" -> The last part might have comma
            const cleanPart = parts[i].split(',')[0];
            if (cleanPart.length !== 3) {
                // Invalid format, e.g. 1.5 or 1.50
                return 0; // Treat as invalid/ambiguous
            }
        }
    }

    // Safe to clean
    // Remove dots (thousands)
    let cleanStr = str.replace(/\./g, '');
    // Replace comma with dot (decimal)
    cleanStr = cleanStr.replace(',', '.');

    const amount = parseFloat(cleanStr);

    // 4. "Negligible Amount" logic (200 -> 200k)
    // Only apply if user typed a SIMPLE integer (no dots, no commas) to avoid confusion
    // e.g. "200" -> 200000. "200.000" -> 200000.
    if (!str.includes('.') && !str.includes(',') && amount > 0 && amount < 1000) {
        return amount * 1000;
    }

    return isNaN(amount) ? 0 : amount;
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
