import React from 'react';
import { ScrollView, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DomainType, DOMAINS } from '../types/Note';

interface DomainSelectorProps {
    selectedDomain: DomainType | null;
    onSelectDomain: (domain: DomainType | null) => void;
    mode?: 'select' | 'filter'; // 'select' for single choice (toggle off), 'filter' might look slightly different
    style?: any;
}

export const DomainSelector: React.FC<DomainSelectorProps> = ({ selectedDomain, onSelectDomain, mode = 'select', style }) => {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.container}
            style={[mode === 'filter' ? styles.filterScrollView : styles.selectScrollView, style]}
            keyboardShouldPersistTaps="always"
        >
            {/* Clear button for filter mode if a domain is selected */}
            {mode === 'filter' && selectedDomain && (
                <TouchableOpacity
                    style={[styles.chip, styles.clearChip]}
                    onPress={() => onSelectDomain(null)}
                >
                    <Ionicons name="close-circle" size={16} color="#666" />
                    <Text style={styles.clearText}>ניקוי</Text>
                </TouchableOpacity>
            )}

            {(Object.keys(DOMAINS) as DomainType[]).map((domain) => {
                const config = DOMAINS[domain];
                const isSelected = selectedDomain === domain;

                return (
                    <TouchableOpacity
                        key={domain}
                        style={[
                            styles.chip,
                            {
                                borderColor: config.color,
                                backgroundColor: isSelected ? config.color : config.color + '15' // Solid if selected, very light if not
                            }
                        ]}
                        onPress={() => {
                            if (mode === 'select') {
                                // Toggle behavior for select mode
                                onSelectDomain(isSelected ? null : domain);
                            } else {
                                // For filter mode, just select (clearing is done via separate button or re-clicking)
                                onSelectDomain(isSelected ? null : domain);
                            }
                        }}
                    >
                        <Ionicons
                            name={config.icon as any}
                            size={16}
                            color={isSelected ? '#FFFFFF' : config.color}
                            style={styles.icon}
                        />
                        <Text style={[
                            styles.label,
                            isSelected ? { color: '#FFFFFF', fontWeight: '700' } : { color: config.color, fontWeight: '500' }
                        ]}>
                            {config.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        alignItems: 'center',
        flexDirection: 'row', // Layout starting from left where ScrollView begins
    },
    selectScrollView: {
        maxHeight: 50,
        marginBottom: 8,
    },
    filterScrollView: {
        maxHeight: 50,
        backgroundColor: '#f8f9fa',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    chip: {
        flexDirection: 'row-reverse', // Icon on right for RTL
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    unselectedChip: {
        backgroundColor: '#fff',
        borderColor: '#eee',
    },
    clearChip: {
        backgroundColor: '#eee',
        borderColor: '#ddd',
    },
    icon: {
        marginLeft: 6, // Space between icon and text (icon is on right in RTL row-reverse? No, direction is row-reverse, so items are Right->Left: Icon, Text. So marginLeft on Icon pushes Text away? No.
        // If flexDirection: row-reverse:
        // [Icon] [Text]  <-- Rendered as [Text] [Icon] visually?
        // Let's verify.
        // Default (row): [Child1] [Child2] -> LTR
        // row-reverse: [Child1] [Child2] -> RTL (Child1 on right)
        // We want [Icon] [Text] in code to appear as [Icon] [Text] visually? 
        // Usually chips are [Icon] [Text].
        // In RTL, it should probably be [Icon] [Text] too, flowing right to left?
        // Actually Hebrew chips often have Icon on Right.
        // Let's assume standardized [Icon] [Text] structure.
        // If I use row-reverse on the chip, 
        // <Icon /> <Text /> code order.
        // Visually: [Text] [Icon] (Icon on right).
        // This makes sense for Hebrew.
    },
    label: {
        fontSize: 14,
    },
    clearText: {
        fontSize: 14,
        color: '#666',
        marginLeft: 4,
    }
});
