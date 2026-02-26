// markdownUtils.ts - Pure utility functions for markdown manipulation

/**
 * Handles text updates to smoothly continue markdown lists and checkboxes when Enter is pressed.
 *
 * @param newText - The updated text (including the new newline)
 * @param oldText - The previous text
 * @returns An object with the new computed text and the new cursor position, or null if no list continuation is needed.
 */
export const handleListContinuation = (
    newText: string,
    oldText: string
): { modifiedText: string; newCursorPos: number; cursorShouldMove: boolean } | null => {
    // Only process if text was added
    if (newText.length <= oldText.length) return null;

    // Find the first difference index
    let diffIndex = 0;
    while (diffIndex < oldText.length && newText[diffIndex] === oldText[diffIndex]) {
        diffIndex++;
    }

    let insertedText = newText.substring(diffIndex, diffIndex + newText.length - oldText.length);

    // If we inserted a newline but the diff stopped *after* an identical newline,
    // we back up diffIndex so we evaluate the text immediately preceding the insertion correctly.
    while (diffIndex > 0 && insertedText === '\n' && newText[diffIndex - 1] === '\n') {
        diffIndex--;
    }

    // Check if the inserted text ends with a newline, or contains a newline
    if (insertedText === '\n' || insertedText.endsWith('\n')) {
        const newlinePos = diffIndex + insertedText.length - 1;

        // Find the line in newText UP TO the point the insertion happened
        // We use newText.substring(0, diffIndex) which represents the exact line the user pressed Enter on
        const textBeforeEnter = newText.substring(0, diffIndex);
        const lineStart = textBeforeEnter.lastIndexOf('\n') + 1;
        const previousLine = textBeforeEnter.substring(lineStart);

        // Check for checkbox pattern: e.g. "- [ ] " or "* [x] "
        const checkboxMatch = previousLine.match(/^(\s*[-*+]\s*\[[ xX]\] |\s*\d+\.\s*\[[ xX]\] )/);
        if (checkboxMatch) {
            const lineContent = previousLine.substring(checkboxMatch[0].length).trim();
            if (!lineContent) {
                // Remove the empty checkbox line and the newline
                const cleanedText = newText.substring(0, lineStart) + newText.substring(newlinePos + 1);
                return { modifiedText: cleanedText, newCursorPos: lineStart, cursorShouldMove: true };
            }

            let prefix = '- [ ] ';
            if (previousLine.match(/^\s*\d+\./)) {
                const numMatch = previousLine.match(/^(\s*)(\d+)(\.\s*\[[ xX]\] )/);
                if (numMatch) {
                    prefix = `${numMatch[1]}${parseInt(numMatch[2], 10) + 1}${numMatch[3].replace(/[xX]/, ' ')}`;
                }
            } else {
                const match = previousLine.match(/^(\s*[-*+]\s*)\[[ xX]\] /);
                if (match) {
                    prefix = `${match[1]}[ ] `;
                }
            }

            const modifiedText = newText.substring(0, newlinePos + 1) + prefix + newText.substring(newlinePos + 1);
            return { modifiedText, newCursorPos: newlinePos + 1 + prefix.length, cursorShouldMove: true };
        }

        // Check for regular list pattern: "- ", "* ", "1. "
        const listMatch = previousLine.match(/^(\s*[-*+]\s+|\s*\d+\.\s+)/);
        if (listMatch) {
            const lineContent = previousLine.substring(listMatch[0].length).trim();
            if (!lineContent) {
                // Remove the empty list line and the newline
                const cleanedText = newText.substring(0, lineStart) + newText.substring(newlinePos + 1);
                return { modifiedText: cleanedText, newCursorPos: lineStart, cursorShouldMove: true };
            }

            let prefix = '- ';
            if (previousLine.match(/^\s*\d+\./)) {
                const numMatch = previousLine.match(/^(\s*)(\d+)(\.\s+)/);
                if (numMatch) {
                    prefix = `${numMatch[1]}${parseInt(numMatch[2], 10) + 1}${numMatch[3]}`;
                }
            } else {
                const match = previousLine.match(/^(\s*[-*+]\s+)/);
                if (match) {
                    prefix = match[1];
                }
            }

            const modifiedText = newText.substring(0, newlinePos + 1) + prefix + newText.substring(newlinePos + 1);
            return { modifiedText, newCursorPos: newlinePos + 1 + prefix.length, cursorShouldMove: true };
        }
    }

    return null;
};

/**
 * Toggles a markdown checkbox in the given content based on its visual index.
 * Only targets checkboxes (checked or unchecked).
 *
 * @param content - The full markdown content containing the checklist
 * @param checklistIndexTarget - The index of the checkbox to toggle (0-based, counting only checkboxes)
 * @returns The updated markdown content, or the original if not found
 */
export const toggleCheckboxByIndex = (content: string, checklistIndexTarget: number): string => {
    const lines = content.split('\n');
    let currentChecklistIndex = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match standard markdown task items
        const isTask = line.match(/^\s*[-*+]\s*\[([ xX])\]/) || line.match(/^\s*\d+\.\s*\[([ xX])\]/);

        if (isTask) {
            if (currentChecklistIndex === checklistIndexTarget) {
                const isChecking = line.match(/\[ \]/);

                if (isChecking) {
                    const toggledLine = line.replace('[ ]', '[x]');
                    let endOfBlock = i;
                    // Move the checked item to the end of the current contiguous checklist block
                    while (endOfBlock + 1 < lines.length) {
                        const nextLine = lines[endOfBlock + 1];
                        const isNextTask = nextLine.match(/^\s*[-*+]\s*\[([ xX])\]/) || nextLine.match(/^\s*\d+\.\s*\[([ xX])\]/);
                        if (isNextTask) {
                            endOfBlock++;
                        } else {
                            break;
                        }
                    }
                    if (endOfBlock > i) {
                        lines.splice(i, 1);
                        lines.splice(endOfBlock, 0, toggledLine);
                    } else {
                        lines[i] = toggledLine;
                    }
                } else {
                    // Uncheck the item
                    lines[i] = line.replace(/\[x\]/i, '[ ]');
                }
                return lines.join('\n');
            }
            currentChecklistIndex++;
        }
    }

    return content;
};

/**
 * Appends a new, unchecked checklist item after the last checklist item found in the markdown text.
 *
 * @param markdown - The markdown text
 * @returns The updated markdown text with the new item appended, or the original text if no checklist exists
 */
export const appendChecklistItem = (markdown: string): string => {
    const lines = markdown.split('\n');
    let lastChecklistIndex = -1;

    for (let i = lines.length - 1; i >= 0; i--) {
        if (/^- \[[ xX]\]/.test(lines[i])) {
            lastChecklistIndex = i;
            break;
        }
    }

    if (lastChecklistIndex !== -1) {
        const prefix = '- [ ] ';
        lines.splice(lastChecklistIndex + 1, 0, prefix);
        return lines.join('\n');
    }

    return markdown;
};

/**
 * Toggles a heading (# ) at the start of a given line within markdown text.
 * @param text - The full markdown text
 * @param start - The cursor position
 */
export const toggleHeading = (text: string, start: number) => {
    let lineStart = start;
    while (lineStart > 0 && text[lineStart - 1] !== '\n') {
        lineStart--;
    }

    const lineContent = text.substring(lineStart);
    let newText = '';
    let newCursorPos = start;

    if (lineContent.startsWith('# ')) {
        const before = text.substring(0, lineStart);
        const after = text.substring(lineStart + 2); // Remove `# `
        newText = before + after;
        newCursorPos = Math.max(lineStart, start - 2);
    } else {
        const before = text.substring(0, lineStart);
        const after = text.substring(lineStart);
        newText = before + '# ' + after;
        newCursorPos = start + 2;
    }

    return { text: newText, selection: { start: newCursorPos, end: newCursorPos } };
};

/**
 * Toggles a list item (- ) at the start of a given line within markdown text.
 * @param text - The full markdown text
 * @param start - The cursor position
 */
export const toggleList = (text: string, start: number) => {
    let lineStart = start;
    while (lineStart > 0 && text[lineStart - 1] !== '\n') {
        lineStart--;
    }

    const lineContent = text.substring(lineStart);
    let newText = '';
    let newCursorPos = start;

    if (lineContent.match(/^- \[[ xX]\] /)) {
        const before = text.substring(0, lineStart);
        const after = text.substring(lineStart + 6); // remove '- [x] ' (6 chars)
        newText = before + '- ' + after;
        newCursorPos = Math.max(lineStart + 2, start - 4);
    } else if (lineContent.startsWith('- ')) {
        const before = text.substring(0, lineStart);
        const after = text.substring(lineStart + 2); // remove '- '
        newText = before + after;
        newCursorPos = Math.max(lineStart, start - 2);
    } else {
        const prefix = '- ';
        const before = text.substring(0, lineStart);
        const after = text.substring(lineStart);
        newText = before + prefix + after;
        newCursorPos = start + 2;
    }

    return { text: newText, selection: { start: newCursorPos, end: newCursorPos } };
};

/**
 * Toggles a checkbox (- [ ]) at the start of a given line within markdown text.
 * @param text - The full markdown text
 * @param start - The cursor position
 */
export const toggleCheckbox = (text: string, start: number) => {
    let lineStart = start;
    while (lineStart > 0 && text[lineStart - 1] !== '\n') {
        lineStart--;
    }

    const lineContent = text.substring(lineStart);
    let newText = '';
    let newCursorPos = start;

    const checkboxMatch = lineContent.match(/^- \[[ xX]\] /);

    if (checkboxMatch) {
        const matchLen = checkboxMatch[0].length;
        const before = text.substring(0, lineStart);
        const after = text.substring(lineStart + matchLen);
        newText = before + after;
        newCursorPos = Math.max(lineStart, start - matchLen);
    } else if (lineContent.startsWith('- ')) {
        const before = text.substring(0, lineStart);
        const after = text.substring(lineStart + 2); // remove '- '
        newText = before + '- [ ] ' + after;
        newCursorPos = start + 4; // cursor diff between '- ' and '- [ ] '
    } else {
        const prefix = '- [ ] ';
        const before = text.substring(0, lineStart);
        const after = text.substring(lineStart);
        newText = before + prefix + after;
        newCursorPos = start + prefix.length;
    }

    return { text: newText, selection: { start: newCursorPos, end: newCursorPos } };
};
