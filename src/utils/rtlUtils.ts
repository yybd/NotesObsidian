// rtlUtils.ts - Centralized RTL configuration and utilities
// All RTL-related logic, constants, and styles live here.

import { TextStyle, ViewStyle } from 'react-native';
import { getLocales } from 'expo-localization';

// ── Device Locale Detection ──────────────────────────────────────────

/** RTL language codes */
const RTL_LANGUAGES = ['he', 'ar', 'fa', 'ur', 'yi'];

/** Detect the device's primary language using expo-localization */
const getDeviceLanguage = (): string => {
    try {
        const locales = getLocales();
        return locales[0]?.languageCode?.toLowerCase() || 'en';
    } catch {
        return 'en';
    }
};

// ── Constants ────────────────────────────────────────────────────────

/** Default direction based on the device's language */
export const DEFAULT_DIRECTION: 'rtl' | 'ltr' = RTL_LANGUAGES.includes(getDeviceLanguage()) ? 'rtl' : 'ltr';

// ── Direction Detection ──────────────────────────────────────────────

/**
 * Detect text direction based on the first letter character found.
 * Strips markdown syntax before detecting.
 * Returns DEFAULT_DIRECTION ('rtl') when no letter characters are found.
 */
export const getDirection = (text: string): 'rtl' | 'ltr' => {
    // Strip out markdown syntax at the start of strings (headers, lists, bold, checkboxes, etc)
    const cleanText = text
        .replace(/^\s*#+\s*/, '')       // Headers
        .replace(/^\s*[-*+]\s+/, '')    // Unordered lists
        .replace(/^\s*\d+\.\s+/, '')    // Ordered lists
        .replace(/^\s*\[[ xX]\]\s*/, '') // Checkboxes
        .replace(/^>+\s*/, '')          // Blockquotes
        .replace(/[*_~`]/g, '');        // Inline formatting

    // Find the first letter character
    const match = cleanText.match(/[a-zA-Z\u0590-\u05FF\u0600-\u06FF]/);
    if (!match) return DEFAULT_DIRECTION;

    // Check if it's Hebrew or Arabic
    const charCode = match[0].charCodeAt(0);
    const isRtl = (charCode >= 0x0590 && charCode <= 0x05FF) || // Hebrew
        (charCode >= 0x0600 && charCode <= 0x06FF);              // Arabic

    return isRtl ? 'rtl' : 'ltr';
};

// ── Style Helpers ────────────────────────────────────────────────────

/** Static RTL text style - for elements that are always RTL */
export const RTL_TEXT_STYLE: TextStyle = {
    textAlign: 'right',
    writingDirection: 'rtl',
};

/** Dynamic text style based on detected direction */
export const rtlTextStyle = (direction: 'rtl' | 'ltr'): TextStyle => ({
    textAlign: direction === 'rtl' ? 'right' : 'left',
    writingDirection: direction,
});

/** RTL flex row style - for row-reverse layout */
export const RTL_ROW: ViewStyle = {
    flexDirection: 'row-reverse',
};
