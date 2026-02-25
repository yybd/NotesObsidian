// VaultSyncService.ts - Direct file system sync with Obsidian vault folder

import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { Note, ObsidianVaultConfig } from '../types/Note';
import CloudFileService from './CloudFileService';

class VaultSyncService {
    private vaultConfig: ObsidianVaultConfig | null = null;

    /**
     * Set the vault configuration
     */
    setVaultConfig(config: ObsidianVaultConfig): void {
        this.vaultConfig = config;
    }

    /**
     * Get current vault configuration
     */
    getVaultConfig(): ObsidianVaultConfig | null {
        return this.vaultConfig;
    }

    /**
     * Select Obsidian vault folder
     * Android: Uses Storage Access Framework for direct folder selection
     * iOS: Uses document picker, extracts folder from selected file
     */
    async selectVaultDirectory(): Promise<string | null> {
        try {
            if (Platform.OS === 'web') {
                // Web: Use File System Access API
                // Import WebFileService dynamically
                const WebFileService = require('./WebFileService').default;

                // Initialize first to check for existing handle
                await WebFileService.initialize();

                // Request directory selection
                const directoryName = await WebFileService.selectDirectory();

                if (directoryName) {
                    console.log('Selected vault folder (Web):', directoryName);
                    // Return a dummy URI for Web since we use the handle stored in IndexedDB
                    return `web-vault://${directoryName}`;
                } else {
                    return null;
                }
            } else if (Platform.OS === 'android') {
                // Android: Use Storage Access Framework for direct folder selection
                const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

                if (permissions.granted) {
                    const directoryUri = permissions.directoryUri;
                    console.log('Selected vault folder (Android SAF):', directoryUri);
                    return directoryUri;
                } else {
                    console.log('Directory permission denied');
                    return null;
                }
            } else {
                // iOS: Use document picker, extract folder from selected file
                const result = await DocumentPicker.getDocumentAsync({
                    type: '*/*',
                    copyToCacheDirectory: false,
                });

                if (result.canceled || !result.assets || result.assets.length === 0) {
                    return null;
                }

                // Extract directory from the selected file
                const fileUri = result.assets[0].uri;
                const directoryUri = fileUri.substring(0, fileUri.lastIndexOf('/'));

                console.log('Selected vault folder (iOS):', directoryUri);
                return directoryUri;
            }
        } catch (error) {
            console.error('Error selecting vault directory:', error);
            throw error;
        }
    }

    /**
     * Sync note to Obsidian vault
     * Android: Uses SAF for direct file writing
     * iOS: Uses Obsidian URI scheme (due to sandbox restrictions)
     * Web: Uses File System Access API
     */
    async syncNoteToVault(note: Note): Promise<void> {
        if (!this.vaultConfig?.vaultDirectoryUri) {
            throw new Error('Vault directory not configured');
        }

        try {
            const vaultUri = this.vaultConfig.vaultDirectoryUri;

            // Ensure .md extension
            let fileName = note.title;
            if (!fileName.endsWith('.md')) {
                fileName = `${fileName}.md`;
            }

            if (Platform.OS === 'web') {
                // Web: Use File System Access API
                const WebFileService = require('./WebFileService').default;
                await WebFileService.writeFile(fileName, note.content);
                console.log('Note synced to vault (Web):', fileName);
            } else if (Platform.OS === 'android') {
                // Android: Use SAF to create and write file directly
                const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                    vaultUri,
                    fileName,
                    'text/markdown'
                );
                await FileSystem.writeAsStringAsync(fileUri, note.content);
                console.log('Note synced to vault (Android SAF):', fileUri);
            } else {
                // iOS: Use direct iCloud Drive access via Native Module
                // Import CloudFileService dynamically to retrieve the correct instance
                const CloudFileService = require('./CloudFileService').default;

                // Writing directly to the file using bookmark
                await CloudFileService.writeFile(fileName, note.content);
                console.log('Note synced to iCloud Drive (iOS Native):', fileName);
            }
        } catch (error) {
            console.error('Error syncing note to vault:', error);
            throw error;
        }
    }

    /**
     * Load all notes from Obsidian vault folder
     * Android: Uses SAF, iOS: Uses direct file paths, Web: Uses File System Access API
     */
    async loadNotesFromVault(): Promise<Note[]> {
        if (!this.vaultConfig?.vaultDirectoryUri) {
            throw new Error('Vault directory not configured');
        }

        try {
            const vaultUri = this.vaultConfig.vaultDirectoryUri;

            if (Platform.OS === 'web') {
                const WebFileService = require('./WebFileService').default;
                await WebFileService.initialize();

                const files = await WebFileService.listMarkdownFiles();
                console.log(`Found ${files.length} notes in vault (Web)`);

                const notes: Note[] = [];
                for (const fileName of files) {
                    try {
                        const content = await WebFileService.readFile(fileName);
                        const title = fileName.replace('.md', '');
                        const timestamp = Date.now(); // We can't easily get mod time on web without extra calls

                        notes.push({
                            id: title, // Use title as ID for web since paths are virtual
                            title,
                            content,
                            createdAt: new Date(timestamp),
                            updatedAt: new Date(timestamp),
                            filePath: fileName,
                            syncStatus: 'synced',
                            tags: this.extractTags(content),
                        });
                    } catch (readError) {
                        console.error(`Error reading web file ${fileName}:`, readError);
                    }
                }
                return notes;
            }

            let mdFiles: string[] = [];

            if (Platform.OS === 'android') {
                // Android: Use SAF to read directory
                const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(vaultUri);
                mdFiles = files.filter(fileUri => {
                    const fileName = fileUri.split('/').pop() || '';
                    return fileName.endsWith('.md');
                });
            } else {
                // iOS: Use direct file path
                const files = await FileSystem.readDirectoryAsync(vaultUri);
                mdFiles = files
                    .filter(f => f.endsWith('.md'))
                    .map(f => `${vaultUri}/${f}`);
            }

            console.log(`Found ${mdFiles.length} notes in vault`);

            const notes: Note[] = [];
            for (const fileUri of mdFiles) {
                try {
                    const content = await FileSystem.readAsStringAsync(fileUri);
                    const fileInfo = await FileSystem.getInfoAsync(fileUri);

                    const fileName = fileUri.split('/').pop() || '';
                    const title = fileName.replace('.md', '');

                    const timestamp = (fileInfo.exists && 'modificationTime' in fileInfo)
                        ? fileInfo.modificationTime || Date.now()
                        : Date.now();

                    notes.push({
                        id: timestamp.toString(),
                        title,
                        content,
                        createdAt: new Date(timestamp),
                        updatedAt: new Date(timestamp),
                        filePath: fileUri,
                        syncStatus: 'synced',
                        tags: this.extractTags(content),
                    });
                } catch (fileError) {
                    console.error(`Error reading file ${fileUri}:`, fileError);
                }
            }

            return notes;
        } catch (error) {
            console.error('Error loading notes from vault:', error);
            return [];
        }
    }

    /**
     * Check if we have vault access
     */
    hasVaultAccess(): boolean {
        return !!this.vaultConfig?.vaultDirectoryUri;
    }

    /**
     * Extract tags from content
     */
    private extractTags(content: string): string[] {
        const tagRegex = /#([a-zA-Z0-9_\u0590-\u05FF]+)/g;
        const matches = content.match(tagRegex);
        if (!matches) return [];
        return [...new Set(matches.map(tag => tag.substring(1)))];
    }
}

export default new VaultSyncService();
