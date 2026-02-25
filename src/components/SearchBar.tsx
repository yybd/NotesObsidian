// SearchBar.tsx - Search input with real-time filtering

import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RTL_TEXT_STYLE } from '../utils/rtlUtils';

interface SearchBarProps {
    onSearch: (query: string) => void;
    placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    onSearch,
    placeholder = 'חפש פתקים...'
}) => {
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
                style={styles.input}
                value={query}
                onChangeText={handleChange}
                placeholder={placeholder}
                placeholderTextColor="#999"
                returnKeyType="search"
            />
            {query.length > 0 && (
                <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 16,
    },
    icon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#1A1A1A',
        ...RTL_TEXT_STYLE,
    },
    clearButton: {
        padding: 4,
    },
});
