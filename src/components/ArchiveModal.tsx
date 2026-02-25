// ArchiveModal.tsx - Modal for viewing and managing archived notes

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    Alert,
    ActivityIndicator,
    useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Note } from '../types/Note';
import StorageService from '../services/StorageService';
import { useNotesStore } from '../stores/notesStore';
import { RTL_TEXT_STYLE, RTL_ROW } from '../utils/rtlUtils';

interface ArchiveModalProps {
    visible: boolean;
    onClose: () => void;
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({ visible, onClose }) => {
    const [archivedNotes, setArchivedNotes] = useState<Note[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
    const { loadNotes } = useNotesStore();
    const { height: screenHeight } = useWindowDimensions();

    const fetchArchivedNotes = async () => {
        setIsLoading(true);
        try {
            const notes = await StorageService.listArchivedNotes();
            setArchivedNotes(notes);
        } catch (error) {
            console.error('Error fetching archived notes:', error);
            Alert.alert('שגיאה', 'לא ניתן לטעון את הארכיון');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (visible) {
            fetchArchivedNotes();
        }
    }, [visible]);

    const handleRestore = async (note: Note) => {
        try {
            await StorageService.restoreNote(note);
            setArchivedNotes(prev => prev.filter(n => n.id !== note.id));
            loadNotes(); // Refresh main list
        } catch (error) {
            console.error('Error restoring note:', error);
            Alert.alert('שגיאה', 'לא ניתן לשחזר את הפתק');
        }
    };

    const handleDeleteForever = (note: Note) => {
        Alert.alert(
            'מחיקה לצמיתות',
            'האם אתה בטוח שברצונך למחוק פתק זה לצמיתות? לא ניתן לשחזר פעולה זו.',
            [
                { text: 'ביטול', style: 'cancel' },
                {
                    text: 'מחק',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await StorageService.deleteArchivedNote(note);
                            setArchivedNotes(prev => prev.filter(n => n.id !== note.id));
                        } catch (error) {
                            console.error('Error deleting note forever:', error);
                            Alert.alert('שגיאה', 'לא ניתן למחוק את הפתק');
                        }
                    }
                }
            ]
        );
    };

    const handleEmptyArchive = () => {
        Alert.alert(
            'ריקון ארכיון',
            'האם אתה בטוח שברצונך למחוק את כל הפתקים שבארכיון לצמיתות? לא ניתן לשחזר פעולה זו.',
            [
                { text: 'ביטול', style: 'cancel' },
                {
                    text: 'מחק הכל',
                    style: 'destructive',
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            await StorageService.emptyArchive();
                            setArchivedNotes([]);
                        } catch (error) {
                            console.error('Error emptying archive:', error);
                            Alert.alert('שגיאה', 'לא ניתן לרוקן את הארכיון');
                        } finally {
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const toggleExpand = (id: string) => {
        setExpandedNoteId(prev => prev === id ? null : id);
    };

    const renderItem = ({ item }: { item: Note }) => {
        const isExpanded = expandedNoteId === item.id;

        return (
            <View style={styles.noteItem}>
                <TouchableOpacity
                    style={styles.noteContent}
                    onPress={() => toggleExpand(item.id)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.noteTitle} numberOfLines={isExpanded ? undefined : 1}>{item.title}</Text>
                    <Text style={styles.noteText} numberOfLines={isExpanded ? undefined : 2}>
                        {item.content.replace(/^# /, '').trim()}
                    </Text>
                </TouchableOpacity>
                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.restoreButton]}
                        onPress={() => handleRestore(item)}
                    >
                        <Ionicons name="refresh-outline" size={20} color="#4CAF50" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => handleDeleteForever(item)}
                    >
                        <Ionicons name="trash-outline" size={20} color="#F44336" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { maxHeight: screenHeight * 0.9 }]}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#1A1A1A" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>ארכיון פתקים</Text>
                        <View style={styles.headerPlaceholder} />
                    </View>

                    {isLoading ? (
                        <View style={styles.centerContainer}>
                            <ActivityIndicator size="large" color="#6200EE" />
                        </View>
                    ) : archivedNotes.length === 0 ? (
                        <View style={styles.centerContainer}>
                            <Ionicons name="archive-outline" size={64} color="#CCC" />
                            <Text style={styles.emptyText}>הארכיון ריק</Text>
                        </View>
                    ) : (
                        <>
                            <FlatList
                                data={archivedNotes}
                                keyExtractor={item => item.id}
                                renderItem={renderItem}
                                contentContainerStyle={styles.listContent}
                            />
                            <View style={styles.footer}>
                                <TouchableOpacity
                                    style={styles.emptyArchiveButton}
                                    onPress={handleEmptyArchive}
                                >
                                    <Ionicons name="trash-bin-outline" size={20} color="#FFFFFF" />
                                    <Text style={styles.emptyArchiveText}>מחק הכל</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end', // Slide from bottom
    },
    modalContent: {
        backgroundColor: '#F9F9F9',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 8,
        flex: 1,
    },
    header: {
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1A1A1A',
    },
    closeButton: {
        padding: 4,
    },
    headerPlaceholder: {
        width: 32,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 18,
        color: '#999',
        marginTop: 16,
        fontWeight: '500',
    },
    listContent: {
        padding: 16,
        paddingBottom: 24,
    },
    noteItem: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    noteContent: {
        flex: 1,
        marginLeft: 16,
    },
    noteTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 4,
        ...RTL_TEXT_STYLE,
    },
    noteText: {
        fontSize: 14,
        color: '#666',
        ...RTL_TEXT_STYLE,
    },
    actionButtons: {
        flexDirection: 'row-reverse',
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
        backgroundColor: '#F5F5F5',
    },
    restoreButton: {
        backgroundColor: '#E8F5E9',
    },
    deleteButton: {
        backgroundColor: '#FFEBEE',
    },
    footer: {
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    emptyArchiveButton: {
        flexDirection: 'row-reverse',
        backgroundColor: '#F44336',
        padding: 14,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyArchiveText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    }
});
