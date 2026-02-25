const assert = require('assert');

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

function testInsertList(text, start) {
    let lineStart = start;
    while (lineStart > 0 && text[lineStart - 1] !== '\n') {
        lineStart--;
    }

    let lineEnd = text.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = text.length;
    let currentLineText = text.substring(lineStart, lineEnd);
    
    let referenceText = currentLineText;
    console.log("initial referenceText:", JSON.stringify(referenceText));

    if (!referenceText.trim() && lineStart > 0) {
        let prevLineStart = lineStart - 1;
        while (prevLineStart > 0 && text[prevLineStart - 1] !== '\n') {
            prevLineStart--;
        }
        // This is where the bug might be: lineStart is the index of the start of the current line,
        // which means text[lineStart - 1] is the newline character.
        // So text.substring(prevLineStart, lineStart - 1) gives the string exactly.
        referenceText = text.substring(prevLineStart, lineStart - 1);
        console.log("fallback referenceText:", JSON.stringify(referenceText));
    }

    const isRtl = getDirection(referenceText) === 'rtl';
    const prefix = isRtl ? '- \u200F' : '- ';

    const before = text.substring(0, lineStart);
    const after = text.substring(lineStart);
    const newText = before + prefix + after;
    console.log("newText after:", JSON.stringify(newText));
}

// Test 1: Empty line after Hebrew text
testInsertList("שלום\n", 5);

// Test 2: In the middle of Hebrew text
testInsertList("שלום", 0);

// Test 3: Empty line after English text
testInsertList("hello\n", 6);

