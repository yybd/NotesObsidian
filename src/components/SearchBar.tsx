// SearchBar.tsx - Search input with real-time filtering

import React, { useState, forwardRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Keyboard, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RTL_TEXT_STYLE } from '../utils/rtlUtils';

interface SearchBarProps {
    onSearch: (query: string) => void;
    placeholder?: string;
    onFocus?: () => void;
    onBlur?: () => void;
}

export const SearchBar = forwardRef<TextInput, SearchBarProps>(({
    onSearch,
    placeholder = 'חפש פתקים...',
    onFocus,
    onBlur
}, ref) => {
    const [query, setQuery] = useState('');

    const handleChange = (text: string) => {
        setQuery(text);
        onSearch(text);
    };

    const handleClear = () => {
        setQuery('');
        onSearch('');
    };

    return (
        <View style={styles.container}>
            <Ionicons name="search" size={20} color="#666" style={styles.icon} />
            <TextInput
                ref={ref}
                style={styles.input}
                value={query}
                onChangeText={handleChange}
                placeholder={placeholder}
                placeholderTextColor="#999"
                returnKeyType="search"
                onSubmitEditing={() => Keyboard.dismiss()}
                onFocus={onFocus}
                onBlur={onBlur}
            />
            {query.length > 0 && (
                <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E4E6EB',
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 8,
    },
    icon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#1A1A1A',
        ...RTL_TEXT_STYLE,
        // @ts-ignore - outlineStyle is web-only
        outlineStyle: Platform.OS === 'web' ? 'none' : undefined,
    },
    clearButton: {
        padding: 4,
    },
});
