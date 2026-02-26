import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import { View, StyleSheet, Platform, StyleProp, ViewStyle } from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { getDirection } from '../utils/rtlUtils';

export interface RichTextEditorRef {
    getHtml: () => Promise<string>;
    focus: () => void;
    blur: () => void;
    setHtml: (html: string) => void;
    editorRef: React.RefObject<RichEditor | null>;
    sendAction: (action: actions, value?: any) => void;
    registerToolbar: (listener: (items: any[]) => void) => void;
}

export interface RichTextEditorProps {
    initialHtml: string;
    onChange?: (html: string) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    placeholder?: string;
    showToolbar?: boolean;
    toolbarActions?: Array<actions>;
    onStatusChange?: (actions: string[]) => void;
    useContainer?: boolean;
    style?: StyleProp<ViewStyle>;
    [key: string]: any;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(({
    initialHtml,
    onChange,
    onFocus,
    onBlur,
    onStatusChange,
    placeholder = 'התחל לכתוב...',
    showToolbar = false,
    useContainer = true,
    toolbarActions = [
        actions.setBold,
        actions.setItalic,
        actions.setUnderline,
        actions.insertBulletsList,
        actions.insertOrderedList,
        actions.removeFormat
    ],
    style,
    ...rest
}, ref) => {
    const richText = useRef<RichEditor>(null);
    const [editorHTML, setEditorHTML] = useState(initialHtml);
    const editorHTMLRef = useRef(initialHtml);

    // Sync ref with initial prop if it changes (though usually initialHtml is stable)
    useEffect(() => {
        editorHTMLRef.current = initialHtml;
    }, [initialHtml]);

    useImperativeHandle(ref, () => ({
        getHtml: async () => {
            // Some Pell versions update ref.current?.getContentHtml(), but we can also track via ref from onChange
            return await richText.current?.getContentHtml() || editorHTMLRef.current;
        },
        focus: () => {
            richText.current?.focusContentEditor();
        },
        blur: () => {
            richText.current?.blurContentEditor();
        },
        setHtml: (html: string) => {
            richText.current?.setContentHTML(html);
        },
        editorRef: richText,
        sendAction: (action: actions, value?: any) => {
            richText.current?.sendAction(action, value || 'result');
        },
        registerToolbar: (listener: (items: any[]) => void) => {
            richText.current?.registerToolbar(listener);
        }
    }), []);

    const handleChange = (descriptionText: string) => {
        editorHTMLRef.current = descriptionText;
        setEditorHTML(descriptionText);
        onChange?.(descriptionText);
    };

    const flatStyle = StyleSheet.flatten(style) || {};
    const isFlex = !!flatStyle.flex;
    const maxHeight = typeof flatStyle.maxHeight === 'number' ? flatStyle.maxHeight : undefined;
    const minHeight = typeof flatStyle.minHeight === 'number' ? flatStyle.minHeight : 44; // Give slightly more room for min-height to prevent jumping

    // Determine direction based on text content (strip HTML tags first)
    const textOnly = editorHTMLRef.current.replace(/<[^>]*>?/gm, '');
    const isRtl = getDirection(textOnly) === 'rtl';

    return (
        <View style={[styles.container, style]}>
            {showToolbar && Platform.OS !== 'web' && (
                <View style={styles.toolbarContainer}>
                    <RichToolbar
                        editor={richText}
                        actions={toolbarActions}
                        iconTint="#6200EE"
                        selectedIconTint="#FFF"
                        selectedButtonStyle={{ backgroundColor: '#6200EE' }}
                        style={styles.richBar}
                    />
                </View>
            )}

            <View style={[styles.editorContainer, isFlex ? { flex: 1 } : { minHeight, maxHeight }]}>
                <RichEditor
                    scrollEnabled={true}
                    {...rest}
                    ref={richText}
                    initialFocus={rest.autoFocus}
                    firstFocusEnd={false}
                    editorInitializedCallback={() => {
                        if (rest.autoFocus) {
                            setTimeout(() => {
                                richText.current?.focusContentEditor();
                            }, 100);
                        }
                        if (rest.editorInitializedCallback) rest.editorInitializedCallback();
                    }}
                    onChange={handleChange}
                    placeholder={placeholder}
                    initialContentHTML={initialHtml}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    {...({ onStatusChange } as any)}
                    editorStyle={{
                        backgroundColor: 'transparent',
                        color: '#1A1A1A',
                        placeholderColor: '#A9A9A9',
                        cssText: `
                            body {
                                font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", sans-serif;
                                font-size: 16px;
                                line-height: 1.5;
                                direction: ${isRtl ? 'rtl' : 'ltr'};
                                text-align: ${isRtl ? 'right' : 'left'};
                                padding: 0 !important;
                                min-height: 0 !important;
                            }
                            ${isRtl ? `
                            ul, ol {
                                padding-right: 24px !important;
                                padding-left: 0 !important;
                                margin-right: 0 !important;
                            }
                            .x-todo li {
                                position: relative !important;
                            }
                            .x-todo-box {
                                position: absolute !important;
                                left: auto !important;
                                right: -24px !important;
                                top: 4px !important;
                                width: 16px !important;
                                height: 16px !important;
                                display: flex !important;
                                align-items: center !important;
                                justify-content: center !important;
                            }
                            .x-todo-box input {
                                position: relative !important;
                                left: auto !important;
                                right: auto !important;
                                margin: 0 !important;
                                width: 16px !important;
                                height: 16px !important;
                                appearance: auto !important;
                                -webkit-appearance: checkbox !important;
                                opacity: 1 !important;
                                visibility: visible !important;
                                display: block !important;
                            }
                            ` : ''}
                        `
                    }}
                    useContainer={useContainer}
                    style={[styles.richEditor, isFlex ? { flex: 1 } : { minHeight, maxHeight }]}
                    initialHeight={minHeight}
                />
            </View>
        </View>
    );
});

RichTextEditor.displayName = 'RichTextEditor';

const styles = StyleSheet.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
    },
    toolbarContainer: {
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    richBar: {
        height: 48,
        backgroundColor: '#F8F8F8',
    },
    editorContainer: {
    },
    richEditor: {
    }
});
