// SettingsScreen.tsx - App settings and Obsidian vault configuration

import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    ScrollView,
    Switch,
    Alert,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useNotesStore } from '../stores/notesStore';
import ObsidianService from '../services/ObsidianService';
import VaultSyncService from '../services/VaultSyncService';
import StorageService from '../services/StorageService';
import { ArchiveModal } from '../components/ArchiveModal';
import { RTL_TEXT_STYLE } from '../utils/rtlUtils';

export const SettingsScreen = ({ navigation }: any) => {
    const { settings, updateSettings, setVaultConfig, importFromObsidian } = useNotesStore();
    const [vaultName, setVaultName] = useState(settings.vault?.vaultName || '');
    const [folderPath, setFolderPath] = useState(settings.vault?.folderPath || '');
    const [isCheckingObsidian, setIsCheckingObsidian] = useState(false);
    const [isArchiveVisible, setIsArchiveVisible] = useState(false);

    const handleConnectVault = async () => {
        if (!vaultName.trim()) {
            Alert.alert('שגיאה', 'הכנס את שם ה-Vault של Obsidian');
            return;
        }

        setIsCheckingObsidian(true);
        try {
            setVaultConfig({
                vaultName: vaultName.trim(),
                folderPath: folderPath.trim() || undefined,
                isConnected: true,
            });

            Alert.alert('הצלחה', `ה - Vault "${vaultName}" חובר בהצלחה`);
        } catch (error) {
            Alert.alert('שגיאה', 'לא ניתן לחבר ל-Vault');
        } finally {
            setIsCheckingObsidian(false);
        }
    };

    const handleSelectVaultDirectory = async () => {
        try {
            const vaultConfig = await StorageService.selectExternalFolder();

            if (vaultConfig) {
                // If user entered a manual name on iOS, respect it
                if (Platform.OS === 'ios' && vaultName.trim()) {
                    vaultConfig.vaultName = vaultName.trim();
                }

                setVaultConfig(vaultConfig);
                StorageService.setConfig(vaultConfig);

                Alert.alert(
                    'הצלחה ✅',
                    `תיקייה נבחרה בהצלחה!\n\n📁 ${vaultConfig.vaultName}\n\n✨ כעת תוכל לכתוב ולקרוא ישירות מהתיקייה!`
                );
            }
        } catch (error) {
            console.error('Error selecting vault:', error);
            Alert.alert('שגיאה', 'לא ניתן לבחור תיקייה');
        }
    };

    const handleDisconnectVault = () => {
        Alert.alert(
            'ניתוק',
            `האם לנתק את ה - Vault "${settings.vault?.vaultName}" ? `,
            [
                { text: 'ביטול', style: 'cancel' },
                {
                    text: 'נתק',
                    style: 'destructive',
                    onPress: () => {
                        setVaultConfig({ vaultName: '', isConnected: false });
                        setVaultName('');
                    },
                },
            ]
        );
    };

    const handleImportVault = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'text/markdown',
                copyToCacheDirectory: true,
                multiple: true,
            });

            if (result.canceled) return;

            for (const file of result.assets) {
                await importFromObsidian(file.uri);
            }

            Alert.alert('הצלחה', `${result.assets.length} פתקים יובאו בהצלחה`);
        } catch (error) {
            Alert.alert('שגיאה', 'לא ניתן לייבא פתקים');
        }
    };

    const handleAutoSyncToggle = (value: boolean) => {
        if (value && !settings.vault?.isConnected) {
            Alert.alert('שגיאה', 'חבר קודם את ה-Vault של Obsidian');
            return;
        }
        updateSettings({ autoSync: value });
    };

    return (
        <ScrollView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>הגדרות</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Storage Configuration */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>מיקום האחסון</Text>

                {!settings.vault?.isConnected ? (
                    <>
                        <View style={styles.storageCard}>
                            <Ionicons name="phone-portrait-outline" size={24} color="#666" />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.storageTitle}>אחסון מקומי</Text>
                                <Text style={styles.storageDesc}>הפתקים נשמרים על המכשיר בלבד.</Text>
                            </View>
                            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                        </View>

                        <Text style={styles.sectionSubtitle}>חיבור לענן / חיצוני</Text>
                        <Text style={styles.description}>
                            ניתן לחבר תיקייה חיצונית (כמו iCloud Drive) כדי שהפתקים ישמרו ישירות שם ויסונכרנו עם המחשב.
                        </Text>

                        <TouchableOpacity
                            style={[styles.button, styles.buttonPrimary]}
                            onPress={handleSelectVaultDirectory}
                        >
                            <Ionicons name="folder-open" size={20} color="#FFFFFF" />
                            <Text style={styles.buttonText}>
                                {Platform.OS === 'ios' ? 'בחר תיקיית iCloud Drive' : 'בחר תיקייה חיצונית'}
                            </Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <View style={styles.storageCard}>
                            <Ionicons name="cloud-outline" size={24} color="#6200EE" />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.storageTitle}>אחסון חיצוני מחובר</Text>
                                <Text style={styles.storageDesc} numberOfLines={1}>
                                    {settings.vault.vaultName}
                                </Text>
                            </View>
                            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                        </View>

                        {settings.vault.vaultDirectoryUri && (
                            <Text style={styles.pathText}>
                                {decodeURIComponent(settings.vault.vaultDirectoryUri)}
                            </Text>
                        )}

                        <TouchableOpacity
                            style={[styles.button, styles.buttonSecondary]}
                            onPress={handleDisconnectVault}
                        >
                            <Ionicons name="log-out-outline" size={20} color="#F44336" />
                            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                                חזור לאחסון מקומי
                            </Text>
                        </TouchableOpacity>

                        <Text style={styles.hint}>
                            💡 הפתקים נשמרים ומתעדכנים ישירות בתיקייה שנבחרה.
                        </Text>
                    </>
                )}
            </View>

            {/* Archive Settings */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>ארכיון</Text>
                <Text style={styles.description}>
                    פתקים שהעברת לארכיון ישמרו כאן. ניתן למחוק אותם לצמיתות או לשחזר אותם לרשימה.
                </Text>

                <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary]}
                    onPress={() => setIsArchiveVisible(true)}
                >
                    <Ionicons name="archive-outline" size={20} color="#F44336" />
                    <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                        ניהול ארכיון הפתקים
                    </Text>
                </TouchableOpacity>
            </View>

            {/* App Info */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>אודות</Text>
                <Text style={styles.infoText}>גרסה: 1.1.0 (Direct Storage)</Text>
                <Text style={styles.infoText}>
                    הפתקים שלך, איפה שאתה רוצה אותם.
                </Text>
            </View>

            {/* Archive Modal */}
            <ArchiveModal
                visible={isArchiveVisible}
                onClose={() => setIsArchiveVisible(false)}
            />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9F9F9',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1A1A1A',
    },
    backButton: {
        padding: 8,
    },
    placeholder: {
        width: 40,
    },
    section: {
        backgroundColor: '#FFFFFF',
        padding: 20,
        marginTop: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 16,
    },
    sectionSubtitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginTop: 16,
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
        lineHeight: 20,
    },
    input: { // This style is no longer used but kept for now
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#1A1A1A',
        marginBottom: 12,
        ...RTL_TEXT_STYLE,
    },
    button: {
        flexDirection: 'row',
        backgroundColor: '#6200EE',
        padding: 14,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    buttonDisabled: { // This style is no longer used but kept for now
        backgroundColor: '#CCC',
    },
    buttonSecondary: {
        backgroundColor: '#FFE5E5',
    },
    buttonOutline: { // This style is no longer used but kept for now
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#6200EE',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    buttonTextSecondary: {
        color: '#F44336',
    },
    buttonTextOutline: { // This style is no longer used but kept for now
        color: '#6200EE',
    },
    connectedCard: { // This style is no longer used but kept for now
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    connectedText: { // This style is no longer used but kept for now
        fontSize: 14,
        color: '#2E7D32',
        marginLeft: 8,
        fontWeight: '500',
    },
    settingRow: { // This style is no longer used but kept for now
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    settingLabel: { // This style is no longer used but kept for now
        fontSize: 16,
        color: '#1A1A1A',
        flex: 1,
        ...RTL_TEXT_STYLE,
        marginRight: 12,
    },
    settingDescription: { // This style is no longer used but kept for now
        fontSize: 12,
        color: '#999',
        marginTop: 4,
    },
    infoText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    instructionText: { // This style is no longer used but kept for now
        fontSize: 14,
        color: '#666',
        lineHeight: 22,
    },
    hint: {
        fontSize: 12,
        color: '#666',
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 8,
    },
    connectedSubtext: { // This style is no longer used but kept for now
        fontSize: 12,
        color: '#4CAF50',
        marginTop: 4,
    },
    buttonPrimary: {
        backgroundColor: '#6200EE',
    },
    orText: { // This style is no longer used but kept for now
        textAlign: 'center',
        color: '#999',
        fontSize: 14,
        marginVertical: 12,
    },
    helpText: { // This style is no longer used but kept for now
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        marginTop: -8,
        marginBottom: 12,
    },
    storageCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    storageTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 4,
        ...RTL_TEXT_STYLE,
    },
    storageDesc: {
        fontSize: 13,
        color: '#666',
        ...RTL_TEXT_STYLE,
    },
    pathText: {
        fontSize: 12,
        color: '#999',
        fontFamily: 'monospace',
        marginBottom: 16,
        textAlign: 'center',
    },
});
