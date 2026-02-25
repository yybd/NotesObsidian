// NoteEditorScreen.tsx - TenTap Rich Text Editor
// True WYSIWYG: shows formatted text, saves markdown to file
// Toolbar floats above keyboard, RTL support

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    Text,
    SafeAreaView,
    ActivityIndicator,
    ScrollView,
    Platform,
    Keyboard,
    StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeLiveEditor, NativeLiveEditorRef } from '../components/NativeLiveEditor';
import { MarkdownToolbar } from '../components/MarkdownToolbar';
import { DomainSelector } from '../components/DomainSelector';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNotesStore } from '../stores/notesStore';
import { Note, DomainType } from '../types/Note';
import FrontmatterService, { updateFrontmatter, removeFrontmatterKey } from '../services/FrontmatterService';
import { RTL_TEXT_STYLE } from '../utils/rtlUtils';

export const NoteEditorScreen = ({ navigation, route }: any) => {
    // Safe Area Insets for bottom padding
    const insets = useSafeAreaInsets();
    const existingNoteFromRoute = route.params?.note;
    const { createNote, updateNote } = useNotesStore();

    // Parse content immediately to separate frontmatter from body
    // We use a ref or simple const because route params don't change
    const initialParse = useRef(
        existingNoteFromRoute?.content
            ? FrontmatterService.parseFrontmatter(existingNoteFromRoute.content)
            : { frontmatter: {}, body: '' }
    ).current;

    // Checklist detection
    const [hasChecklist, setHasChecklist] = useState(false);

    // Domain & Frontmatter state
    const [domain, setDomain] = useState<DomainType | null>(initialParse.frontmatter.domain as DomainType || null);
    const [isPinned, setIsPinned] = useState<boolean>(initialParse.frontmatter.pinned === true);
    const [otherFrontmatter, setOtherFrontmatter] = useState<Record<string, any>>(() => {
        const { domain: _, ...others } = initialParse.frontmatter;
        return others;
    });
    const [showToast, setShowToast] = useState(false);

    // Refs for accessing state in closures (TenTap bridge callbacks)
    const domainRef = useRef(domain);
    const otherFrontmatterRef = useRef(otherFrontmatter);
    const isPinnedRef = useRef(isPinned);

    useEffect(() => {
        domainRef.current = domain;
    }, [domain]);

    useEffect(() => {
        isPinnedRef.current = isPinned;
    }, [isPinned]);

    useEffect(() => {
        otherFrontmatterRef.current = otherFrontmatter;
    }, [otherFrontmatter]);

    const [title, setTitle] = useState(existingNoteFromRoute?.title || '');
    const [savingStatus, setSavingStatus] = useState<'saved' | 'saving' | 'error'>('saved');
    const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
    const lastSavedContent = useRef(existingNoteFromRoute?.content || '');
    const cssInjected = useRef(false);

    // Track the current note (either from route or after first create)
    const currentNoteRef = useRef<Note | null>(existingNoteFromRoute || null);
    const editorRef = useRef<NativeLiveEditorRef>(null);

    // Initial content (Body only)
    const initialBody = initialParse.body || '';
    const [bodyText, setBodyText] = useState(initialBody);
    const [selection, setSelection] = useState({ start: 0, end: 0 });

    // Set cursor to end of text when mounting
    useEffect(() => {
        setTimeout(() => {
            setSelection({ start: initialBody.length, end: initialBody.length });
        }, 100);
    }, []);

    // Initialize checklist state
    useEffect(() => {
        setHasChecklist(/[-\*]\s?\[[ x]\]/i.test(initialBody));
    }, [initialBody]);

    // Keyboard state
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSubscription = Keyboard.addListener(showEvent, (e) => {
            setKeyboardHeight(e.endCoordinates.height);
            setIsKeyboardVisible(true);
        });
        const hideSubscription = Keyboard.addListener(hideEvent, () => {
            setIsKeyboardVisible(false);
            setKeyboardHeight(0);
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    const handleEditorChange = (bodyMarkdown: string) => {
        setBodyText(bodyMarkdown);
        setSavingStatus('saving');

        if (autoSaveTimer.current) {
            clearTimeout(autoSaveTimer.current);
        }

        autoSaveTimer.current = setTimeout(async () => {
            try {
                let fullContent = FrontmatterService.composeContent(
                    { ...otherFrontmatterRef.current, domain: domainRef.current },
                    bodyMarkdown
                );

                // Apply pinned state
                if (isPinnedRef.current) {
                    fullContent = updateFrontmatter(fullContent, 'pinned', true);
                } else {
                    fullContent = removeFrontmatterKey(fullContent, 'pinned');
                }

                if (fullContent !== lastSavedContent.current && title.trim()) {
                    if (currentNoteRef.current) {
                        // Update existing note
                        await updateNote(
                            currentNoteRef.current.id,
                            currentNoteRef.current.filePath,
                            fullContent
                        );
                    } else {
                        // Create new note and store reference for future saves
                        const newNote = await createNote(title, fullContent);
                        currentNoteRef.current = newNote;
                    }
                    lastSavedContent.current = fullContent;
                }

                // Update checklist state
                const detected = /\[[ xX]\]/i.test(bodyMarkdown);
                setHasChecklist(detected);

                setSavingStatus('saved');
            } catch (error) {
                console.error('Save error:', error);
                setSavingStatus('error');
            }
        }, 1500);
    };

    useEffect(() => {
        navigation.setOptions({
            headerShown: false,
        });

        return () => {
            if (autoSaveTimer.current) {
                clearTimeout(autoSaveTimer.current);
            }
        };
    }, []);

    const handleBack = async () => {
        // Get final content and save
        try {
            const bodyMarkdown = await editorRef.current?.getMarkdown() || '';

            let fullContent = FrontmatterService.composeContent(
                { ...otherFrontmatterRef.current, domain: domain },
                bodyMarkdown
            );

            // Apply pinned state
            if (isPinned) {
                fullContent = updateFrontmatter(fullContent, 'pinned', true);
            } else {
                fullContent = removeFrontmatterKey(fullContent, 'pinned');
            }

            if (title.trim() && fullContent !== lastSavedContent.current) {
                if (currentNoteRef.current) {
                    await updateNote(
                        currentNoteRef.current.id,
                        currentNoteRef.current.filePath,
                        fullContent
                    );
                } else {
                    await createNote(title, fullContent);
                }
            }
        } catch (error) {
            console.error('Final save error:', error);
        }

        navigation.goBack();
    };

    const appendChecklistItem = (markdown: string): string => {
        // Find the last occurrence of a checklist item
        const lines = markdown.split('\n');
        let lastChecklistIndex = -1;

        for (let i = lines.length - 1; i >= 0; i--) {
            if (/^- \[[ xX]\]/.test(lines[i])) {
                lastChecklistIndex = i;
                break;
            }
        }

        if (lastChecklistIndex !== -1) {
            // Check direction of the last checklist item
            const lastChecklistItem = lines[lastChecklistIndex];
            const prefix = '- [ ] ';

            // Insert new item after the last checklist item
            lines.splice(lastChecklistIndex + 1, 0, prefix);
            return lines.join('\n');
        }

        return markdown;
    };

    const handleAddItem = async () => {
        try {
            const bodyMarkdown = bodyText;
            const newBodyMarkdown = appendChecklistItem(bodyMarkdown);

            setBodyText(newBodyMarkdown);
            editorRef.current?.focus();

            // Trigger save
            if (currentNoteRef.current) {
                let fullContent = FrontmatterService.composeContent(
                    { ...otherFrontmatterRef.current, domain: domainRef.current },
                    newBodyMarkdown
                );

                // Apply pinned state
                if (isPinnedRef.current) {
                    fullContent = updateFrontmatter(fullContent, 'pinned', true);
                } else {
                    fullContent = removeFrontmatterKey(fullContent, 'pinned');
                }

                await updateNote(
                    currentNoteRef.current.id,
                    currentNoteRef.current.filePath,
                    fullContent
                );
                lastSavedContent.current = fullContent;
            }

        } catch (error) {
            console.error('Error adding item:', error);
        }
    };

    // Render saving status indicator
    const renderSavingStatus = () => {
        if (savingStatus === 'saving') {
            return <ActivityIndicator size="small" color="#6200EE" />;
        } else if (savingStatus === 'error') {
            return <Ionicons name="alert-circle" size={20} color="#F44336" />;
        }
        return <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />;
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Custom Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
                    <Ionicons name="arrow-back" size={24} color="#6200EE" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>עריכת פתק</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={() => {
                            const newPinned = !isPinned;
                            setIsPinned(newPinned);
                            // Trigger save to persist metadata immediately
                            setSavingStatus('saving');

                            // We need to update the content with the new pin state
                            // But we can't easily get the *current* editor content here without async
                            // So we'll update our internal refs and let the next auto-save or back action handle the content
                            // However, we should try to update the frontmatter in our refs at least

                            // Best approach for immediate feedback:
                            // 1. Update state (done)
                            // 2. We'll inject this into the content during save/back
                        }}
                        style={styles.headerButton}
                    >
                        <MaterialCommunityIcons
                            name={isPinned ? "pin" : "pin-outline"}
                            size={24}
                            color={isPinned ? "#FFC107" : "#666"}
                        />
                    </TouchableOpacity>
                    <View style={styles.statusContainer}>
                        {renderSavingStatus()}
                    </View>
                </View>
            </View>

            {/* Title Input */}
            <View style={styles.titleContainer}>
                <TextInput
                    style={[
                        styles.titleInput,
                        { writingDirection: 'auto', textAlign: 'auto' }
                    ]}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="כותרת הפתק"
                    placeholderTextColor="#999"
                />
            </View>

            {/* Domain Selector */}
            {isKeyboardVisible && (
                <View style={styles.domainContainer}>
                    <DomainSelector
                        selectedDomain={domain}
                        onSelectDomain={setDomain}
                    />
                </View>
            )}

            {/* Rich Text Editor */}
            <View style={styles.editorContainer}>
                <NativeLiveEditor
                    ref={editorRef}
                    initialContent={bodyText}
                    onChange={handleEditorChange}
                    selection={selection}
                    onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                    autoFocus={true}
                    style={{ flex: 1, paddingVertical: 12 }}
                    contentInset={{ bottom: isKeyboardVisible ? 70 : 0 }}
                    scrollIndicatorInsets={{ bottom: isKeyboardVisible ? 70 : 0 }}
                />
            </View>

            {/* Floating Toolbar - positioned above keyboard */}
            <View style={[
                styles.toolbarWrapper,
                {
                    bottom: isKeyboardVisible ? keyboardHeight : insets.bottom,
                }
            ]}>
                <MarkdownToolbar
                    inputRef={editorRef as any}
                    text={bodyText}
                    onTextChange={(newText: string) => {
                        setBodyText(newText);
                        handleEditorChange(newText);
                    }}
                    selection={selection}
                    onSelectionChangeRequest={setSelection}
                />
            </View>

            {/* Helper FAB for adding checklist items */}
            {hasChecklist && !isKeyboardVisible && (
                <TouchableOpacity
                    onPress={handleAddItem}
                    style={styles.fab}
                >
                    <Ionicons name="add" size={30} color="#FFFFFF" />
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    headerButton: {
        padding: 8,
    },
    statusContainer: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleContainer: {
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    domainContainer: {
        paddingHorizontal: 0,
        paddingTop: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    titleInput: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1A1A1A',
        ...RTL_TEXT_STYLE,
    },
    editorContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    toolbarWrapper: {
        position: 'absolute',
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        zIndex: 9999,
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    toolbarContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 12,
    },
    toolbarButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#F5F5F5',
        minWidth: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fab: {
        position: 'absolute',
        bottom: 110, // Just above the toolbar area
        left: 24, // Left side as requested by user
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#6200EE',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 3,
        },
        shadowOpacity: 0.27,
        shadowRadius: 4.65,
        zIndex: 30000,
    },
    toast: {
        position: 'absolute',
        top: '50%',
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
        zIndex: 20000,
    },
    toastText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
