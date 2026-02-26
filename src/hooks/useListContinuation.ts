import { useCallback, useRef } from 'react';
import { handleListContinuation } from '../utils/markdownUtils';

interface EditorRef {
    setText?: (text: string) => void;
    setTextAndSelection?: (text: string, sel: { start: number; end: number }) => void;
}

export function useListContinuation(editorRef?: React.RefObject<EditorRef | null>) {
    const lastTextRef = useRef('');

    const handleChange = useCallback((
        newText: string,
        onTextChange: (text: string) => void,
        onSelectionChange?: (sel: { start: number; end: number }) => void,
    ) => {
        const result = handleListContinuation(newText, lastTextRef.current);

        if (result) {
            lastTextRef.current = result.modifiedText;
            if (result.cursorShouldMove) {
                const newSel = { start: result.newCursorPos, end: result.newCursorPos };
                onSelectionChange?.(newSel);
                editorRef?.current?.setTextAndSelection?.(result.modifiedText, newSel);
            } else {
                editorRef?.current?.setText?.(result.modifiedText);
            }
            onTextChange(result.modifiedText);
        } else {
            lastTextRef.current = newText;
            onTextChange(newText);
        }
    }, [editorRef]);

    const reset = useCallback((text: string) => {
        lastTextRef.current = text;
    }, []);

    return { handleChange, reset };
}
