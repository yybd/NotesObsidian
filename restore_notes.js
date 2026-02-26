const fs = require('fs');

const fileContent = `// NotesListScreen.tsx - Main screen displaying notes and inline editor
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Keyboard,
    Platform,
    RefreshControl,
    TextInput,
    useWindowDimensions,
    AppState
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';

import { useNotesStore } from '../stores/notesStore';
import { Note, DOMAINS, DomainType } from '../types/Note';
import { NoteCard } from '../components/NoteCard';
import { Header } from '../components/Header';
import { EmptyNotesList } from '../components/EmptyNotesList';
import { MarkdownToolbar } from '../components/MarkdownToolbar';
import { RichTextToolbar } from '../components/RichTextToolbar';
import { NativeLiveEditorRef } from '../components/NativeLiveEditor';
import { QuickAddInput, QuickAddInputRef } from '../components/QuickAddInput';
import { updateFrontmatter } from '../services/FrontmatterService';
import { RTL_TEXT_STYLE } from '../utils/rtlUtils';
import { handleListContinuation } from '../utils/markdownUtils';

import { useSettingsStore } from '../stores/settingsStore';

export const NotesListScreen = ({ navigation }: any) => {
    const {
        notes,
        isLoading,
        error,
        loadNotes,
        createNote,
        deleteNote,
        updateNote,
        togglePinNote,
        archiveNote
    } = useNotesStore();

    const settings = useSettingsStore();

    // UI state
    const [refreshing, setRefreshing] = useState(false);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    // Filter/Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [activeDomainFilter, setActiveDomainFilter] = useState<DomainType | null>(null);

    // Quick add state
    const quickAddInputRef = useRef<QuickAddInputRef>(null);
    const [quickNoteText, setQuickNoteText] = useState('');
    const [quickNotePinned, setQuickNotePinned] = useState(false);
    const [quickNoteDomain, setQuickNoteDomain] = useState<DomainType | null>(null);
    const [isQuickNoteActive, setIsQuickNoteActive] = useState(false);
    const [isSending, setIsSending] = useState(false);

    // Refs and layout context
    const flatListRef = useRef<FlatList>(null);
    const appState = useRef(AppState.currentState);
    const searchBarRef = useRef<TextInput>(null);
    const insets = useSafeAreaInsets();
    const { height: screenHeight } = useWindowDimensions();
    const [headerBottomY, setHeaderBottomY] = useState(0);

    // Track if search bar is focused relative to toolbars
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    // Toolbar height constant
    const TOOLBAR_HEIGHT = 48;
    // Header (~100px) + SearchBar (~76px) + safety margin
    const HEADER_AREA_HEIGHT = 180;
    const keyboardVisible = isKeyboardVisible;
    
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
    const [inlineEditPinned, setInlineEditPinned] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [showToast, setShowToast] = useState(false);
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [isEditingNote, setIsEditingNote] = useState(false);

    // Draft note tracking for auto-save
    const draftNoteRef = useRef<Note | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        loadNotes();

        // Keyboard listeners for dynamic padding
        // Track last height to avoid re-rendering from minor iOS keyboard height fluctuations
        let lastKeyboardHeight = 0;
        
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        
        const showListener = Keyboard.addListener(showEvent, (e) => {
            const h = e.endCoordinates.height;
            // Only update if height changed significantly
            if (Math.abs(h - lastKeyboardHeight) > 10) {
                setKeyboardHeight(h);
                lastKeyboardHeight = h;
            }
            setKeyboardVisible(true);
        });
        
        const hideListener = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
            lastKeyboardHeight = 0;
            setKeyboardVisible(false);
            
            // Handle quick note blur/discard
            setIsQuickNoteActive(false);
            if (isSending || isEditingNote) return;
            
            if (quickNoteText) {
                quickAddInputRef.current?.clear();
                setQuickNoteText('');
                setQuickNotePinned(false);
                setQuickNoteDomain(null);
            }
        });

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

    const generateFilename = (): string => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return \`\${year}-\${month}-\${day}_\${hours}-\${minutes}-\${seconds}\`;
    };

    const handleSendNote = async () => {
        const text = quickNoteText.trim();
        if (!text || isSending) return;

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
            const lines = text.split(\'\\n\');
            const firstLine = lines[0];
            if (!firstLine.startsWith(\'#\')) {
                lines[0] = \'# \' + firstLine;
            }
            let formattedText = lines.join(\'\\n\');

            if (quickNotePinned) {
                formattedText = updateFrontmatter(formattedText, \'pinned\', true);
            }

            if (quickNoteDomain) {
                formattedText = updateFrontmatter(formattedText, \'domain\', quickNoteDomain);
            }

            if (draftNoteRef.current) {
                await updateNote(draftNoteRef.current.id, draftNoteRef.current.filePath, formattedText);
            } else {
                const filename = generateFilename();
                await createNote(filename, formattedText);
            }

            setQuickNoteText(\'\');
            setQuickNotePinned(false);
            setQuickNoteDomain(null);
            draftNoteRef.current = null;
            await loadNotes();
        } catch (error) {
            console.error(\'Error creating quick note:\', error);
        } finally {
            setIsSending(false);
        }
    };

    const searchNotes = (query: string) => {
        setSearchQuery(query);
    };

    const filterByDomain = (domain: DomainType | null) => {
        setActiveDomainFilter(domain);
    };

    // Derived states
    const filteredNotes = notes.filter(note => {
        const matchesSearch = !searchQuery || 
            note.content.toLowerCase().includes(searchQuery.toLowerCase());
            
        const matchesDomain = !activeDomainFilter || 
            note.domain === activeDomainFilter;
            
        return matchesSearch && matchesDomain;
    });

    const displayNotes = activeDomainFilter 
        ? filteredNotes.sort((a, b) => {
            // Priority 1: Checkbox groups
            if (a.domainCheckboxGroup && b.domainCheckboxGroup) {
                return a.domainCheckboxGroup.localeCompare(b.domainCheckboxGroup);
            }
            if (a.domainCheckboxGroup) return -1;
            if (b.domainCheckboxGroup) return 1;

            // Priority 2: Pinned
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;

            // Priority 3: Creation date
            return b.createdAt.getTime() - a.createdAt.getTime();
        })
        : filteredNotes;

    const refreshSort = () => {
        setSearchQuery(searchQuery + " ");
        setTimeout(() => setSearchQuery(searchQuery), 0);
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
        // Find if this is the active editing note
        const isThisNoteEditing = isEditingNote && editingNoteId === item.id;

        const cardContent = (
            <NoteCard
                note={item}
                style={{ marginBottom: 0 }}
                // If it\'s editing in the overlay, force it collapsed in the flatlist
                forceExitEdit={isThisNoteEditing || (isEditingNote && editingNoteId !== item.id)}
                onUpdate={(content) => handleUpdateNote(item, content)}
                onEditStart={(ref, content, sel) => {
                    if (isThisNoteEditing) return;
                    setIsEditingNote(true);
                    setEditingNoteIndex(index);
                    setEditingNoteId(item.id);
                    setEditingNote(item);
                    setInlineEditPinned(!!item.pinned);
                    // @ts-ignore
                    setInlineEditInputRef(ref as any);
                    setInlineEditContent(content);
                    setInlineEditSelection(sel);
                }}
            />
        );

        return (
            <View style={{ marginBottom: 12 }}>
                {isThisNoteEditing ? (
                    <View style={{ opacity: 0 }} pointerEvents="none">
                        {cardContent}
                    </View>
                ) : (
                    <Swipeable
                        renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item)}
                    >
                        {cardContent}
                    </Swipeable>
                )}
            </View>
        );
    }, [handleUpdateNote, inlineEditContent, isEditingNote, editingNoteId, editCardMaxHeight]);

    return (
        <View style={styles.container}>
            <Header
                title="הפתקים שלי"
                onSettingsPress={handleSettings}
                onSearch={searchNotes}
                searchQuery={searchQuery}
                onFilterByDomain={filterByDomain}
                hideSearchAndDomain={isEditingNote || isQuickNoteActive}
                onLayout={(y, height) => setHeaderBottomY(y + height)}
            />

            <FlatList
                ref={flatListRef}
                style={{ flex: 1 }}
                data={displayNotes}
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
                        colors={[\'#6200EE\']}
                        tintColor="#6200EE"
                    />
                }
                onScrollToIndexFailed={(info) => {
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
                    style={[styles.bottomSection, { bottom: keyboardVisible ? keyboardHeight : 0 }]}
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

                    {/* Toolbar for inline NoteCard editing */}
                    {keyboardVisible && isEditingNote && inlineEditInputRef && (
                        <View style={styles.floatingToolbar}>
                            <View style={styles.toolbarRow}>
                                {settings.editorMode === \'richtext\' ? (
                                    <RichTextToolbar
                                        editorRef={(inlineEditInputRef?.current as any)?.getEditorRef?.() || null}
                                        onPinPress={editingNoteId ? () => {
                                            setInlineEditPinned(!inlineEditPinned);
                                            togglePinNote(editingNoteId, inlineEditContent, true);
                                        } : undefined}
                                        isPinned={inlineEditPinned}
                                    />
                                ) : (
                                    <MarkdownToolbar
                                        inputRef={inlineEditInputRef as any}
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
                                )}
                            </View>
                        </View>
                    )}
                </View>
            )}

            {/* Absolute Overlay for Active Edit Note */}
            {isEditingNote && editingNote && (
                <View 
                    style={[
                        StyleSheet.absoluteFill, 
                        { 
                            top: topBoundary,
                            bottom: keyboardVisible ? keyboardHeight + TOOLBAR_HEIGHT : 0,
                            paddingHorizontal: 16,
                            paddingTop: 8,
                            zIndex: 100,
                        }
                    ]} 
                    pointerEvents="box-none"
                >
                    <NoteCard
                        note={editingNote}
                        style={{ 
                            flex: 1, 
                            marginBottom: 0,
                            shadowColor: \'#000\',
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.3,
                            shadowRadius: 16,
                            elevation: 8,
                            borderWidth: 2,
                            borderColor: \'#6200EE\'
                        }}
                        autoEdit={true}
                        onUpdate={(content) => handleUpdateNote(editingNote, content)}
                        onEditStart={(ref, content, sel) => {
                            // Link the overlay\'s true ref to the toolbar
                            setInlineEditInputRef(ref as any);
                            setInlineEditContent(content);
                            setInlineEditSelection(sel);
                        }}
                        onEditEnd={() => {
                            setIsEditingNote(false);
                            setEditingNoteIndex(null);
                            setEditingNoteId(null);
                            setEditingNote(null);
                            setInlineEditInputRef(null);
                            refreshSort();
                        }}
                        onEditContentChange={(content) => setInlineEditContent(content)}
                        onEditSelectionChange={(sel) => setInlineEditSelection(sel)}
                        externalEditContent={inlineEditContent}
                        externalIsPinned={inlineEditPinned}
                    />
                </View>
            )}

            {
                error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )
            }
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
        backgroundColor: \'#F9F9F9\',
    },
    bottomSection: {
        position: \'absolute\',
        left: 0,
        right: 0,
        zIndex: 100,
    },
    listContent: {
        padding: 20,
        paddingBottom: 120, // Extra space for quick note input
    },
    errorContainer: {
        position: \'absolute\',
        bottom: 120,
        left: 20,
        right: 20,
        backgroundColor: \'#FFEbee\',
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: \'#F44336\',
        zIndex: 1000,
    },
    errorText: {
        color: \'#D32F2F\',
        fontSize: 14,
        ...RTL_TEXT_STYLE,
    },
    toast: {
        position: \'absolute\',
        bottom: Platform.OS === \'ios\' ? 120 : 100,
        left: 20,
        right: 20,
        backgroundColor: \'#323232\',
        padding: 12,
        borderRadius: 8,
        alignItems: \'center\',
        justifyContent: \'center\',
        zIndex: 1000,
        elevation: 5,
        shadowColor: \'#000\',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    toastText: {
        color: \'#FFFFFF\',
        fontSize: 14,
        fontWeight: \'600\',
        ...RTL_TEXT_STYLE,
    },
    floatingToolbar: {
        backgroundColor: \'#FFFFFF\',
        borderTopWidth: 1,
        borderTopColor: \'#E0E0E0\',
        shadowColor: \'#000\',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    toolbarRow: {
        flexDirection: \'row\',
        alignItems: \'center\',
        justifyContent: \'flex-end\',
        paddingHorizontal: 8,
    },
    archiveAction: {
        backgroundColor: \'#F44336\',
        justifyContent: \'center\',
        alignItems: \'center\',
        width: 80,
        marginVertical: 4,
        borderRadius: 12,
        marginRight: 12,
    },
    archiveText: {
        color: \'#FFF\',
        fontSize: 12,
        fontWeight: \'bold\',
        marginTop: 4,
    }
});
`
fs.writeFileSync('/Users/yechiel/Developer/react-dev/NotesObsidian/src/screens/NotesListScreen.tsx', fileContent);
