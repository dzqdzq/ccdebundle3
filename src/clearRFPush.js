function clearRFPush(code) {
    const uuidMatch = code.match(/\w+\._RF\.push\(.*?\s*,\s*["']([^"']+)["'],\s*(.*?)\);/s);
    if(!uuidMatch){
        throw new Error('No UUID found');
    }
    const shortUUID = uuidMatch[1];

    // 删除 _RF.push 语句
    const cleanedCode = code.replace(uuidMatch[0], '');
    const cleanedCode2 = cleanedCode.replace(/\w+\._RF\.pop\(.*?\);/g, '');
    return {
        shortUUID,
        code:cleanedCode2
    };
}

module.exports = { clearRFPush };