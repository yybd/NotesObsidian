import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    Text,
    TextInput,
    ActivityIndicator,
    Platform,
    Keyboard,
    RefreshControl,
    ScrollView,
    AppState,
    AppStateStatus,
    useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotesStore } from '../stores/notesStore';
import { NoteCard } from '../components/NoteCard';
import FrontmatterService, { updateFrontmatter, removeFrontmatterKey } from '../services/FrontmatterService';
import { SearchBar } from '../components/SearchBar';
import { MarkdownToolbar } from '../components/MarkdownToolbar';
import { DomainSelector } from '../components/DomainSelector';
import { NativeLiveEditor, NativeLiveEditorRef } from '../components/NativeLiveEditor';
import { getDirection, RTL_TEXT_STYLE } from '../utils/rtlUtils';
import { Note, DOMAINS, DomainType } from '../types/Note';

export const NotesListScreen = ({ navigation }: any) => {
    const {
        filteredNotes,
        isLoading,
        error,
        loadNotes,
        searchNotes,
        deleteNote,
        archiveNote,
        createNote,
        updateNote,
        togglePinNote,
        currentDomain,
        filterByDomain,
    } = useNotesStore();

    const [quickNoteText, setQuickNoteText] = useState('');
    const [quickNotePinned, setQuickNotePinned] = useState(false);
    const [quickNoteDomain, setQuickNoteDomain] = useState<DomainType | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [inputHeight, setInputHeight] = useState(40);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const appState = useRef(AppState.currentState);
    const [isEditingNote, setIsEditingNote] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
    const editorRef = useRef<NativeLiveEditorRef>(null);
    const flatListRef = useRef<FlatList>(null);
    const insets = useSafeAreaInsets();
    const { height: screenHeight } = useWindowDimensions();
    const [headerBottomY, setHeaderBottomY] = useState(0);


    // Toolbar height constant
    const TOOLBAR_HEIGHT = 48;
    // Header (~100px) + SearchBar (~76px) + safety margin
    const HEADER_AREA_HEIGHT = 180;
    const maxInputHeight = keyboardVisible
        ? screenHeight - keyboardHeight - TOOLBAR_HEIGHT - HEADER_AREA_HEIGHT
        : 250;

    // Calculate available height for the editing card
    // The card sits in the bottom section (above toolbar, above keyboard)
    // Available space = from bottom of search/domain bar down to toolbar
    const topBoundary = headerBottomY > 0 ? headerBottomY : HEADER_AREA_HEIGHT;
    const editCardMaxHeight = keyboardVisible
        ? screenHeight - keyboardHeight - TOOLBAR_HEIGHT - topBoundary
        : screenHeight - topBoundary - 100;

    // Inline edit state for NoteCard toolbar
    const [inlineEditInputRef, setInlineEditInputRef] = useState<React.RefObject<NativeLiveEditorRef | null> | null>(null);
    const [inlineEditContent, setInlineEditContent] = useState('');
    const [inlineEditSelection, setInlineEditSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [showToast, setShowToast] = useState(false);

    // Draft note tracking for auto-save
    const draftNoteRef = useRef<Note | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        loadNotes();

        // Keyboard listeners for dynamic padding
        // Track last height to avoid re-rendering from minor iOS keyboard height fluctuations
        let lastKeyboardHeight = 0;

        const showListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => {
                const newHeight = e.endCoordinates.height;
                setKeyboardVisible(true);

                // Only update height state if it changed significantly (>10px)
                // iOS fires keyboardWillShow for tiny QuickType bar adjustments, causing jitter
                if (Math.abs(newHeight - lastKeyboardHeight) > 10) {
                    lastKeyboardHeight = newHeight;
                    setKeyboardHeight(newHeight);
                }
            }
        );
        const hideListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                lastKeyboardHeight = 0;
                setKeyboardVisible(false);
                setKeyboardHeight(0);
            }
        );

        return () => {
            showListener.remove();
            hideListener.remove();
        };
    }, []);

    // Handle AppState changes (Auto-refresh on foreground)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (
                appState.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                console.log('App has come to the foreground! Refreshing notes...');
                loadNotes();
            }

            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, [loadNotes]);

    // Handle keyboard dismiss (discard draft if not sending)
    useEffect(() => {
        const hideListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            async () => {
                // If sending, do nothing (let send handler finish)
                if (isSending) return;

                // If editing existing note, do nothing
                if (isEditingNote) return;

                // If we have a draft note, delete it
                if (draftNoteRef.current) {
                    await deleteNote(draftNoteRef.current.filePath);
                    draftNoteRef.current = null;
                }

                // Clear text and pinned/domain state
                if (quickNoteText) {
                    setQuickNoteText('');
                    setQuickNotePinned(false);
                    setQuickNoteDomain(null);
                    setInputHeight(40);

                }

            }
        );

        return () => {
            hideListener.remove();
        };
    }, [isSending, isEditingNote, quickNoteText, deleteNote]);

    // Auto-save quick note while typing
    useEffect(() => {
        const text = quickNoteText.trim();

        // Clear previous timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Don't save empty text
        if (!text) {
            return;
        }

        // Debounce save by 1 second
        saveTimeoutRef.current = setTimeout(async () => {
            try {
                // Format text with # on first line
                const lines = text.split('\n');
                const firstLine = lines[0];
                if (!firstLine.startsWith('#')) {
                    lines[0] = '# ' + firstLine;
                }
                const formattedText = lines.join('\n');

                if (draftNoteRef.current) {
                    // Update existing draft
                    await updateNote(draftNoteRef.current.id, draftNoteRef.current.filePath, formattedText);
                } else {
                    // Create new draft
                    const filename = generateFilename();
                    const newNote = await createNote(filename, formattedText);
                    draftNoteRef.current = newNote;
                    // Don't call loadNotes here - createNote already adds to store
                }
            } catch (error) {
                console.error('Error auto-saving quick note:', error);
            }
        }, 1000);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [quickNoteText]);

    // Handle text change with list/checkbox continuation
    const handleTextChangeWithListContinuation = useCallback((
        newText: string,
        oldText: string,
        setText: (text: string) => void,
    ) => {
        // Check if user just pressed Enter (newline was added)
        if (newText.length > oldText.length && newText.includes('\n')) {
            const addedChar = newText.substring(oldText.length);

            // Only process if a newline was just added
            if (addedChar === '\n' || addedChar.includes('\n')) {
                // Find the line before the cursor (where Enter was pressed)
                const cursorPos = newText.lastIndexOf('\n', newText.length - 1);
                const lineStart = newText.lastIndexOf('\n', cursorPos - 1) + 1;
                const previousLine = newText.substring(lineStart, cursorPos);

                // Check for checkbox pattern: "- [ ] " or "- [x] "
                const checkboxMatch = previousLine.match(/^(\s*- \[[ xX]\] )/);
                if (checkboxMatch) {
                    // If the line only has the checkbox (empty content), remove it and don't continue
                    const lineContent = previousLine.substring(checkboxMatch[0].length).trim();
                    if (!lineContent) {
                        // Remove the empty checkbox line and the newline
                        const cleanedText = newText.substring(0, lineStart) + newText.substring(cursorPos + 1);
                        setText(cleanedText);
                        return;
                    }
                    // Add unchecked checkbox to new line
                    const prefix = '- [ ] ';
                    const modifiedText = newText.substring(0, cursorPos + 1) + prefix + newText.substring(cursorPos + 1);

                    // Atomically set text and cursor position to prevent iOS jumping
                    const newPos = cursorPos + 1 + prefix.length;
                    editorRef.current?.setTextAndSelection?.(modifiedText, { start: newPos, end: newPos });

                    setText(modifiedText);
                    return;
                }

                // Check for list pattern: "- "
                const listMatch = previousLine.match(/^(\s*- )/);
                if (listMatch) {
                    // If the line only has the list marker (empty content), remove it and don't continue
                    const lineContent = previousLine.substring(listMatch[0].length).trim();
                    if (!lineContent) {
                        // Remove the empty list line and the newline
                        const cleanedText = newText.substring(0, lineStart) + newText.substring(cursorPos + 1);
                        setText(cleanedText);
                        return;
                    }
                    // Add list marker to new line
                    const prefix = '- ';
                    const modifiedText = newText.substring(0, cursorPos + 1) + prefix + newText.substring(cursorPos + 1);

                    // Atomically set text and cursor position to prevent iOS jumping
                    const newPos = cursorPos + 1 + prefix.length;
                    editorRef.current?.setTextAndSelection?.(modifiedText, { start: newPos, end: newPos });

                    setText(modifiedText);
                    return;
                }
            }
        }

        // No list continuation needed
        setText(newText);
    }, []);

    // Handle inline note update
    const handleUpdateNote = useCallback(async (note: Note, newContent: string) => {
        try {
            await updateNote(note.id, note.filePath, newContent);
        } catch (error) {
            console.error('Error updating note:', error);
        }
    }, [updateNote]);

    const handleArchive = async (note: Note) => {
        await archiveNote(note.filePath);
    };

    const handleSettings = () => {
        navigation.navigate('Settings');
    };

    // Generate filename from current date with seconds
    const generateFilename = (): string => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    };

    // Send quick note (finalize the draft or create if not auto-saved yet)
    const handleSendNote = async () => {
        const text = quickNoteText.trim();
        if (!text || isSending) return;

        // Validation: Must have a domain selected
        if (!quickNoteDomain) {
            setShowToast(true);
            setTimeout(() => {
                setShowToast(false);
            }, 1000);
            return;
        }

        setIsSending(true);
        Keyboard.dismiss();

        try {
            // Format text with # on first line
            const lines = text.split('\n');
            const firstLine = lines[0];
            if (!firstLine.startsWith('#')) {
                lines[0] = '# ' + firstLine;
            }
            let formattedText = lines.join('\n');

            // Add pinned frontmatter if pinned
            if (quickNotePinned) {
                formattedText = updateFrontmatter(formattedText, 'pinned', true);
            }

            // Add domain frontmatter if selected
            if (quickNoteDomain) {
                formattedText = updateFrontmatter(formattedText, 'domain', quickNoteDomain);
            }

            if (draftNoteRef.current) {
                // Update the existing draft one more time to ensure latest content is saved
                await updateNote(draftNoteRef.current.id, draftNoteRef.current.filePath, formattedText);
            } else {
                // Create new note if auto-save hasn't created one yet
                const filename = generateFilename();
                await createNote(filename, formattedText);
            }

            // Clear and reset
            setQuickNoteText('');
            setQuickNotePinned(false); // Reset pinned state
            setQuickNoteDomain(null); // Reset domain state
            setInputHeight(40);

            draftNoteRef.current = null; // Reset for next note
            await loadNotes();
        } catch (error) {
            console.error('Error creating quick note:', error);
        } finally {
            setIsSending(false);
        }
    };

    // Handle text input content size change
    const handleContentSizeChange = (event: any) => {
        const height = event.nativeEvent.contentSize.height;
        // Min 40, Max 120 (about 4 lines)
        setInputHeight(Math.min(Math.max(40, height), 120));
    };

    const renderRightActions = (progress: any, dragX: any, item: Note) => {
        return (
            <TouchableOpacity
                style={styles.archiveAction}
                onPress={() => handleArchive(item)}
            >
                <Ionicons name="archive-outline" size={24} color="#FFF" />
                <Text style={styles.archiveText}>לארכיון</Text>
            </TouchableOpacity>
        );
    };

    const renderNote = useCallback(({ item, index }: { item: Note; index: number }) => {
        return (
            <View style={{ marginBottom: 12 }}>
                <Swipeable
                    renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item)}
                >
                    <NoteCard
                        note={item}
                        style={{ marginBottom: 0 }}
                        onUpdate={(content) => handleUpdateNote(item, content)}
                        maxEditHeight={isEditingNote && editingNoteId === item.id ? editCardMaxHeight - 100 : undefined}
                        forceExitEdit={isEditingNote && editingNoteId !== item.id}
                        onEditStart={(ref, content, sel) => {
                            setIsEditingNote(true);
                            setEditingNoteIndex(index);
                            setEditingNoteId(item.id);
                            setEditingNote(item);
                            // @ts-ignore Since NativeLiveEditorRef isn't exactly TextInput, but for toolbar we might adapt it or pass it.
                            setInlineEditInputRef(ref as any);
                            setInlineEditContent(content);
                            setInlineEditSelection(sel);
                            // Scroll to top so editing card is visible
                            setTimeout(() => {
                                flatListRef.current?.scrollToIndex({
                                    index,
                                    animated: true,
                                    viewPosition: 0,
                                });
                            }, 300);
                        }}
                        onEditEnd={() => {
                            setIsEditingNote(false);
                            setEditingNoteIndex(null);
                            setEditingNoteId(null);
                            setEditingNote(null);
                            setInlineEditInputRef(null);
                        }}
                        onEditContentChange={(content) => setInlineEditContent(content)}
                        onEditSelectionChange={(sel) => setInlineEditSelection(sel)}
                        externalEditContent={inlineEditContent}
                    />
                </Swipeable>
            </View>
        );
    }, [handleUpdateNote, inlineEditContent, isEditingNote, editingNoteId, editCardMaxHeight]);

    const renderEmpty = () => {
        if (isLoading) {
            return (
                <View style={styles.emptyContainer}>
                    <ActivityIndicator size="large" color="#6200EE" />
                </View>
            );
        }
        return (
            <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={64} color="#CCC" />
                <Text style={styles.emptyTitle}>אין פתקים עדיין</Text>
                <Text style={styles.emptyText}>
                    כתוב פתק למטה ולחץ על שלח
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleSettings} style={styles.iconButton}>
                    <Ionicons name="settings-outline" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>הפתקים שלי</Text>
                <View style={styles.iconPlaceholder} />
            </View>

            {/* Search Bar */}
            <View
                style={styles.searchContainer}
                onLayout={(e) => {
                    const { y, height } = e.nativeEvent.layout;
                    setHeaderBottomY(y + height);
                }}
            >
                <SearchBar onSearch={searchNotes} />
                <DomainSelector
                    selectedDomain={currentDomain}
                    onSelectDomain={filterByDomain}
                    mode="filter"
                />
            </View>

            {/* Notes List */}
            <FlatList
                ref={flatListRef}
                data={filteredNotes}
                renderItem={renderNote}
                keyExtractor={(item) => item.id}
                extraData={{ isEditingNote, editingNoteId }}
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: keyboardVisible ? keyboardHeight + 160 : 120 }
                ]}
                ListEmptyComponent={renderEmpty}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={async () => {
                            setRefreshing(true);
                            await loadNotes();
                            setRefreshing(false);
                        }}
                        colors={['#6200EE']}
                        tintColor="#6200EE"
                    />
                }
                onScrollToIndexFailed={(info) => {
                    // Fallback: scroll to approximate offset
                    setTimeout(() => {
                        flatListRef.current?.scrollToOffset({
                            offset: info.averageItemLength * info.index,
                            animated: true,
                        });
                    }, 100);
                }}
            />

            {/* Bottom Section - Absolutely positioned above keyboard */}
            <View
                style={[styles.bottomSection, { bottom: keyboardVisible ? keyboardHeight : 0 }]}
            >
                {/* Quick Note Input - Hide when editing existing note */}
                {!isEditingNote && (
                    <View style={[styles.quickNoteContainer, { paddingBottom: keyboardVisible ? 12 : insets.bottom > 0 ? insets.bottom : 16 }]}>
                        {keyboardVisible && (
                            <DomainSelector
                                selectedDomain={quickNoteDomain}
                                onSelectDomain={setQuickNoteDomain}
                                mode="select"
                            />
                        )}
                        <View style={styles.inputWrapper}>
                            <ScrollView
                                style={[styles.quickNoteInputContainer, { maxHeight: maxInputHeight }]}
                                keyboardShouldPersistTaps="always"
                                showsVerticalScrollIndicator={false}
                                bounces={false}
                            >
                                <NativeLiveEditor
                                    ref={editorRef}
                                    initialContent={quickNoteText}
                                    onChange={(text) => handleTextChangeWithListContinuation(text, quickNoteText, setQuickNoteText)}
                                    onSelectionChange={(e) => { selectionRef.current = e.nativeEvent.selection; }}
                                    style={{ minHeight: 28 }}
                                    placeholder="כתוב.."
                                    scrollEnabled={false}
                                />
                            </ScrollView>
                            <TouchableOpacity
                                style={[
                                    styles.sendButton,
                                    (!quickNoteText.trim() || isSending) && styles.sendButtonDisabled
                                ]}
                                onPress={handleSendNote}
                                disabled={!quickNoteText.trim() || isSending}
                            >
                                {isSending ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Ionicons name="send" size={20} color="#FFFFFF" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Markdown Toolbar for Quick Note */}
                {keyboardVisible && !isEditingNote && (
                    <View style={styles.floatingToolbar}>
                        <View style={styles.toolbarRow}>
                            <MarkdownToolbar
                                inputRef={editorRef as any}
                                text={quickNoteText}
                                onTextChange={setQuickNoteText}
                                selection={selectionRef.current}
                                onSelectionChangeRequest={(sel) => {
                                    editorRef.current?.setSelection?.(sel);
                                    selectionRef.current = sel;
                                }}
                                onPinPress={() => {
                                    const newPinned = !quickNotePinned;
                                    setQuickNotePinned(newPinned);

                                    if (draftNoteRef.current) {
                                        let currentContent = draftNoteRef.current.content;
                                        if (newPinned) {
                                            currentContent = updateFrontmatter(currentContent, 'pinned', true);
                                        } else {
                                            currentContent = removeFrontmatterKey(currentContent, 'pinned');
                                        }

                                        draftNoteRef.current = {
                                            ...draftNoteRef.current,
                                            content: currentContent,
                                            pinned: newPinned
                                        };

                                        updateNote(draftNoteRef.current.id, draftNoteRef.current.filePath, currentContent);
                                    }
                                }}
                                isPinned={quickNotePinned}
                            />
                        </View>
                    </View>
                )}

                {/* Toolbar for inline NoteCard editing */}
                {keyboardVisible && isEditingNote && inlineEditInputRef && (
                    <View style={styles.floatingToolbar}>
                        <View style={styles.toolbarRow}>
                            <MarkdownToolbar
                                inputRef={inlineEditInputRef as any}
                                text={inlineEditContent}
                                onTextChange={setInlineEditContent}
                                selection={inlineEditSelection}
                                onSelectionChangeRequest={setInlineEditSelection}
                                onPinPress={editingNoteId ? () => {
                                    const note = filteredNotes.find(n => n.id === editingNoteId);
                                    if (note) {
                                        const parsedOriginal = FrontmatterService.parseFrontmatter(note.content);
                                        const newPinned = !note.pinned;

                                        const newFrontmatter = { ...parsedOriginal.frontmatter };
                                        if (newPinned) {
                                            newFrontmatter['pinned'] = true;
                                        } else {
                                            delete newFrontmatter['pinned'];
                                        }

                                        // Compose the NEW full content correctly
                                        const newFullContent = FrontmatterService.composeContent(newFrontmatter, inlineEditContent);

                                        // Persist to store/file. 
                                        togglePinNote(editingNoteId, newFullContent);
                                    }
                                } : undefined}
                                isPinned={filteredNotes.find(n => n.id === editingNoteId)?.pinned}
                            />
                        </View>
                    </View>
                )}
            </View>

            {/* Error Message */}
            {
                error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )
            }

            {/* Validation Toast */}
            {
                showToast && (
                    <View style={styles.toast}>
                        <Text style={styles.toastText}>יש לבחור תחום לפני השמירה</Text>
                    </View>
                )
            }
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9F9F9',
    },
    bottomSection: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 100,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9F9F9',
    },
    header: {
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1A1A1A',
        ...RTL_TEXT_STYLE,
    },
    iconButton: {
        padding: 8,
    },
    iconPlaceholder: {
        width: 40,
    },
    searchContainer: {
        paddingHorizontal: 20,
        paddingTop: 16,
        backgroundColor: '#FFFFFF',
    },
    listContent: {
        padding: 20,
        paddingBottom: 120, // Extra space for quick note input
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#666',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
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
    keyboardDismissButton: {
        width: 36,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    // Telegram style input pill container
    quickNoteInputContainer: {
        flex: 1,
        backgroundColor: '#F0F2F5',
        borderRadius: 12, // Matched SearchBar radius
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginLeft: 10,
        borderWidth: 1,
        borderColor: '#E4E6EB',
        minHeight: 44,
    },
    quickNoteTextInput: {
        minHeight: 28,
        padding: 0,
        fontSize: 16,
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
    errorContainer: {
        position: 'absolute',
        bottom: 120,
        left: 20,
        right: 20,
        backgroundColor: '#F44336',
        padding: 12,
        borderRadius: 8,
    },
    errorText: {
        color: '#FFFFFF',
        textAlign: 'center',
    },
    archiveAction: {
        backgroundColor: '#FF9800',
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        height: '100%',
        borderRadius: 16,
    },
    archiveText: {
        color: '#FFFFFF',
        fontSize: 12,
        marginTop: 4,
        fontWeight: '500',
    },
    inlineToolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        marginTop: 8,
    },
    floatingToolbar: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    toolbarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
        paddingVertical: 2,
    },
    pinButton: {
        padding: 8,
        marginLeft: 4,
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
    },
    pinButtonActive: {
        backgroundColor: '#E8DEF8',
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
