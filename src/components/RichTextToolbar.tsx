// RichTextToolbar.tsx
// Custom toolbar with TouchableOpacity buttons that call sendAction directly.
// We track selected state ourselves via registerToolbar.

import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Keyboard,
    Text,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { actions } from 'react-native-pell-rich-editor';

interface RichTextToolbarProps {
    richEditorRef: React.RefObject<any> | null;
    onPinPress?: () => void;
    isPinned?: boolean;
}

const FORMATTING_ACTIONS = [
    actions.heading1,
    actions.setBold,
    actions.insertBulletsList,
    actions.checkboxList,
];

export const RichTextToolbar: React.FC<RichTextToolbarProps> = ({
    richEditorRef,
    onPinPress,
    isPinned,
}) => {
    const [selectedActions, setSelectedActions] = useState<string[]>([]);

    // Register with the editor so we receive selection-change updates
    useEffect(() => {
        if (!richEditorRef?.current) return;
        try {
            richEditorRef.current.registerToolbar((items: string[]) => {
                setSelectedActions(items);
            });
        } catch (e) {}
    }, [richEditorRef]);

    if (!richEditorRef) return null;

    const isSelected = (action: string) =>
        selectedActions.includes(action) ||
        selectedActions.some((i: any) => i && i.type === action);

    const handlePress = (action: string) => {
        if (action === actions.checkboxList && isSelected(actions.checkboxList)) {
            richEditorRef?.current?.commandDOM?.(
                `(function(){
                    var sel = window.getSelection();
                    if (!sel || !sel.anchorNode) return;
                    // Find the <li> the cursor is in
                    var li = sel.anchorNode;
                    while (li && li.nodeName !== 'LI') li = li.parentNode;
                    if (!li) return;
                    var ol = li.parentNode;
                    // Remove checkbox span, keep text only
                    var spans = li.querySelectorAll('.x-todo-box');
                    spans.forEach(function(s){ s.remove(); });
                    var text = li.textContent || '';
                    // Use <div> — same as Pell's defaultParagraphSeparator, no extra margin
                    var div = document.createElement('div');
                    if (text) { div.textContent = text; } else { div.innerHTML = '<br>'; }
                    var nextLi = li.nextElementSibling;
                    if (nextLi) {
                        // Split: move remaining <li>s to a new <ol> after the <div>
                        var newOl = document.createElement('ol');
                        newOl.className = ol.className;
                        var sibling = nextLi;
                        while (sibling) {
                            var next = sibling.nextElementSibling;
                            newOl.appendChild(sibling);
                            sibling = next;
                        }
                        ol.parentNode.insertBefore(div, ol.nextSibling);
                        ol.parentNode.insertBefore(newOl, div.nextSibling);
                    } else {
                        ol.parentNode.insertBefore(div, ol.nextSibling);
                    }
                    ol.removeChild(li);
                    if (!ol.children.length) ol.remove();
                    // Move cursor into the new div
                    var range = document.createRange();
                    var textNode = div.firstChild || div;
                    range.setStart(textNode, textNode.nodeType === 3 ? textNode.length : 0);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                })()`
            );
        } else {
            richEditorRef?.current?.sendAction(action, 'result');
        }
    };

    const renderBtn = (action: string) => {
        const selected = isSelected(action);
        let content: React.ReactNode;

        switch (action) {
            case actions.heading1:
                content = <Text style={[styles.label, selected && styles.labelActive]}>H1</Text>;
                break;
            case actions.setBold:
                content = <Text style={[styles.labelBold, selected && styles.labelActive]}>B</Text>;
                break;
            case actions.insertBulletsList:
                content = <Ionicons name="list" size={22} color={selected ? '#FFFFFF' : '#6200EE'} />;
                break;
            case actions.checkboxList:
                content = <Ionicons name="checkbox-outline" size={22} color={selected ? '#FFFFFF' : '#6200EE'} />;
                break;
            default:
                return null;
        }

        return (
            <TouchableOpacity
                key={action}
                style={[styles.btn, selected && styles.btnActive]}
                onPress={() => handlePress(action)}
                activeOpacity={0.7}
            >
                {content}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.row}>
                {FORMATTING_ACTIONS.map(renderBtn)}

                {/* Separator */}
                <View style={styles.vSeparator} />

                {/* Pin */}
                {onPinPress && (
                    <TouchableOpacity
                        onPress={onPinPress}
                        style={[styles.btn, isPinned && styles.pinActive]}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                    >
                        <MaterialCommunityIcons
                            name={isPinned ? 'pin' : 'pin-outline'}
                            size={22}
                            color={isPinned ? '#FFC107' : '#666'}
                        />
                    </TouchableOpacity>
                )}

                {/* Dismiss keyboard */}
                <TouchableOpacity
                    onPress={() => {
                        Keyboard.dismiss();
                        richEditorRef?.current?.blurContentEditor?.();
                    }}
                    style={[styles.btn, styles.dismissBtn]}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                >
                    <Ionicons name="chevron-down" size={22} color="#666" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const BTN_SIZE = 40;

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
        gap: 4,
        minHeight: BTN_SIZE + 8,
    },
    btn: {
        width: BTN_SIZE,
        height: BTN_SIZE,
        borderRadius: 8,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 6,
    },
    btnActive: {
        backgroundColor: '#6200EE',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6200EE',
    },
    labelBold: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#6200EE',
    },
    labelActive: {
        color: '#FFFFFF',
    },
    vSeparator: {
        width: 1,
        height: 24,
        backgroundColor: '#E0E0E0',
        marginHorizontal: 4,
    },
    dismissBtn: {
        backgroundColor: '#FFF3E0',
    },
    pinActive: {
        backgroundColor: '#E8DEF8',
    },
});
