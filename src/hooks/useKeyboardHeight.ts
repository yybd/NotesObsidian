import { useState, useEffect } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardHeight() {
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        let lastKeyboardHeight = 0;

        const showListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => {
                const newHeight = e.endCoordinates.height;
                setKeyboardVisible(true);
                // Only update height if changed significantly (>10px) to avoid iOS QuickType jitter
                if (Math.abs(newHeight - lastKeyboardHeight) > 10) {
                    lastKeyboardHeight = newHeight;
                    setKeyboardHeight(newHeight);
                }
            }
        );

        const hideListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                lastKeyboardHeight = 0;
                setKeyboardVisible(false);
                setKeyboardHeight(0);
            }
        );

        return () => {
            showListener.remove();
            hideListener.remove();
        };
    }, []);

    return { keyboardVisible, keyboardHeight };
}
