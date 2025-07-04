function getTypeFromDecorators(decorators) {
    if (!decorators || !Array.isArray(decorators)) {
        return null;
    }

    const regex1 = /(?:type|property)\s*\(\s*(\w+)\s*\)/;
    const regex2 = /property\s*\(\s*\{\s*type\s*:\s*(\w+)\s*\}\s*\)/;

    for (const decoratorStr of decorators) {
        let match = decoratorStr.match(regex1);
        if (match && match[1]) {
            return match[1];
        }

        match = decoratorStr.match(regex2);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

console.log(getTypeFromDecorators([ 'property({  type: Node,  tooltip: "test_node"})' ]))