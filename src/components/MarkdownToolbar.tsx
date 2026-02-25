// MarkdownToolbar.tsx - Floating markdown formatting toolbar
// For use with plain TextInput - inserts raw markdown syntax

import React from 'react';
import {
    View,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    TextInput,
    Keyboard,
    Text,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { NativeLiveEditorRef } from './NativeLiveEditor';


interface MarkdownToolbarProps {
    inputRef: React.RefObject<NativeLiveEditorRef | null>;
    text: string;
    onTextChange: (text: string) => void;
    selection?: { start: number; end: number };
    onSelectionChangeRequest?: (selection: { start: number; end: number }) => void;
    onPinPress?: () => void;
    isPinned?: boolean;
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({
    inputRef,
    text,
    onTextChange,
    selection,
    onSelectionChangeRequest,
    onPinPress,
    isPinned,
}) => {
    // Get current cursor position or selection and ensure it is mathematically ordered
    const getSelection = (): { start: number; end: number } => {
        // Use provided selection or default to end of text
        const rawSelection = selection || { start: text.length, end: text.length };
        return {
            start: Math.min(rawSelection.start, rawSelection.end),
            end: Math.max(rawSelection.start, rawSelection.end),
        };
    };

    // Insert text at cursor position
    const insertAtCursor = (insertText: string) => {
        // Fallback or old method:
        // UnifiedRichEditor doesn't currently expose `insertText` or `wrapSelection` directly,
        // but we can simulate it with onTextChange for now or update it in the future to map.
        // For right now, let's keep the manual React Native logic
        const { start, end } = getSelection();
        const before = text.substring(0, start);
        const after = text.substring(end);
        const newText = before + insertText + after;
        onTextChange(newText);

        // Refocus and set cursor after inserted text
        setTimeout(() => {
            inputRef.current?.focus();
        }, 50);
    };

    // Wrap selected text with prefix and suffix (or unwrap if already wrapped)
    const wrapSelection = (prefix: string, suffix: string) => {
        const { start, end } = getSelection();

        // 1. Check if the selection ITSELF contains the prefix and suffix at the edges
        const selected = text.substring(start, end);
        if (selected.length >= prefix.length + suffix.length &&
            selected.startsWith(prefix) &&
            selected.endsWith(suffix)) {
            // Unwrap from within the selection
            const unwrapped = selected.substring(prefix.length, selected.length - suffix.length);
            const before = text.substring(0, start);
            const after = text.substring(end);
            const newText = before + unwrapped + after;
            onTextChange(newText);

            if (onSelectionChangeRequest) {
                onSelectionChangeRequest({ start: start, end: end - prefix.length - suffix.length });
            }
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
            return;
        }

        // 2. Check if the text SURROUNDING the selection contains the prefix and suffix
        const beforeSelection = text.substring(0, start);
        const afterSelection = text.substring(end);

        if (beforeSelection.endsWith(prefix) && afterSelection.startsWith(suffix)) {
            // Unwrap from outside the selection
            const beforeWithoutPrefix = beforeSelection.substring(0, beforeSelection.length - prefix.length);
            const afterWithoutSuffix = afterSelection.substring(suffix.length);
            const newText = beforeWithoutPrefix + selected + afterWithoutSuffix;
            onTextChange(newText);

            if (onSelectionChangeRequest) {
                onSelectionChangeRequest({ start: start - prefix.length, end: end - prefix.length });
            }
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
            return;
        }

        // 3. Otherwise, wrap the selection (or insert at cursor if no selection)
        if (start === end) {
            // No selection - just insert markers with cursor between
            const before = text.substring(0, start);
            const after = text.substring(end);
            const newText = before + prefix + suffix + after;
            onTextChange(newText);

            if (onSelectionChangeRequest) {
                onSelectionChangeRequest({ start: start + prefix.length, end: start + prefix.length });
            }
        } else {
            // Has selection - wrap selected text
            const before = text.substring(0, start);
            const after = text.substring(end);
            const newText = before + prefix + selected + suffix + after;
            onTextChange(newText);

            if (onSelectionChangeRequest) {
                onSelectionChangeRequest({ start: start + prefix.length, end: end + prefix.length });
            }
        }

        setTimeout(() => {
            inputRef.current?.focus();
        }, 50);
    };

    // Insert heading at start of current line
    const insertHeading = () => {
        const { start } = getSelection();

        // Find start of current line
        let lineStart = start;
        while (lineStart > 0 && text[lineStart - 1] !== '\n') {
            lineStart--;
        }

        // Check if line already starts with #
        const lineContent = text.substring(lineStart);
        if (lineContent.startsWith('# ')) {
            // Already has heading, don't add another
            inputRef.current?.focus();
            return;
        }

        const before = text.substring(0, lineStart);
        const after = text.substring(lineStart);
        const newText = before + '# ' + after;
        onTextChange(newText);

        if (onSelectionChangeRequest) {
            onSelectionChangeRequest({ start: start + 2, end: start + 2 });
        }
        setTimeout(() => {
            inputRef.current?.focus();
        }, 50);
    };

    // Insert bold markers around selection (only if text is selected)
    const insertBold = () => {
        const { start, end } = getSelection();
        if (start === end) {
            // No text selected, don't apply bold formatting
            inputRef.current?.focus();
            return;
        }
        wrapSelection('**', '**');
    };

    // Insert list item at start of current line
    const insertList = () => {
        const { start } = getSelection();

        // Find start of current line
        let lineStart = start;
        while (lineStart > 0 && text[lineStart - 1] !== '\n') {
            lineStart--;
        }

        // Check if line already starts with -
        const lineContent = text.substring(lineStart);
        if (lineContent.startsWith('- ')) {
            inputRef.current?.focus();
            return;
        }

        // Add RTL marker if current line or previous line is RTL
        let lineEnd = text.indexOf('\n', lineStart);
        if (lineEnd === -1) lineEnd = text.length;
        const currentLineText = text.substring(lineStart, lineEnd);

        let referenceText = currentLineText;
        if (!referenceText.trim() && lineStart > 0) {
            let prevLineStart = lineStart - 1;
            while (prevLineStart > 0 && text[prevLineStart - 1] !== '\n') {
                prevLineStart--;
            }
            referenceText = text.substring(prevLineStart, lineStart - 1);
        }

        const prefix = '- ';

        const before = text.substring(0, lineStart);
        const after = text.substring(lineStart);
        const newText = before + prefix + after;
        onTextChange(newText);

        if (onSelectionChangeRequest) {
            onSelectionChangeRequest({ start: start + prefix.length, end: start + prefix.length });
        }
        setTimeout(() => {
            inputRef.current?.focus();
        }, 50);
    };

    // Insert checkbox at start of current line
    const insertCheckbox = () => {
        const { start } = getSelection();

        // Find start of current line
        let lineStart = start;
        while (lineStart > 0 && text[lineStart - 1] !== '\n') {
            lineStart--;
        }

        // Check if line already has checkbox
        const lineContent = text.substring(lineStart);
        if (lineContent.match(/^- \[([ xX])\] /)) {
            inputRef.current?.focus();
            return;
        }

        // Add RTL marker if current line or previous line is RTL
        let lineEnd = text.indexOf('\n', lineStart);
        if (lineEnd === -1) lineEnd = text.length;
        const currentLineText = text.substring(lineStart, lineEnd);

        let referenceText = currentLineText;
        if (!referenceText.trim() && lineStart > 0) {
            let prevLineStart = lineStart - 1;
            while (prevLineStart > 0 && text[prevLineStart - 1] !== '\n') {
                prevLineStart--;
            }
            referenceText = text.substring(prevLineStart, lineStart - 1);
        }

        const prefix = '- [ ] ';

        const before = text.substring(0, lineStart);
        const after = text.substring(lineStart);
        const newText = before + prefix + after;
        onTextChange(newText);

        if (onSelectionChangeRequest) {
            onSelectionChangeRequest({ start: start + prefix.length, end: start + prefix.length });
        }
        setTimeout(() => {
            inputRef.current?.focus();
        }, 50);
    };

    // Dismiss keyboard
    const dismissKeyboard = () => {
        Keyboard.dismiss();
        inputRef.current?.blur();
    };

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="always"
            >
                {/* Heading Button */}
                <TouchableOpacity
                    onPress={insertHeading}
                    style={styles.button}
                    activeOpacity={0.7}
                >
                    <Text style={styles.buttonText}>H1</Text>
                </TouchableOpacity>

                {/* Bold Button */}
                <TouchableOpacity
                    onPress={insertBold}
                    style={styles.button}
                    activeOpacity={0.7}
                >
                    <Text style={styles.boldText}>B</Text>
                </TouchableOpacity>

                {/* List Button */}
                <TouchableOpacity
                    onPress={insertList}
                    style={styles.button}
                    activeOpacity={0.7}
                >
                    <Ionicons name="list" size={22} color="#6200EE" />
                </TouchableOpacity>

                {/* Checkbox Button */}
                <TouchableOpacity
                    onPress={insertCheckbox}
                    style={styles.button}
                    activeOpacity={0.7}
                >
                    <Ionicons name="checkbox-outline" size={22} color="#6200EE" />
                </TouchableOpacity>

                {/* Separator */}
                <View style={styles.separator} />

                {/* Pin Button (Optional) */}
                {onPinPress && (
                    <TouchableOpacity
                        onPress={onPinPress}
                        style={[styles.button, isPinned && styles.pinButtonActive]}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons
                            name={isPinned ? "pin" : "pin-outline"}
                            size={22}
                            color={isPinned ? "#FFC107" : "#666"}
                        />
                    </TouchableOpacity>
                )}

                {/* Dismiss Keyboard Button */}
                <TouchableOpacity
                    onPress={dismissKeyboard}
                    style={[styles.button, styles.dismissButton]}
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-down" size={22} color="#666" />
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
        gap: 4,
    },
    button: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#F5F5F5',
        minWidth: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    boldIcon: {
        fontWeight: 'bold',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6200EE',
    },
    boldText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#6200EE',
    },
    separator: {
        width: 1,
        height: 24,
        backgroundColor: '#E0E0E0',
        marginHorizontal: 4,
    },
    dismissButton: {
        backgroundColor: '#FFF3E0',
    },
    pinButtonActive: {
        backgroundColor: '#E8DEF8',
    },
});
