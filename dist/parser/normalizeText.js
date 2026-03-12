export function normalizeLine(text) {
    return text
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
export function normalizeLines(lines) {
    return lines
        .map((line) => normalizeLine(line.text))
        .filter((line) => line.length > 0);
}
export function normalizeText(text) {
    return text
        .replace(/\r/g, "")
        .split("\n")
        .map((line) => normalizeLine(line))
        .filter((line) => line.length > 0)
        .join("\n");
}
