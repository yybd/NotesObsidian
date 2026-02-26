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
import { toggleHeading, toggleList, toggleCheckbox } from '../utils/markdownUtils';


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

    // Calculate active states
    const { start, end } = getSelection();

    // Bold is active if there is text selected AND it starts/ends with ** OR if the surrounding text has **
    let isBoldActive = false;
    if (text) {
        const selected = text.substring(start, end);
        if (selected.length > 0 && selected.startsWith('**') && selected.endsWith('**')) {
            isBoldActive = true;
        } else {
            const beforeSelection = text.substring(0, start);
            const afterSelection = text.substring(end);
            if (beforeSelection.endsWith('**') && afterSelection.startsWith('**')) {
                isBoldActive = true;
            }
        }
    }

    // Find current line to check block-level formatting
    let lineStart = start;
    while (lineStart > 0 && text[lineStart - 1] !== '\n') {
        lineStart--;
    }
    const currentLine = text.substring(lineStart);

    const isH1Active = currentLine.startsWith('# ');
    const isListActive = currentLine.startsWith('- ') && !currentLine.startsWith('- [');
    const isCheckboxActive = currentLine.match(/^- \[[ xX]\] /) !== null;

    const applyTextChange = (newText: string, newSelection?: { start: number; end: number }) => {
        if (newSelection) {
            inputRef.current?.setTextAndSelection?.(newText, newSelection);
            if (onSelectionChangeRequest) onSelectionChangeRequest(newSelection);
        } else {
            inputRef.current?.setText?.(newText);
        }
        onTextChange(newText);
        inputRef.current?.focus();
    };

    // Insert text at cursor position
    const insertAtCursor = (insertText: string) => {
        const { start, end } = getSelection();
        const before = text.substring(0, start);
        const after = text.substring(end);
        const newText = before + insertText + after;
        applyTextChange(newText, { start: start + insertText.length, end: start + insertText.length });
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
            applyTextChange(newText, { start: start, end: end - prefix.length - suffix.length });
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
            applyTextChange(newText, { start: start - prefix.length, end: end - prefix.length });
            return;
        }

        // 3. Otherwise, wrap the selection (or insert at cursor if no selection)
        if (start === end) {
            // No selection - just insert markers with cursor between
            const before = text.substring(0, start);
            const after = text.substring(end);
            const newText = before + prefix + suffix + after;
            applyTextChange(newText, { start: start + prefix.length, end: start + prefix.length });
        } else {
            // Has selection - wrap selected text
            const before = text.substring(0, start);
            const after = text.substring(end);
            const newText = before + prefix + selected + suffix + after;
            applyTextChange(newText, { start: start + prefix.length, end: end + prefix.length });
        }
    };

    // Insert or remove heading at start of current line (Toggle)
    const insertHeading = () => {
        const { start } = getSelection();
        const result = toggleHeading(text, start);
        applyTextChange(result.text, result.selection);
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

    // Insert or remove list item at start of current line (Toggle)
    const insertList = () => {
        const { start } = getSelection();
        const result = toggleList(text, start);
        applyTextChange(result.text, result.selection);
    };

    // Insert or remove checkbox at start of current line (Toggle)
    const insertCheckbox = () => {
        const { start } = getSelection();
        const result = toggleCheckbox(text, start);
        applyTextChange(result.text, result.selection);
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
                    style={[styles.button, isH1Active && styles.activeButton]}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Text style={[styles.buttonText, isH1Active && styles.activeButtonText]}>H1</Text>
                </TouchableOpacity>

                {/* Bold Button */}
                <TouchableOpacity
                    onPress={insertBold}
                    style={[styles.button, isBoldActive && styles.activeButton]}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Text style={[styles.boldText, isBoldActive && styles.activeButtonText]}>B</Text>
                </TouchableOpacity>

                {/* List Button */}
                <TouchableOpacity
                    onPress={insertList}
                    style={[styles.button, isListActive && styles.activeButton]}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="list" size={22} color={isListActive ? "#FFFFFF" : "#6200EE"} />
                </TouchableOpacity>

                {/* Checkbox Button */}
                <TouchableOpacity
                    onPress={insertCheckbox}
                    style={[styles.button, isCheckboxActive && styles.activeButton]}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="checkbox-outline" size={22} color={isCheckboxActive ? "#FFFFFF" : "#6200EE"} />
                </TouchableOpacity>

                {/* Separator */}
                <View style={styles.separator} />

                {/* Pin Button (Optional) */}
                {onPinPress && (
                    <TouchableOpacity
                        onPress={onPinPress}
                        style={[styles.button, isPinned && styles.pinButtonActive]}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
        gap: 12,
    },
    button: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#F5F5F5',
        minWidth: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeButton: {
        backgroundColor: '#6200EE',
    },
    activeButtonText: {
        color: '#FFFFFF',
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
