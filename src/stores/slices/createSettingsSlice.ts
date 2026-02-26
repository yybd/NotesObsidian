import { StateCreator } from 'zustand';
import { AppSettings, ObsidianVaultConfig } from '../../types/Note';
import StorageService from '../../services/StorageService';
import { StoreState } from '../notesStore';

export interface SettingsSlice {
    settings: AppSettings;
    updateSettings: (settings: Partial<AppSettings>) => void;
    setVaultConfig: (config: ObsidianVaultConfig) => void;
    setEditorMode: (mode: 'markdown' | 'richtext') => void;
}

const defaultSettings: AppSettings = {
    vault: null,
    autoSync: false,
    syncInterval: 15,
    theme: 'auto',
    defaultView: 'grid',
    editorMode: 'richtext',
};

export const createSettingsSlice: StateCreator<
    StoreState,
    [],
    [],
    SettingsSlice
> = (set, get) => ({
    settings: defaultSettings,

    updateSettings: (newSettings: Partial<AppSettings>) => {
        const settings = { ...get().settings, ...newSettings };
        set({ settings });

        if (newSettings.vault !== undefined) {
            StorageService.setConfig(newSettings.vault);
            get().loadNotes().catch((err) => console.error('Failed to reload notes after settings update:', err));
        }
    },

    setVaultConfig: (config: ObsidianVaultConfig) => {
        const settings = { ...get().settings, vault: config };
        set({ settings });
        StorageService.setConfig(config);
        get().loadNotes().catch((err) => console.error('Failed to reload notes after vault config change:', err));
    },

    setEditorMode: (mode: 'markdown' | 'richtext') => {
        const settings = { ...get().settings, editorMode: mode };
        set({ settings });
    },
});
