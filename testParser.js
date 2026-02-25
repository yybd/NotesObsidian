const { parseExpensiMark } = require('@expensify/react-native-live-markdown');

function test() {
    const input = "\u200F- hello";
    try {
        const ranges = parseExpensiMark(input);
        console.log("ExpensiMark Ranges:", ranges);
    } catch (e) {
        console.log("Error running parseExpensiMark natively without RN env:", e.message);
    }
}
test();
