// App.tsx - Main application with navigation

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NotesListScreen } from './src/screens/NotesListScreen';
import { NoteEditorScreen } from './src/screens/NoteEditorScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import ObsidianService from './src/services/ObsidianService';
import FileService from './src/services/FileService';
import { AppState, AppStateStatus, Platform, Alert } from 'react-native';

const Stack = createNativeStackNavigator();

import { useNotesStore } from './src/stores/notesStore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  const loadNotes = useNotesStore(state => state.loadNotes);

  useEffect(() => {
    // Initialize app
    const initializeApp = async () => {
      try {
        // Web Support Check
        if (Platform.OS === 'web') {
          const WebFileService = require('./src/services/WebFileService').default;
          if (!WebFileService.isSupported()) {
            // Delay slightly to ensure UI is ready
            setTimeout(() => {
              alert(
                'דפדפן לא נתמך\n\n' +
                'האפליקציה דורשת דפדפן התומך ב-File System Access API (כגון Chrome, Edge, או Opera) כדי לגשת לקבצים במחשב.\n\n' +
                'ייתכן שחלק מהפונקציות לא יעבדו בדפדפן זה.'
              );
            }, 1000);
          }
        }

        // Initialize file system
        await FileService.initialize();

        // Set up deep linking for Obsidian callbacks
        ObsidianService.setupDeepLinking((url) => {
          console.log('Deep link received:', url);
          // Handle callback from Obsidian
          if (url.includes('sync-callback')) {
            console.log('Sync completed successfully');
          }
        });
      } catch (error) {
        console.error('App initialization error:', error);
      }
    };

    initializeApp();

    // Smart Sync: Refresh notes when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('📱 App came to foreground, refreshing notes...');
        loadNotes();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTitleStyle: { fontWeight: 'bold' },
            headerShadowVisible: false, // Create a cleaner look
          }}
        >
          <Stack.Screen
            name="NotesList"
            component={NotesListScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="NoteEditor"
            component={NoteEditorScreen}
            options={{
              headerShown: false,
              presentation: 'modal'
            }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              headerShown: false,
              presentation: 'modal'
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
