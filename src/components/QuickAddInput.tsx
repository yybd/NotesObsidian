import React, { useRef, useImperativeHandle, forwardRef, useState, useCallback, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DomainSelector } from './DomainSelector';
import { SmartEditor, SmartEditorRef } from './SmartEditor';
import { MarkdownToolbar } from './MarkdownToolbar';
import { RichTextToolbar } from './RichTextToolbar';
import { DomainType } from '../types/Note';
import { useNotesStore } from '../stores/notesStore';

interface QuickAddInputProps {
    // State
    text: string;
    isPinned: boolean;
    domain: DomainType | null;
    isSending: boolean;
    keyboardVisible: boolean;
    maxInputHeight: number;
    bottomPadding: number;

    // Callbacks
    onTextChange: (text: string) => void;
    onPinChange: (isPinned: boolean) => void;
    onDomainChange: (domain: DomainType | null) => void;
    onSend: () => void;
    onFocus: () => void;
}

export interface QuickAddInputRef {
    clear: () => void;
    setTextAndSelection: (text: string, sel: { start: number; end: number }) => void;
    blur: () => void;
}

export const QuickAddInput = forwardRef<QuickAddInputRef, QuickAddInputProps>(({
    text,
    isPinned,
    domain,
    isSending,
    keyboardVisible,
    maxInputHeight,
    bottomPadding,
    onTextChange,
    onPinChange,
    onDomainChange,
    onSend,
    onFocus,
}, ref) => {
    const [editorInstance, setEditorInstance] = useState<SmartEditorRef | null>(null);
    // The actual React.RefObject<RichEditor> — extracted once at mount so
    // RichToolbar.componentDidMount always receives a live editor ref.
    const [richEditorRef, setRichEditorRef] = useState<{ current: any } | null>(null);
    const editorRef = useRef<SmartEditorRef>(null);
    const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

    const { settings } = useNotesStore();
    const editorMode = settings.editorMode || 'richtext';

    const handleEditorRef = useCallback((ref: SmartEditorRef | null) => {
        editorRef.current = ref;
        setEditorInstance(ref);
        if (ref && editorMode === 'richtext') {
            const rRef = ref.getRichEditorRef?.() ?? null;
            setRichEditorRef(rRef);
        }
    }, [editorMode]);

    useImperativeHandle(ref, () => ({
        clear: () => {
            editorRef.current?.setText?.('');
        },
        setTextAndSelection: (text: string, sel: { start: number; end: number }) => {
            editorRef.current?.setTextAndSelection?.(text, sel);
        },
        blur: () => {
            editorRef.current?.blur?.();
        }
    }), []);

    return (
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[
                styles.quickNoteContainer, 
                { paddingBottom: bottomPadding },
                keyboardVisible ? { flex: 1 } : {}
            ]}>
                {keyboardVisible && (
                    <DomainSelector
                        selectedDomain={domain}
                        onSelectDomain={onDomainChange}
                        mode="select"
                    />
                )}
                <View style={[styles.inputWrapper, keyboardVisible ? { flex: 1 } : {}]}>
                    <View style={[
                        styles.quickNoteInputContainer, 
                        keyboardVisible ? { flex: 1, alignSelf: 'stretch' } : { maxHeight: maxInputHeight }
                    ]}>
                        <SmartEditor
                            ref={handleEditorRef}
                            initialContent={text}
                            onChange={onTextChange}
                            onSelectionChange={(e: any) => { selectionRef.current = e.nativeEvent.selection; }}
                            style={[{ minHeight: 28 }, keyboardVisible ? { flex: 1 } : {}]}
                            useContainer={true}
                            placeholder="כתוב.."
                            scrollEnabled={true}
                            onFocus={onFocus}
                        />
                    </View>
                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            (!text.trim() || isSending) && styles.sendButtonDisabled
                        ]}
                        onPress={onSend}
                        disabled={!text.trim() || isSending}
                    >
                        {isSending ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Ionicons name="send" size={20} color="#FFFFFF" />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Markdown Toolbar for Quick Note */}
            {keyboardVisible && editorMode === 'markdown' && editorInstance && (
                <MarkdownToolbar
                    inputRef={editorRef as any}
                    text={text}
                    onTextChange={onTextChange}
                    selection={selectionRef.current}
                    onSelectionChangeRequest={(sel) => {
                        editorRef.current?.setSelection?.(sel);
                        selectionRef.current = sel;
                    }}
                    onPinPress={() => onPinChange(!isPinned)}
                    isPinned={isPinned}
                />
            )}
            {keyboardVisible && editorMode === 'richtext' && richEditorRef && (
                <RichTextToolbar
                    richEditorRef={richEditorRef as any}
                    onPinPress={() => onPinChange(!isPinned)}
                    isPinned={isPinned}
                />
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    quickNoteContainer: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    quickNoteInputContainer: {
        flex: 1,
        backgroundColor: '#F0F2F5',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginLeft: 10,
        borderWidth: 1,
        borderColor: '#E4E6EB',
        minHeight: 44,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#6200EE',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#6200EE',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
        marginLeft: 8,
    },
    sendButtonDisabled: {
        backgroundColor: '#CCC',
        shadowOpacity: 0,
    },

});
