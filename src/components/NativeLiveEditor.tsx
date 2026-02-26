import React, { forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import { StyleSheet, TextInputProps, Platform, StyleProp, TextStyle, TextInput } from 'react-native';
import { MarkdownTextInput, parseExpensiMark } from '@expensify/react-native-live-markdown';
import { getDirection, rtlTextStyle } from '../utils/rtlUtils';


// This interface mirrors what UnifiedRichEditorRef looked like to minimize refactoring in parents
export interface NativeLiveEditorRef {
    getMarkdown: () => Promise<string>;
    focus: () => void;
    blur: () => void;
    setSelection?: (sel: { start: number; end: number }) => void;
    setText?: (text: string) => void;
    setTextAndSelection?: (text: string, sel: { start: number; end: number }) => void;
    insertText?: (text: string) => void;
}

export interface NativeLiveEditorProps extends Omit<TextInputProps, 'onChangeText' | 'onChange'> {
    initialContent?: string;
    onChange?: (content: string) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    selection?: { start: number; end: number };
    onSelectionChange?: (event: any) => void;
    autoFocus?: boolean;
    style?: StyleProp<TextStyle>;
    placeholder?: string;
    contentInset?: { top?: number; right?: number; bottom?: number; left?: number };
    scrollIndicatorInsets?: { top?: number; right?: number; bottom?: number; left?: number };
}
export const NativeLiveEditor = forwardRef<NativeLiveEditorRef, NativeLiveEditorProps>(
    ({ initialContent = '', onChange, placeholder, style, ...props }, ref) => {
        const textInputRef = useRef<any>(null);
        const contentRef = useRef(initialContent); // Track latest native text
        const isExternalUpdate = useRef(false); // Flag to distinguish programmatic vs typing changes
        const lastPropContent = useRef(initialContent); // Track latest prop text to prevent stale overrides

        // Detect programmatic text changes from parent (toolbar, list continuation, clear)
        // and push them to the native component imperatively.
        // We check against lastPropContent to avoid overwriting text due to stale parent re-renders.
        if (initialContent !== lastPropContent.current) {
            lastPropContent.current = initialContent;
            if (initialContent !== contentRef.current) {
                // var is external
                isExternalUpdate.current = true;
                contentRef.current = initialContent;
                // Schedule native update after render
                setTimeout(() => {
                    textInputRef.current?.setNativeProps({ text: initialContent });
                    isExternalUpdate.current = false;
                }, 0);
            }
        }

        // Expose imperative handle to parent components
        useImperativeHandle(ref, () => ({
            getMarkdown: async () => contentRef.current,
            focus: () => {
                console.log(`[NativeLiveEditor] Imperative focus triggered`);
                textInputRef.current?.focus();
            },
            blur: () => {
                textInputRef.current?.blur();
            },
            setSelection: (sel: { start: number; end: number }) => {
                console.log(`[NativeLiveEditor] Imperative setSelection to:`, sel);
                textInputRef.current?.setNativeProps({ selection: sel });
            },
            setText: (text: string) => {
                isExternalUpdate.current = true;
                contentRef.current = text;
                textInputRef.current?.setNativeProps({ text });
                setTimeout(() => { isExternalUpdate.current = false; }, 0);
            },
            setTextAndSelection: (text: string, sel: { start: number; end: number }) => {
                isExternalUpdate.current = true;
                contentRef.current = text;
                textInputRef.current?.setNativeProps({ text, selection: sel });
                setTimeout(() => { isExternalUpdate.current = false; }, 0);
            },
            insertText: (text: string) => {
                const newContent = contentRef.current + text;
                contentRef.current = newContent;
                textInputRef.current?.setNativeProps({ text: newContent });
                onChange?.(newContent);
                setTimeout(() => {
                    textInputRef.current?.focus();
                }, 50);
            }
        }), []);

        const handleChangeText = (text: string) => {
            // Only notify parent if this is a user-initiated change (not our programmatic update)
            if (!isExternalUpdate.current) {
                contentRef.current = text;
                onChange?.(text);
            }
        };

        const isRtlContent = getDirection(contentRef.current) === 'rtl';

        const customParser = useMemo(() => {
            return function parser(input: string) {
                'worklet';
                const ranges = parseExpensiMark(input);

                const listRegex = /(^|\n)([ \t]*)(-[ \t]+\[[xX ]\][ \t]+|-[ \t]+|\d+\.[ \t]+)/g;
                let match;

                while ((match = listRegex.exec(input)) !== null) {
                    const prefixLength = match[1].length + match[2].length;
                    const syntaxStart = match.index + prefixLength;
                    const syntaxLength = match[3].length;

                    ranges.push({
                        type: 'syntax',
                        start: syntaxStart,
                        length: syntaxLength,
                    });
                }

                const headerRegex = /(^|\n)(#{1,6}[ \t]+)/g;
                let headerMatch;
                while ((headerMatch = headerRegex.exec(input)) !== null) {
                    const prefixLength = headerMatch[1].length;
                    ranges.push({
                        type: 'syntax',
                        start: headerMatch.index + prefixLength,
                        length: headerMatch[2].length,
                    });
                }

                return ranges;
            };
        }, []);

        return (
            <MarkdownTextInput
                ref={textInputRef}
                defaultValue={initialContent}
                onChangeText={handleChangeText}
                placeholder={placeholder || ''}
                parser={customParser}
                style={[
                    styles.input,
                    rtlTextStyle(isRtlContent ? 'rtl' : 'ltr'),
                    style
                ]}
                markdownStyle={{
                    syntax: { color: '#BDBDBD' },
                    code: { color: '#000000', backgroundColor: '#F0F0F0' }
                }}
                multiline
                scrollEnabled={true}
                textAlignVertical="top"
                contentInset={props.contentInset}
                scrollIndicatorInsets={props.scrollIndicatorInsets}
                {...props}
            />
        );
    }
);

NativeLiveEditor.displayName = 'NativeLiveEditor';

const styles = StyleSheet.create({
    input: {
        fontSize: 16,
        color: '#1A1A1A',
        lineHeight: 24,
        padding: 0, // Reset padding for cleaner integration
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
        width: '100%',
    }
});
