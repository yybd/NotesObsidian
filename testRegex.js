function test() {
    let oldText = "- [ ] \u200Fhello";
    let newText = "- [ ] \u200Fhello\n";

    if (newText.length > oldText.length && newText.includes('\n')) {
        const addedChar = newText.substring(oldText.length);
        console.log("addedChar:", JSON.stringify(addedChar));

        if (addedChar === '\n' || addedChar.includes('\n')) {
            const cursorPos = newText.lastIndexOf('\n', newText.length - 1);
            const lineStart = newText.lastIndexOf('\n', cursorPos - 1) + 1;
            const previousLine = newText.substring(lineStart, cursorPos);
            console.log("previousLine:", JSON.stringify(previousLine));

            const checkboxMatch = previousLine.match(/^(\s*- \[[ xX]\] )(?:\u200F)?/);
            console.log("checkboxMatch:", checkboxMatch);

            if (checkboxMatch) {
                const lineContent = previousLine.substring(checkboxMatch[0].length).trim();
                console.log("lineContent:", JSON.stringify(lineContent));
                if (!lineContent) {
                    console.log("Empty line string removed");
                    return;
                }
                const isRtl = true;
                const prefix = isRtl ? '- [ ] \u200F' : '- [ ] ';
                const modifiedText = newText.substring(0, cursorPos + 1) + prefix + newText.substring(cursorPos + 1);
                console.log("modifiedText:", JSON.stringify(modifiedText));
            }
        }
    }
}
test();
