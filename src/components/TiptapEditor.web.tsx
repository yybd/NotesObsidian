// TiptapEditor.web.tsx
// Web-specific implementation of the Tiptap editor that bypasses react-native-webview.

import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';

// Standard Tiptap imports - these are safe on web.
// We use nested imports if they're not in the root node_modules.
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

export interface TiptapEditorRef {
    getHtml: () => Promise<string>;
    focus: () => void;
    blur: () => void;
    setHtml: (html: string) => void;
    editorBridge: any;
}

export interface TiptapEditorProps {
    initialHtml: string;
    onChange?: (html: string) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    onReady?: () => void;
    placeholder?: string;
    style?: StyleProp<ViewStyle>;
    autoFocus?: boolean;
    backgroundColor?: string;
}

export const TiptapEditor = forwardRef<TiptapEditorRef, TiptapEditorProps>(
    (
        {
            initialHtml,
            onChange,
            onFocus,
            onBlur,
            onReady,
            placeholder = 'התחל לכתוב...',
            style,
            autoFocus = false,
            backgroundColor = 'transparent',
        },
        ref,
    ) => {
        const editorContainerRef = useRef<HTMLDivElement>(null);
        const tiptapEditor = useRef<Editor | null>(null);
        const stateListeners = useRef<((state: any) => void)[]>([]);

        const getEditorState = () => {
            const editor = tiptapEditor.current;
            if (!editor) return {};
            return {
                isBoldActive: editor.isActive('bold'),
                isItalicActive: editor.isActive('italic'),
                isStrikeActive: editor.isActive('strike'),
                isUnderlineActive: editor.isActive('underline'),
                isBulletListActive: editor.isActive('bulletList'),
                isOrderedListActive: editor.isActive('orderedList'),
                isTaskListActive: editor.isActive('taskList'),
                headingLevel: editor.isActive('heading') ? editor.getAttributes('heading').level : 0,
                isFocused: editor.isFocused,
                canToggleBold: editor.can().toggleBold(),
                // Add more as needed by TenTap toolbar
            };
        };

        const notifyStateListeners = () => {
            const state = getEditorState();
            stateListeners.current.forEach(l => l(state));
        };

        useEffect(() => {
            if (!editorContainerRef.current || tiptapEditor.current) return;

            // Initialize Tiptap Editor directly for web
            tiptapEditor.current = new Editor({
                element: editorContainerRef.current,
                extensions: [
                    StarterKit.configure({
                        bulletList: { keepMarks: true, keepAttributes: false },
                        orderedList: { keepMarks: true, keepAttributes: false },
                    }),
                    TaskList,
                    TaskItem.configure({
                        nested: true,
                    }),
                ],
                content: initialHtml,
                autofocus: autoFocus,
                onUpdate: ({ editor }) => {
                    onChange?.(editor.getHTML());
                    notifyStateListeners();
                },
                onSelectionUpdate: () => {
                    notifyStateListeners();
                },
                onFocus: () => {
                    onFocus?.();
                    notifyStateListeners();
                },
                onBlur: () => {
                    onBlur?.();
                    notifyStateListeners();
                },
            });

            // Set initial direction
            editorContainerRef.current.setAttribute('dir', 'auto');
            onReady?.();

            return () => {
                tiptapEditor.current?.destroy();
                tiptapEditor.current = null;
            };
        }, []); // Only initialize once

        // Handle external content changes (e.g. switching notes)
        // without destroying the editor instance.
        useEffect(() => {
            if (tiptapEditor.current && initialHtml !== tiptapEditor.current.getHTML()) {
                // We only set content if it's different to avoid cursor jumps
                // during typing (when initialHtml comes back from parent state).
                tiptapEditor.current.commands.setContent(initialHtml, { emitUpdate: false });
                notifyStateListeners();
            }
        }, [initialHtml]);

        useImperativeHandle(ref, () => ({
            getHtml: async () => tiptapEditor.current?.getHTML() || '',
            focus: () => (tiptapEditor.current as any)?.focus(),
            blur: () => (tiptapEditor.current as any)?.commands.blur(),
            setHtml: (html: string) => tiptapEditor.current?.commands.setContent(html),
            // Mock bridge for compatibility with toolbar logic in parents
            editorBridge: {
                focus: (pos?: 'start' | 'end') => {
                    const editor = tiptapEditor.current;
                    if (!editor) return;
                    if (pos === 'start') editor.chain().focus('start').run();
                    else if (pos === 'end') editor.chain().focus('end').run();
                    else editor.chain().focus().run();
                },
                blur: () => tiptapEditor.current?.chain().blur().run(),
                toggleBold: () => tiptapEditor.current?.chain().focus().toggleBold().run(),
                toggleItalic: () => tiptapEditor.current?.chain().focus().toggleItalic().run(),
                toggleStrike: () => tiptapEditor.current?.chain().focus().toggleStrike().run(),
                toggleHeading: (level: any) => {
                    const l = typeof level === 'object' ? level.level : level;
                    tiptapEditor.current?.chain().focus().toggleHeading({ level: l }).run();
                },
                toggleBulletList: () => tiptapEditor.current?.chain().focus().toggleBulletList().run(),
                toggleOrderedList: () => tiptapEditor.current?.chain().focus().toggleOrderedList().run(),
                toggleTaskList: () => tiptapEditor.current?.chain().focus().toggleTaskList().run(),
                getEditorState,
                _subscribeToEditorStateUpdate: (callback: (state: any) => void) => {
                    stateListeners.current.push(callback);
                    callback(getEditorState());
                    return () => {
                        stateListeners.current = stateListeners.current.filter(l => l !== callback);
                    };
                },
                _subscribeToContentUpdate: () => () => { },
            },
        }), []);

        return (
            <View style={[styles.container, style]}>
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .ProseMirror {
                        outline: none;
                        padding: 16px;
                        min-height: 100%;
                        background-color: ${backgroundColor};
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                        font-size: 16px;
                        line-height: 1.5;
                        overflow-y: auto;
                    }
                    .ProseMirror p { margin-bottom: 0.5em; }
                    .ProseMirror [dir="auto"] { text-align: start; }
                    
                    /* Task List Styles */
                    .ProseMirror ul[data-type="taskList"] {
                        list-style: none;
                        padding: 0;
                        margin: 0;
                    }
                    .ProseMirror ul[data-type="taskList"] li {
                        display: flex;
                        align-items: flex-start;
                        margin-bottom: 0px;
                    }
                    .ProseMirror ul[data-type="taskList"] li > label {
                        flex: 0 0 auto;
                        margin-right: 12px;
                        user-select: none;
                        display: flex;
                        align-items: center;
                        /* This padding offsets the checkbox to align with the first line of text */
                        padding-top: 4px;
                    }
                    .ProseMirror ul[data-type="taskList"] li > div {
                        flex: 1 1 auto;
                    }
                    .ProseMirror ul[data-type="taskList"] li > div > p {
                        margin: 0;
                        padding: 0;
                    }
                    .ProseMirror ul[data-type="taskList"] input[type="checkbox"] {
                        cursor: pointer;
                        width: 1.1em;
                        height: 1.1em;
                        accent-color: #000000;
                        margin: 0;
                    }
                `}} />
                <div
                    ref={editorContainerRef}
                    style={{
                        flex: 1,
                        height: '100%',
                        width: '100%',
                        backgroundColor: backgroundColor
                    }}
                />
            </View>
        );
    },
);

TiptapEditor.displayName = 'TiptapEditor';

const styles = StyleSheet.create({
    container: { flex: 1, width: '100%', height: '100%' },
});
