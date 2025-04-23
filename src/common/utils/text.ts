/**
 * Formats Ethereum addresses by removing any extra spaces
 */
export const formatAddressText = (text: string): string => {
    return text.replace(/\b(0x[a-fA-F0-9]{40})\b/g, (match) => match.replace(/\s+/g, ''));
};

/**
 * Formats token amounts and symbols (e.g., "0.01 USDT")
 */
export const formatTokenText = (text: string): string => {
    return text.replace(/(\d*\.?\d+)\s*([A-Z]{2,})/g, '$1 $2');
};

/**
 * Formats text by:
 * 1. Removing extra spaces between characters
 * 2. Preserving Ethereum addresses
 * 3. Properly formatting token amounts and symbols
 */
export const formatText = (text: string): string => {
    // Remove extra spaces between characters
    text = text.replace(/(?<=\S)\s+(?=\S)/g, ' ');
    // Format addresses
    text = formatAddressText(text);
    // Format token amounts and symbols
    text = formatTokenText(text);
    return text;
}; 