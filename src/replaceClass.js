
function replaceClass(code, regex, transformer) {
    const match = code.match(regex);

    if (match) {
        const iifeContent = match[0]; 
        const {newBody, newName} = transformer(match);
        
        const placeholder = `__TRANSFORM_PLACEHOLDER_${Date.now()}__`;

        let newCode = code.replace(iifeContent, placeholder);

        const lines = newCode.split('\n');
        const placeholderLineIndex = lines.findIndex(line => line.includes(placeholder));

        if (placeholderLineIndex !== -1) {
            lines.splice(placeholderLineIndex, 0, newBody);
            
            lines[placeholderLineIndex + 1] = lines[placeholderLineIndex + 1].replace(placeholder, newName);
            
            newCode = lines.join('\n');
        }

        return newCode;
    }

    return code;
}

module.exports = {
    replaceClass
};