import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RTL_TEXT_STYLE } from '../utils/rtlUtils';
import { SearchBar } from './SearchBar';
import { DomainSelector } from './DomainSelector';
import { DomainType } from '../types/Note';

interface HeaderProps {
    title: string;
    onSettingsPress: () => void;
    // Search Props
    onSearch: (query: string) => void;
    onSearchFocus: () => void;
    onSearchBlur: () => void;
    isSearchFocused: boolean;
    // Domain Filter Props
    currentDomain: DomainType | null;
    onFilterByDomain: (domain: DomainType | null) => void;
    // Visibility
    hideSearchAndDomain?: boolean;
    onLayout?: (y: number, height: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
    title,
    onSettingsPress,
    onSearch,
    onSearchFocus,
    onSearchBlur,
    isSearchFocused,
    currentDomain,
    onFilterByDomain,
    hideSearchAndDomain,
    onLayout,
}) => {
    return (
        <View onLayout={onLayout ? (e) => onLayout(e.nativeEvent.layout.y, e.nativeEvent.layout.height) : undefined}>
            {/* Top Bar */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onSettingsPress} style={styles.iconButton}>
                    <Ionicons name="settings-outline" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{title}</Text>
                <View style={styles.iconPlaceholder} />
            </View>

            {/* Search Bar & Domain Filter */}
            {!hideSearchAndDomain && (
                <View style={styles.searchContainer}>
                    <SearchBar
                        onSearch={onSearch}
                        onFocus={onSearchFocus}
                        onBlur={onSearchBlur}
                    />
                    {!isSearchFocused && (
                        <DomainSelector
                            selectedDomain={currentDomain}
                            onSelectDomain={onFilterByDomain}
                            mode="filter"
                        />
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1A1A1A',
        ...RTL_TEXT_STYLE,
    },
    iconButton: {
        padding: 8,
    },
    iconPlaceholder: {
        width: 40,
    },
    searchContainer: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
        backgroundColor: '#F0F2F5',
        zIndex: 10,
    },
});
