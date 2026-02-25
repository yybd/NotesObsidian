// NoteCard.tsx - Expandable inline note card
// Tap to expand/view, Long press to edit, auto-save on blur

import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    LayoutAnimation,
    Platform,
    UIManager,
    Keyboard,
    ScrollView,
    StyleProp,
    ViewStyle,
    Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Note, DOMAINS, DomainType } from '../types/Note';
import FrontmatterService, { getContentWithoutFrontmatter, updateFrontmatter, removeFrontmatterKey } from '../services/FrontmatterService';
import { DomainSelector } from './DomainSelector';
import { UnifiedMarkdownDisplay } from './UnifiedMarkdownDisplay';
import { NativeLiveEditor, NativeLiveEditorRef } from './NativeLiveEditor';
import { getDirection, RTL_TEXT_STYLE } from '../utils/rtlUtils';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface NoteCardProps {
    note: Note;
    onPress?: () => void;
    onUpdate: (content: string) => void;
    onDismissKeyboard?: () => void;
    onSync?: () => void;
    onEditStart?: (inputRef: React.RefObject<TextInput | null>, content: string, selection: { start: number; end: number }) => void;
    onEditEnd?: () => void;
    onEditContentChange?: (content: string) => void;
    onEditSelectionChange?: (selection: { start: number; end: number }) => void;
    externalEditContent?: string; // Content controlled by parent (for toolbar updates)
    maxEditHeight?: number; // Dynamic max height for editor, calculated by parent
    autoEdit?: boolean; // Start in edit mode immediately
    forceExitEdit?: boolean; // Force exit edit mode (when another card starts editing)
    style?: StyleProp<ViewStyle>;
}

// Strip markdown syntax for clean preview
const stripMarkdown = (text: string): string => {
    return text
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/~~(.+?)~~/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^# /gm, '')
        .replace(/^## /gm, '')
        .replace(/^### /gm, '')
        .replace(/^> /gm, '')
        .replace(/^- \[x\] /gm, '✓ ')
        .replace(/^- \[ \] /gm, '○ ')
        .replace(/^- /gm, '• ')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
};

export const NoteCard: React.FC<NoteCardProps> = ({ note, onPress, onUpdate, onDismissKeyboard, onSync, onEditStart, onEditEnd, onEditContentChange, onEditSelectionChange, externalEditContent, maxEditHeight, autoEdit, forceExitEdit, style }) => {
    // Parse content upfront for autoEdit mode
    const initialParsed = autoEdit ? FrontmatterService.parseFrontmatter(note.content) : null;

    const [isExpanded, setIsExpanded] = useState(!!autoEdit);
    const [isEditing, setIsEditing] = useState(!!autoEdit);
    const [editBody, setEditBody] = useState(initialParsed?.body || '');
    const [editFrontmatter, setEditFrontmatter] = useState<Record<string, any>>(initialParsed?.frontmatter || {});
    const [editSelection, setEditSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
    const [showDomainSelector, setShowDomainSelector] = useState(false);
    const [isPinned, setIsPinned] = useState(!!note.pinned);

    // We replace TextInput ref with NativeLiveEditorRef
    const editorRef = useRef<NativeLiveEditorRef>(null);

    // Sync pinned state and keep editFrontmatter synced with external pin toggles
    useEffect(() => {
        setIsPinned(!!note.pinned);
        setEditFrontmatter(prev => ({ ...prev, pinned: note.pinned, domain: note.domain }));
    }, [note.pinned, note.domain]);

    // Sync external content changes from parent toolbar
    useEffect(() => {
        if (isEditing && externalEditContent !== undefined && externalEditContent !== editBody) {
            setEditBody(externalEditContent);
        }
    }, [externalEditContent]);

    // Get content without frontmatter for display
    const displayContent = getContentWithoutFrontmatter(note.content);

    // Extract title (first line) and body (rest)
    const lines = displayContent.split('\n');
    const firstLine = lines[0] || '';
    const restLines = lines.slice(1).join('\n');

    // Remove # from title for display
    const title = firstLine.replace(/^#+\s*/, '').trim();
    const hasTitle = firstLine.startsWith('#');

    // Body content (without first line if it's a title)
    const bodyContent = hasTitle ? restLines : displayContent;
    const cleanBody = stripMarkdown(bodyContent);
    const preview = cleanBody.substring(0, 120);
    const hasMore = cleanBody.length > 120;

    const syncStatusColor = {
        synced: '#4CAF50',
        pending: '#FF9800',
        error: '#F44336',
    }[note.syncStatus];

    // Format timestamp
    const formatTimestamp = (date: Date) => {
        return date.toLocaleDateString('he-IL', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Handle tap - expand/collapse view
    const handlePress = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (isEditing) {
            // Save and exit edit mode
            handleBlur();
        } else {
            setIsExpanded(!isExpanded);
        }
    };

    // Handle long press - enter edit mode
    const handleLongPress = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        setIsExpanded(true);
        setIsEditing(true);
        setShowDomainSelector(false); // Reset selector visibility

        const parsed = FrontmatterService.parseFrontmatter(note.content);
        setEditBody(parsed.body);
        setEditFrontmatter(parsed.frontmatter);

        const len = parsed.body.length;
        const initialSelection = { start: len, end: len };
        setEditSelection(initialSelection);
        onEditStart?.(editorRef as any, parsed.body, initialSelection);
        setTimeout(() => {
            editorRef.current?.focus();
        }, 100);
    };

    // Handle blur - save and exit
    const handleBlur = () => {
        const fullContent = FrontmatterService.composeContent(editFrontmatter, editBody);
        if (isEditing && fullContent !== note.content) {
            onUpdate(fullContent);
        }
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsEditing(false);
        setIsExpanded(false);
        onEditEnd?.(); // Notify end of editing
    };

    // Handle done button - save, dismiss keyboard, return focus to quick note
    const handleDone = () => {
        Keyboard.dismiss();
        const fullContent = FrontmatterService.composeContent(editFrontmatter, editBody);
        if (isEditing && fullContent !== note.content) {
            onUpdate(fullContent);
        }
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsEditing(false);
        setIsExpanded(false);
        onEditEnd?.(); // Notify end of editing
        // Return focus to quick note input
        onDismissKeyboard?.();
    };

    const hasChecklist = /\[[ x]\]/i.test(note.content);

    // Debug log for checklist detection
    useEffect(() => {
        if (isExpanded) {
            console.log('NoteCard Expanded:', { id: note.id, hasChecklist, contentPrefix: note.content.substring(0, 40) });
        }
    }, [isExpanded, hasChecklist]);

    // Force exit edit mode when another card starts editing
    useEffect(() => {
        if (forceExitEdit && isEditing) {
            // Save content if changed, but don't call onEditEnd (parent already knows)
            const fullContent = FrontmatterService.composeContent(editFrontmatter, editBody);
            if (fullContent !== note.content) {
                onUpdate(fullContent);
            }
            setIsEditing(false);
            setIsExpanded(false);
        }
    }, [forceExitEdit]);

    // Auto-edit mode: trigger edit on mount
    useEffect(() => {
        if (autoEdit) {
            const parsed = FrontmatterService.parseFrontmatter(note.content);
            setEditBody(parsed.body);
            setEditFrontmatter(parsed.frontmatter);
            const len = parsed.body.length;
            const initialSelection = { start: len, end: len };
            setEditSelection(initialSelection);
            onEditStart?.(editorRef as any, parsed.body, initialSelection);
            setTimeout(() => {
                editorRef.current?.focus();
            }, 100);
        }
    }, []);

    const handleQuickAdd = () => {
        // Find the last occurrence of a checklist item to append after it
        const lines = note.content.split('\n');
        let lastChecklistIndex = -1;

        for (let i = lines.length - 1; i >= 0; i--) {
            if (/[-\*]\s?\[[ x]\]/i.test(lines[i])) {
                lastChecklistIndex = i;
                break;
            }
        }

        let newBody;
        if (lastChecklistIndex !== -1) {
            const lastChecklistItem = lines[lastChecklistIndex];
            const prefix = '- [ ] ';

            lines.splice(lastChecklistIndex + 1, 0, prefix);
            newBody = lines.join('\n');
        } else {
            // Should not happen if hasChecklist is true, but fallback:
            const prefix = '- [ ] ';
            newBody = editBody + '\n' + prefix;
        }

        // Enter edit mode immediately
        const contentLen = newBody.length;
        const initialSelection = { start: contentLen, end: contentLen };

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setEditBody(newBody);
        setIsExpanded(true);
        setIsEditing(true);
        setEditSelection(initialSelection);

        // Notify parent about the change
        onEditContentChange?.(newBody);

        // Required timeout to wait for the Editor to be rendered in edit mode
        setTimeout(() => {
            editorRef.current?.focus();
        }, 150);
    };

    const handleDeleteCompleted = () => {
        Alert.alert(
            'מחיקת פריטים שבוצעו',
            'האם אתה בטוח שברצונך למחוק את כל הפריטים המסומנים?',
            [
                { text: 'בטל', style: 'cancel' },
                {
                    text: 'מחק',
                    style: 'destructive',
                    onPress: () => {
                        const lines = note.content.split('\n');
                        // Regex matches task items that are checked: [x] or [X]
                        const checkedRegex = /^\s*([-\*+]|\d+\.)\s*\[[xX]\]/;

                        const filteredLines = lines.filter(line => !checkedRegex.test(line));

                        if (filteredLines.length !== lines.length) {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            onUpdate(filteredLines.join('\n'));
                        }
                    }
                }
            ]
        );
    };

    const handleTextChangeWithListContinuation = (newText: string) => {
        const oldText = editBody;

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
                        setEditBody(cleanedText);
                        onEditContentChange?.(cleanedText);
                        return;
                    }
                    // Add unchecked checkbox to new line
                    const prefix = '- [ ] ';
                    const modifiedText = newText.substring(0, cursorPos + 1) + prefix + newText.substring(cursorPos + 1);
                    setEditBody(modifiedText);
                    onEditContentChange?.(modifiedText);

                    // Set cursor position after the prefix
                    const newPos = cursorPos + 1 + prefix.length;
                    setTimeout(() => {
                        const newSelection = { start: newPos, end: newPos };
                        setEditSelection(newSelection);
                        onEditSelectionChange?.(newSelection);
                    }, 50);
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
                        setEditBody(cleanedText);
                        onEditContentChange?.(cleanedText);
                        return;
                    }
                    // Add list marker to new line
                    const prefix = '- ';
                    const modifiedText = newText.substring(0, cursorPos + 1) + prefix + newText.substring(cursorPos + 1);
                    setEditBody(modifiedText);
                    onEditContentChange?.(modifiedText);

                    // Set cursor position after the prefix
                    const newPos = cursorPos + 1 + prefix.length;
                    setTimeout(() => {
                        const newSelection = { start: newPos, end: newPos };
                        setEditSelection(newSelection);
                        onEditSelectionChange?.(newSelection);
                    }, 50);
                    return;
                }
            }
        }

        // No list continuation needed
        setEditBody(newText);
        onEditContentChange?.(newText);
    };

    return (
        <TouchableOpacity
            style={[
                styles.card,
                isExpanded && styles.cardExpanded,
                isEditing && styles.cardEditing,
                style
            ]}
            onPress={handlePress}
            onLongPress={handleLongPress}
            activeOpacity={0.9}
            delayLongPress={500}
        >
            {/* Timestamp, sync status, Done button, and Pin indicator */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    {/* Domain Chip - Clickable in Edit Mode */}
                    {(isEditing || note.domain) && (
                        <TouchableOpacity
                            onPress={() => isEditing && setShowDomainSelector(!showDomainSelector)}
                            disabled={!isEditing}
                            style={[
                                styles.domainChip,
                                note.domain && DOMAINS[note.domain] ? {
                                    backgroundColor: DOMAINS[note.domain].color + '20',
                                    borderColor: DOMAINS[note.domain].color
                                } : (isEditing ? styles.domainEditButton : {})
                            ]}
                        >
                            <Text style={[
                                styles.domainText,
                                note.domain && DOMAINS[note.domain] ? { color: DOMAINS[note.domain].color } : styles.domainEditPlaceholder
                            ]}>
                                {note.domain && DOMAINS[note.domain] ? DOMAINS[note.domain].label : '+ תחום'}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {/* Pin Icon - Toggle in Edit Mode */}
                    {(isEditing || isPinned) && (
                        <TouchableOpacity
                            onPress={() => {
                                if (isEditing) {
                                    const newPinned = !isPinned;
                                    setIsPinned(newPinned);

                                    const newFrontmatter = { ...editFrontmatter, pinned: newPinned };
                                    setEditFrontmatter(newFrontmatter);

                                    const fullContent = FrontmatterService.composeContent(newFrontmatter, editBody);

                                    // Force immediate save for metadata changes
                                    onUpdate(fullContent);
                                }
                            }}
                            disabled={!isEditing}
                        >
                            <MaterialCommunityIcons
                                name={isPinned ? "pin" : "pin-outline"}
                                size={20}
                                color={isPinned ? "#FFC107" : (isEditing ? "#BDBDBD" : "transparent")}
                                style={styles.pinIcon}
                            />
                        </TouchableOpacity>
                    )}
                    <Text style={styles.timestamp}>
                        {formatTimestamp(note.updatedAt)}
                    </Text>
                </View>


                <View style={styles.headerRight}>
                    {isEditing && (
                        <TouchableOpacity onPress={handleDone} style={styles.doneButton}>
                            <Ionicons name="checkmark-circle" size={24} color="#6200EE" />
                        </TouchableOpacity>
                    )}
                    <View style={[styles.syncIndicator, { backgroundColor: syncStatusColor }]} />
                </View>
            </View>

            {/* Domain Selector - Full width below header */}
            {isEditing && showDomainSelector && (
                <DomainSelector
                    selectedDomain={note.domain as DomainType}
                    onSelectDomain={(domain) => {
                        const newFrontmatter = { ...editFrontmatter };
                        if (domain) {
                            newFrontmatter['domain'] = domain;
                        } else {
                            delete newFrontmatter['domain'];
                        }
                        setEditFrontmatter(newFrontmatter);
                        setShowDomainSelector(false);

                        const fullContent = FrontmatterService.composeContent(newFrontmatter, editBody);
                        onUpdate(fullContent);
                    }}
                    mode="select"
                    style={{ marginBottom: 12 }}
                />
            )}

            {/* Content - view or edit mode */}
            {isEditing ? (
                <View
                    style={{ maxHeight: maxEditHeight || 400, flex: 1 }}
                >
                    <NativeLiveEditor
                        ref={editorRef}
                        initialContent={editBody}
                        onChange={handleTextChangeWithListContinuation}
                        selection={editSelection}
                        onSelectionChange={(e) => {
                            const newSelection = e.nativeEvent.selection;
                            setEditSelection(newSelection);
                            onEditSelectionChange?.(newSelection);
                        }}
                        style={{ minHeight: 80 }}
                        contentInset={{ bottom: 60 }}
                        scrollIndicatorInsets={{ bottom: 60 }}
                    />
                </View>
            ) : (
                <View style={!isExpanded ? { maxHeight: 100, overflow: 'hidden' } : undefined}>
                    {/* Title */}
                    {hasTitle && title && (
                        <Text style={[styles.title, { textAlign: getDirection(title) === 'rtl' ? 'right' : 'left' }]} numberOfLines={isExpanded ? undefined : 2}>
                            {title}
                        </Text>
                    )}
                    {/* Body preview */}
                    <View style={!isExpanded ? { maxHeight: 120, overflow: 'hidden' } : undefined}>
                        <UnifiedMarkdownDisplay
                            content={bodyContent}
                            onToggleCheckbox={isExpanded && !isEditing ? (index) => {
                                // Delegate checkbox toggles to parent through onUpdate if not editing
                                const handleToggleCheckboxLocally = (checklistIndexTarget: number) => {
                                    const lines = note.content.split('\n');
                                    let currentChecklistIndex = 0;

                                    for (let i = 0; i < lines.length; i++) {
                                        const line = lines[i];
                                        const isTask = line.match(/^\s*[-*+]\s*\[([ xX])\]/) || line.match(/^\s*\d+\.\s*\[([ xX])\]/);

                                        if (isTask) {
                                            if (currentChecklistIndex === checklistIndexTarget) {
                                                const isChecking = line.match(/\[ \]/);

                                                if (isChecking) {
                                                    const toggledLine = line.replace('[ ]', '[x]');
                                                    let endOfBlock = i;
                                                    while (endOfBlock + 1 < lines.length) {
                                                        const nextLine = lines[endOfBlock + 1];
                                                        const isNextTask = nextLine.match(/^\s*[-*+]\s*\[([ xX])\]/) || nextLine.match(/^\s*\d+\.\s*\[([ xX])\]/);
                                                        if (isNextTask) {
                                                            endOfBlock++;
                                                        } else {
                                                            break;
                                                        }
                                                    }
                                                    if (endOfBlock > i) {
                                                        lines.splice(i, 1);
                                                        lines.splice(endOfBlock, 0, toggledLine);
                                                    } else {
                                                        lines[i] = toggledLine;
                                                    }
                                                } else {
                                                    lines[i] = line.replace(/\[x\]/i, '[ ]');
                                                }
                                                const newContent = lines.join('\n');
                                                onUpdate(newContent);
                                                return;
                                            }
                                            currentChecklistIndex++;
                                        }
                                    }
                                };
                                handleToggleCheckboxLocally(index);
                            } : undefined}
                        />
                    </View>
                    {!isExpanded && hasMore && (
                        <View style={styles.gradientOverlay} />
                    )}
                </View>
            )}

            {/* Quick Add Checklist Item Button - Inline at the bottom of display mode */}
            {isExpanded && !isEditing && hasChecklist && (
                <View style={styles.quickAddRow}>
                    <TouchableOpacity
                        onPress={handleQuickAdd}
                        style={styles.quickAddButtonInline}
                    >
                        <Ionicons name="add-circle" size={32} color="#6200EE" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleDeleteCompleted}
                        style={[styles.quickAddButtonInline, { marginLeft: 24 }]}
                    >
                        <MaterialCommunityIcons name="broom" size={28} color="#D32F2F" />
                    </TouchableOpacity>
                </View>
            )}

            {/* Tags */}
            {note.tags && note.tags.length > 0 && !isEditing && (
                <View style={styles.tagsContainer}>
                    {note.tags.slice(0, 3).map((tag) => (
                        <View key={tag} style={styles.tag}>
                            <Text style={styles.tagText}>#{tag}</Text>
                        </View>
                    ))}
                    {note.tags.length > 3 && (
                        <Text style={styles.moreText}>+{note.tags.length - 3}</Text>
                    )}
                </View>
            )}

            {/* Expand indicator */}
            {!isExpanded && hasMore && !isEditing && (
                <View style={styles.expandHint}>
                    <Ionicons name="chevron-down" size={16} color="#999" />
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    cardExpanded: {
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 5,
    },
    cardEditing: {
        borderWidth: 2,
        borderColor: '#6200EE',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    domainChip: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginRight: 8,
        borderWidth: 1,
    },
    domainText: {
        fontSize: 12,
        fontWeight: '600',
    },
    pinIcon: {
        marginRight: 4,
    },
    doneButton: {
        marginRight: 12,
        padding: 4,
    },
    editIcon: {
        marginRight: 8,
    },
    timestamp: {
        fontSize: 13,
        color: '#888888',
        ...RTL_TEXT_STYLE,
    },
    syncIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    domainEditButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        backgroundColor: '#F5F5F5',
    },
    domainEditPlaceholder: {
        fontSize: 12,
        color: '#666',
        fontWeight: '600',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1A1A1A',
        // textAlign/writingDirection removed here to be dynamic in render
        marginBottom: 6,
    },
    preview: {
        fontSize: 15,
        color: '#333333',
        lineHeight: 22,
        // textAlign/writingDirection removed
    },
    editInput: {
        fontSize: 15,
        color: '#333333',
        lineHeight: 22,
        ...RTL_TEXT_STYLE,
        minHeight: 60,
        padding: 0,
    },
    tagsContainer: {
        flexDirection: 'row-reverse',
        flexWrap: 'wrap',
        marginTop: 10,
    },
    tag: {
        backgroundColor: '#E3F2FD',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 6,
        marginBottom: 4,
    },
    tagText: {
        fontSize: 12,
        color: '#1976D2',
        fontWeight: '500',
    },
    moreText: {
        fontSize: 12,
        color: '#999',
        alignSelf: 'center',
    },
    expandHint: {
        alignItems: 'center',
        marginTop: 8,
    },
    gradientOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 40,
        backgroundColor: 'rgba(255,255,255,0.8)',
    },
    quickAddRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        marginTop: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    quickAddButtonInline: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
    },
    quickAddText: {
        marginLeft: 8,
        color: '#6200EE',
        fontWeight: '600',
        fontSize: 16,
    },
});

