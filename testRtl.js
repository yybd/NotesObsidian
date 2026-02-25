const assert = require('assert');

// Simulate getDirection
function getDirection(text) {
    const cleanText = text
        .replace(/^\s*#+\s*/, '')
        .replace(/^\s*[-*+]\s+/, '')
        .replace(/^\s*\d+\.\s+/, '')
        .replace(/^\s*\[[ xX]\]\s*/, '')
        .replace(/^>+\s*/, '')
        .replace(/[*_~`]/g, '');

    const match = cleanText.match(/[a-zA-Z\u0590-\u05FF\u0600-\u06FF]/);
    if (!match) return 'rtl';

    const charCode = match[0].charCodeAt(0);
    const isRtl = (charCode >= 0x0590 && charCode <= 0x05FF) ||
        (charCode >= 0x0600 && charCode <= 0x06FF);

    return isRtl ? 'rtl' : 'ltr';
}

function testContinuation(oldText, newText) {
    if (newText.length > oldText.length && newText.includes('\n')) {
        const addedChar = newText.substring(oldText.length);
        if (addedChar === '\n' || addedChar.includes('\n')) {
            const cursorPos = newText.lastIndexOf('\n', newText.length - 1);
            const lineStart = newText.lastIndexOf('\n', cursorPos - 1) + 1;
            const previousLine = newText.substring(lineStart, cursorPos);
            
            console.log("Testing:", JSON.stringify(previousLine));

            const listMatch = previousLine.match(/^(?:\u200F)?(\s*- )/);
            if (listMatch) {
                const lineContent = previousLine.substring(listMatch[0].length).trim();
                if (!lineContent) {
                    // Remove
                    return;
                }
                const isRtl = getDirection(previousLine) === 'rtl';
                const prefix = isRtl ? '\u200F- ' : '- ';
                const modifiedText = newText.substring(0, cursorPos + 1) + prefix + newText.substring(cursorPos + 1);
                console.log("Result:", JSON.stringify(modifiedText));
            }
        }
    }
}

testContinuation("שלום\n- בדיקה", "שלום\n- בדיקה\n");
testContinuation("שלום\n\u200F- בדיקה", "שלום\n\u200F- בדיקה\n");
