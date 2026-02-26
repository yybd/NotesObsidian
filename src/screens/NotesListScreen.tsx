import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    Text,
    Platform,
    Keyboard,
    RefreshControl,
    AppState,
    useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotesStore } from '../stores/notesStore';
import { NoteCard } from '../components/NoteCard';
import { updateFrontmatter } from '../services/FrontmatterService';
import { MarkdownToolbar } from '../components/MarkdownToolbar';
import { RichTextToolbar } from '../components/RichTextToolbar';
import { handleListContinuation, appendChecklistItem } from '../utils/markdownUtils';
import { SmartEditorRef } from '../components/SmartEditor';
import { RTL_TEXT_STYLE } from '../utils/rtlUtils';
import { Header } from '../components/Header';
import { QuickAddInput, QuickAddInputRef } from '../components/QuickAddInput';
import { EmptyNotesList } from '../components/EmptyNotesList';
import { Note, DomainType } from '../types/Note';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

export const NotesListScreen = ({ navigation }: any) => {
    const {
        filteredNotes,
        isLoading,
        error,
        loadNotes,
        searchNotes,
        archiveNote,
        createNote,
        updateNote,
        togglePinNote,
        refreshSort,
        currentDomain,
        filterByDomain,
        settings,
    } = useNotesStore();
    const editorMode = settings.editorMode || 'richtext';

    const [quickNoteText, setQuickNoteText] = useState('');
    const [quickNotePinned, setQuickNotePinned] = useState(false);
    const [quickNoteDomain, setQuickNoteDomain] = useState<DomainType | null>(null);
    const [isSending, setIsSending] = useState(false);
    const { keyboardVisible, keyboardHeight } = useKeyboardHeight();
    const [refreshing, setRefreshing] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isQuickNoteActive, setIsQuickNoteActive] = useState(false);
    const appState = useRef(AppState.currentState);
    const [isEditingNote, setIsEditingNote] = useState(false);
    const pendingQuickAddRef = useRef(false);
    const quickAddInputRef = useRef<QuickAddInputRef>(null);
    const flatListRef = useRef<FlatList>(null);
    const insets = useSafeAreaInsets();
    const { height: screenHeight } = useWindowDimensions();
    const [headerBottomY, setHeaderBottomY] = useState(0);


    // Toolbar height constant
    const TOOLBAR_HEIGHT = 48;
    // Header (~100px) + SearchBar (~76px) + safety margin
    const HEADER_AREA_HEIGHT = 180;
    // Calculate available height for the editing card
    // The card sits in the bottom section (above toolbar, above keyboard)
    // Available space = from bottom of search/domain bar down to toolbar
    const topBoundary = headerBottomY > 0 ? headerBottomY : HEADER_AREA_HEIGHT;
    
    const maxInputHeight = keyboardVisible
        ? screenHeight - keyboardHeight - TOOLBAR_HEIGHT - topBoundary - 10 // Account for domain selector and padding
        : 250;

    const editCardMaxHeight = keyboardVisible
        ? screenHeight - keyboardHeight - TOOLBAR_HEIGHT - topBoundary
        : screenHeight - topBoundary - 100;

    // Inline edit state for NoteCard toolbar
    const [inlineEditInstance, setInlineEditInstance] = useState<SmartEditorRef | null>(null);
    // Direct RichEditor ref — extracted once when editing starts
    const [inlineRichEditorRef, setInlineRichEditorRef] = useState<{ current: any } | null>(null);
    const [inlineEditContent, setInlineEditContent] = useState('');
    const [inlineEditSelection, setInlineEditSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
    const [inlineEditPinned, setInlineEditPinned] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [showToast, setShowToast] = useState(false);

    useEffect(() => {
        loadNotes();
    }, []);

    // Handle AppState changes (Auto-refresh on foreground)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (
                appState.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
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
                // When keyboard starts to hide, the quick note is no longer active
                setIsQuickNoteActive(false);

                // If sending, do nothing (let send handler finish)
                if (isSending) return;

                // If editing existing note, do nothing
                if (isEditingNote) return;

                // We no longer delete draft files on hide. The quick add content stays in 
                // in-memory state until they either send it or explicitly clear it.

                // Clear text and pinned/domain state
                if (quickNoteText) {
                    quickAddInputRef.current?.clear();
                    setQuickNoteText('');
                    setQuickNotePinned(false);
                    setQuickNoteDomain(null);

                }

            }
        );

        return () => {
            hideListener.remove();
        };
    }, [isSending, isEditingNote, quickNoteText]);



    // Handle text change with list/checkbox continuation
    const handleTextChangeWithListContinuation = useCallback((
        newText: string,
        oldText: string,
        setText: (text: string) => void,
    ) => {
        const result = handleListContinuation(newText, oldText);

        if (result) {
            if (result.cursorShouldMove) {
                const newSelection = { start: result.newCursorPos, end: result.newCursorPos };
                if (setText === setQuickNoteText) {
                    quickAddInputRef.current?.setTextAndSelection(result.modifiedText, newSelection);
                }
            }
            setText(result.modifiedText);
        } else {
            setText(newText);
        }
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
        quickAddInputRef.current?.blur();

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

            // Create new note
            const filename = generateFilename();
            await createNote(filename, formattedText);

            // Clear and reset
            quickAddInputRef.current?.clear();
            setQuickNoteText('');
            setQuickNotePinned(false);
            setQuickNoteDomain(null);

            await loadNotes();
        } catch (error) {
            console.error('Error creating quick note:', error);
        } finally {
            setIsSending(false);
        }
    };

    const renderRightActions = (_progress: any, _dragX: any, item: Note) => {
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
                        onEditRequest={() => {
                            setIsEditingNote(true);
                            setEditingNoteId(item.id);
                        }}
                        onQuickAddRequest={() => {
                            pendingQuickAddRef.current = true;
                            setIsEditingNote(true);
                            setEditingNoteId(item.id);
                        }}
                    />
                </Swipeable>
            </View>
        );
    }, [handleUpdateNote, isEditingNote, editingNoteId]);

    // Render method removed, using component directly inline

    return (
        <View style={styles.container}>
            {/* Header / Search & Domain */}
            <Header
                title="הפתקים שלי"
                onSettingsPress={handleSettings}
                onSearch={searchNotes}
                onSearchFocus={() => setIsSearchFocused(true)}
                onSearchBlur={() => setIsSearchFocused(false)}
                isSearchFocused={isSearchFocused}
                currentDomain={currentDomain}
                onFilterByDomain={filterByDomain}
                hideSearchAndDomain={isEditingNote || isQuickNoteActive}
                onLayout={(y, height) => setHeaderBottomY(y + height)}
            />

            {/* Notes List */}
            <FlatList
                ref={flatListRef}
                style={{ flex: 1 }}
                data={filteredNotes}
                renderItem={renderNote}
                keyExtractor={(item) => item.id}
                extraData={{ isEditingNote, editingNoteId }}
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: keyboardVisible ? keyboardHeight + 160 : 120 }
                ]}
                ListEmptyComponent={<EmptyNotesList isLoading={isLoading} />}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
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
            {!isSearchFocused && (
                <View
                    pointerEvents="box-none"
                    style={[
                        styles.bottomSection, 
                        keyboardVisible && !isEditingNote
                            ? { top: topBoundary, bottom: keyboardHeight }
                            : { bottom: keyboardVisible ? keyboardHeight : 0 }
                    ]}
                >
                    {/* Quick Note Input - Hide when editing existing note or searching */}
                    {!isEditingNote && (
                        <QuickAddInput
                            ref={quickAddInputRef}
                            text={quickNoteText}
                            isPinned={quickNotePinned}
                            domain={quickNoteDomain}
                            isSending={isSending}
                            keyboardVisible={keyboardVisible}
                            maxInputHeight={maxInputHeight}
                            bottomPadding={keyboardVisible ? 12 : insets.bottom > 0 ? insets.bottom : 16}
                            onTextChange={(text) => handleTextChangeWithListContinuation(text, quickNoteText, setQuickNoteText)}
                            onPinChange={(newPinned) => {
                                setQuickNotePinned(newPinned);
                            }}
                            onDomainChange={setQuickNoteDomain}
                            onSend={handleSendNote}
                            onFocus={() => setIsQuickNoteActive(true)}
                        />
                    )}

                    {/* Toolbar for floating NoteCard editing */}
                    {keyboardVisible && isEditingNote && inlineEditInstance && (
                        editorMode === 'markdown' ? (
                            <MarkdownToolbar
                                inputRef={{ current: inlineEditInstance } as any}
                                text={inlineEditContent}
                                onTextChange={setInlineEditContent}
                                selection={inlineEditSelection}
                                onSelectionChangeRequest={setInlineEditSelection}
                                onPinPress={editingNoteId ? () => {
                                    setInlineEditPinned(!inlineEditPinned);
                                    togglePinNote(editingNoteId, inlineEditContent, true);
                                } : undefined}
                                isPinned={inlineEditPinned}
                            />
                        ) : (
                            <RichTextToolbar
                                richEditorRef={inlineRichEditorRef as any}
                                onPinPress={editingNoteId ? () => {
                                    setInlineEditPinned(!inlineEditPinned);
                                    togglePinNote(editingNoteId, inlineEditContent, true);
                                } : undefined}
                                isPinned={inlineEditPinned}
                            />
                        )
                    )}
                </View>
            )}

            {/* Floating Editor Overlay */}
            {isEditingNote && editingNoteId && (() => {
                const editingNote = filteredNotes.find(n => n.id === editingNoteId);
                if (!editingNote) return null;
                return (
                    <View style={[StyleSheet.absoluteFill, { zIndex: 50, paddingTop: insets.top, paddingBottom: (keyboardVisible ? keyboardHeight + TOOLBAR_HEIGHT : insets.bottom) + 10, backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => Keyboard.dismiss()} activeOpacity={1} />
                        <View style={{ flex: 1, marginHorizontal: 16 }}>
                            <NoteCard
                                note={editingNote}
                                autoEdit={true}
                                style={{ flex: 1, marginBottom: 0 }}
                                onUpdate={(content) => handleUpdateNote(editingNote, content)}
                                onEditStart={(ref, content, sel) => {
                                    setInlineEditPinned(!!editingNote.pinned);
                                    if (ref && ref !== inlineEditInstance) {
                                        setInlineEditInstance(ref as any);
                                        if (editorMode === 'richtext') {
                                            const rRef = (ref as SmartEditorRef).getRichEditorRef?.() ?? null;
                                            setInlineRichEditorRef(rRef);
                                        }
                                    }
                                    setInlineEditContent(content);
                                    setInlineEditSelection(sel);

                                    // If opened via quick-add button, append a checklist item
                                    if (pendingQuickAddRef.current && ref) {
                                        pendingQuickAddRef.current = false;
                                        setTimeout(() => {
                                            const newBody = appendChecklistItem(content);
                                            if (newBody !== content) {
                                                const newSel = { start: newBody.length, end: newBody.length };
                                                ref.setTextAndSelection?.(newBody, newSel);
                                                setInlineEditContent(newBody);
                                                setInlineEditSelection(newSel);
                                            }
                                        }, 300);
                                    }
                                }}
                                onEditEnd={() => {
                                    setIsEditingNote(false);
                                    setEditingNoteId(null);
                                    setInlineEditInstance(null);
                                    setInlineRichEditorRef(null);
                                    refreshSort();
                                }}
                                onEditContentChange={(content) => setInlineEditContent(content)}
                                onEditSelectionChange={(sel) => setInlineEditSelection(sel)}
                                externalEditContent={inlineEditContent}
                                externalIsPinned={inlineEditPinned}
                            />
                        </View>
                    </View>
                );
            })()}

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
        zIndex: 10,
    },
    listContent: {
        padding: 20,
        paddingBottom: 120, // Extra space for quick note input
    },
    keyboardDismissButton: {
        width: 36,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
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
