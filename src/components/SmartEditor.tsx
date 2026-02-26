import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { NativeLiveEditor, NativeLiveEditorRef } from './NativeLiveEditor';
import { RichTextEditor, RichTextEditorRef } from './RichTextEditor';
import { useNotesStore } from '../stores/notesStore';
import MarkdownConverterService from '../services/MarkdownConverterService';

export interface SmartEditorRef {
    getMarkdown: () => Promise<string>;
    focus: () => void;
    blur: () => void;
    setText: (text: string) => void;
    setTextAndSelection: (text: string, sel: { start: number; end: number }) => void;
    setSelection: (sel: { start: number; end: number }) => void;
    getRichEditorRef: () => any;
    sendAction: (action: any, value?: any) => void;
    registerToolbar: (listener: (items: any[]) => void) => void;
}

export interface SmartEditorProps {
    initialContent: string;
    onChange?: (content: string) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    placeholder?: string;
    style?: StyleProp<TextStyle>;
    scrollEnabled?: boolean;
    onStatusChange?: (actions: string[]) => void;
    [key: string]: any; // Allow other props like contentInset, autoFocus, etc.
}

export const SmartEditor = forwardRef<SmartEditorRef, SmartEditorProps>(({
    initialContent,
    onChange,
    onFocus,
    onBlur,
    placeholder,
    style,
    scrollEnabled = true,
    onStatusChange,
    ...rest
}, ref) => {
    const { settings } = useNotesStore();
    const editorMode = settings.editorMode || 'richtext';

    const nativeEditorRef = useRef<NativeLiveEditorRef>(null);
    const richEditorRef = useRef<RichTextEditorRef>(null);

    // Provide a unified imperative handle to the parent
    useImperativeHandle(ref, () => ({
        getMarkdown: async () => {
            if (editorMode === 'markdown') {
                return await nativeEditorRef.current?.getMarkdown() || '';
            } else {
                const html = await richEditorRef.current?.getHtml() || '';
                return MarkdownConverterService.htmlToMarkdown(html);
            }
        },
        focus: () => {
            if (editorMode === 'markdown') {
                nativeEditorRef.current?.focus();
            } else {
                richEditorRef.current?.focus();
            }
        },
        blur: () => {
            if (editorMode === 'markdown') {
                nativeEditorRef.current?.blur();
            } else {
                richEditorRef.current?.blur();
            }
        },
        setText: (text: string) => {
            if (editorMode === 'markdown') {
                nativeEditorRef.current?.setText?.(text);
            } else {
                const html = MarkdownConverterService.markdownToHtml(text);
                richEditorRef.current?.setHtml?.(html);
            }
        },
        setTextAndSelection: (text: string, sel: { start: number; end: number }) => {
            if (editorMode === 'markdown') {
                nativeEditorRef.current?.setTextAndSelection?.(text, sel);
            } else {
                const html = MarkdownConverterService.markdownToHtml(text);
                richEditorRef.current?.setHtml?.(html);
            }
        },
        setSelection: (sel: { start: number; end: number }) => {
            if (editorMode === 'markdown') {
                nativeEditorRef.current?.setSelection?.(sel);
            }
        },
        getRichEditorRef: () => {
            return richEditorRef.current?.editorRef;
        },
        sendAction: (action: any, value?: any) => {
            if (editorMode === 'richtext') {
                richEditorRef.current?.sendAction(action, value);
            }
        },
        registerToolbar: (listener: (items: any[]) => void) => {
            if (editorMode === 'richtext') {
                richEditorRef.current?.registerToolbar(listener);
            }
        }
    }), [editorMode]);

    const handleMarkdownChange = (text: string) => {
        onChange?.(text);
    };

    const handleRichTextChange = (html: string) => {
        const markdown = MarkdownConverterService.htmlToMarkdown(html);
        onChange?.(markdown);
    };

    if (editorMode === 'markdown') {
        return (
            <NativeLiveEditor
                ref={nativeEditorRef}
                initialContent={initialContent}
                onChange={handleMarkdownChange}
                onFocus={onFocus}
                onBlur={onBlur}
                placeholder={placeholder}
                style={style}
                scrollEnabled={scrollEnabled}
                {...rest}
            />
        );
    }

    // Convert initialization text to HTML for the rich text editor
    const initialHtml = MarkdownConverterService.markdownToHtml(initialContent);

    return (
        <RichTextEditor
            ref={richEditorRef}
            initialHtml={initialHtml}
            onChange={handleRichTextChange}
            onFocus={onFocus}
            onBlur={onBlur}
            onStatusChange={onStatusChange}
            placeholder={placeholder}
            style={style}
            // RichTextEditor might not support native insets out of the box, 
            {...rest}
        />
    );
});

SmartEditor.displayName = 'SmartEditor';
