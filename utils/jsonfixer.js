export class JsonFixer {
    constructor() {
        this.buffer = ''; // Buffer to accumulate JSON chunks
    }

    // Apply custom fixes to the JSON data
    fixMalformedJson(data) {
        let fixedData = data;

        // Step 1: Fix bad control characters
        fixedData = this.fixControlCharacters(fixedData);

        // Step 2: Fix unterminated strings
        fixedData = this.fixUnterminatedStrings(fixedData);

        // Step 3: Fix missing commas between key-value pairs or array elements
        fixedData = this.fixMissingCommas(fixedData);

        // Step 4: Fix unexpected tokens (e.g., when a value is not properly enclosed in quotes)
        fixedData = this.fixUnexpectedTokens(fixedData);

        // Step 5: Fix specific case with VaCode
        fixedData = this.fixVaCodeCase(fixedData);

        // Step 6: Fix trailing commas before closing brackets (arrays or objects)
        fixedData = fixedData.replace(/,\s*([}\]])/g, '$1');

        // Ensure there is a comma between array items that are objects
        fixedData = fixedData.replace(/([}\]])\s*([{[])/g, '$1,$2');

        return fixedData;
    }

    // Helper function to fix bad control characters in JSON strings
    fixControlCharacters(data) {
        return data.replace(/[\x00-\x1F\x7F-\x9F]/g, ''); // Removes control characters
    }

    // Helper function to fix unterminated strings
    fixUnterminatedStrings(data) {
        return data.replace(/"([^"]*?)(?=$|[,}\]])/g, '"$1"'); // Finds unterminated strings and closes them
    }

    // Helper function to fix missing commas
    fixMissingCommas(data) {
        return data.replace(/([}\]0-9"])\s*([{\["])/g, '$1,$2');
    }

    // Helper function to fix unexpected tokens
    fixUnexpectedTokens(data) {
        // Fix values missing quotes
        let fixedData = data.replace(/:\s*([^",}\]]+)(?=\s*[},\]])/g, ': "$1"');
        
        // Fix keys missing quotes (including the case with "VaCode")
        fixedData = fixedData.replace(/([{,]\s*)([A-Za-z0-9_]+)(\s*:)/g, '$1"$2"$3');
        
        return fixedData;
    }

    // New helper function to fix the specific VaCode case
    fixVaCodeCase(data) {
        return data.replace(/"([^"]*)",\s*"VaCode":\s*""/g, (match, p1) => {
            // If p1 ends with 'A', we assume it's the problematic case
            if (p1.endsWith('A')) {
                return `"${p1}","VaCode":""`;
            }
            return match; // If it doesn't end with 'A', return the original match
        });
    }

    // Function to handle large JSON data in chunks
    processJson(jsonData) {
        this.buffer += jsonData; // Append incoming data to the buffer

        // Attempt to fix the malformed JSON
        const repairedJson = this.fixMalformedJson(this.buffer);

        try {
            // Parse the repaired JSON
            const parsedData = JSON.parse(repairedJson);
            this.buffer = ''; // Clear the buffer if parsing succeeds
            return parsedData; // Return the parsed data if valid
        } catch (error) {
            console.error('Error parsing JSON:', error.message);
            return null; // Return null if parsing fails
        }
    }
}