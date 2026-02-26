import { Platform } from 'react-native';
import { StorageProvider, FileStat } from './StorageProvider';
import { ObsidianVaultConfig } from '../../types/Note';

export class WebStorageProvider implements StorageProvider {
    isSupported(): boolean {
        return Platform.OS === 'web';
    }

    private async getWebFileService(): Promise<any> {
        const WebFileService = require('../WebFileService').default;
        await WebFileService.initialize();
        return WebFileService;
    }

    async selectFolder(): Promise<ObsidianVaultConfig | null> {
        const WebFileService = await this.getWebFileService();
        const directoryName = await WebFileService.selectDirectory();
        if (directoryName) {
            return {
                vaultName: directoryName,
                vaultDirectoryUri: `web-vault://${directoryName}`,
                isConnected: true
            };
        }
        return null;
    }

    async list(subDirectory: string = ''): Promise<FileStat[]> {
        if (subDirectory) {
            console.warn('Listing archived notes for external web storage is currently unsupported');
            return [];
        }

        const WebFileService = await this.getWebFileService();
        const files: string[] = await WebFileService.listMarkdownFiles();

        return files.map((file: string) => ({
            name: file,
            // WebFileService doesn't expose mod time directly easily in current list
            modificationTime: Date.now()
        }));
    }

    async read(fileName: string, subDirectory: string = ''): Promise<string> {
        if (subDirectory) throw new Error('Web storage does not currently support subdirectories');
        const WebFileService = await this.getWebFileService();
        return await WebFileService.readFile(fileName);
    }

    async write(fileName: string, content: string, subDirectory: string = ''): Promise<void> {
        if (subDirectory) {
            console.warn('Subdirectories not supported on Web OPFS fallback');
            return; // Web archiving is unsupported natively via this API
        }
        const WebFileService = await this.getWebFileService();
        await WebFileService.writeFile(fileName, content);
    }

    async delete(fileName: string, subDirectory: string = ''): Promise<void> {
        if (subDirectory) {
            console.warn('Subdirectories not supported on Web OPFS fallback');
            return;
        }
        const WebFileService = await this.getWebFileService();
        await WebFileService.deleteFile(fileName);
    }
}
