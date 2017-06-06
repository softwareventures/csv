type ParseState = "None" | "AfterComma" | "InLineBreak" | "InQuote" | "AfterQuote";

interface ParseData {
    readonly state: ParseState,
    readonly result: ReadonlyArray<ReadonlyArray<string>>;
    readonly record: ReadonlyArray<string>;
    readonly field: string;
}

function changeState(parseData: ParseData, state: ParseState): Readonly<ParseData> {
    return Object.freeze({
        state: state,
        result: parseData.result,
        record: parseData.record,
        field: parseData.field
    });
}

function appendText(parseData: ParseData, text: string): Readonly<ParseData> {
    return Object.freeze({
        state: parseData.state,
        result: parseData.result,
        record: parseData.record,
        field: parseData.field + text
    });
}

function endField(parseData: ParseData): Readonly<ParseData> {
    return Object.freeze({
        state: parseData.state,
        result: parseData.result,
        record: Object.freeze(parseData.record.concat([parseData.field])),
        field: ""
    });
}

function endRecord(parseData: ParseData): ParseData {
    return Object.freeze({
        state: parseData.state,
        result: Object.freeze(parseData.result.concat([parseData.record.concat([parseData.field])])),
        record: [],
        field: ""
    });
}

function endData(parseData: ParseData): ParseData {
    if (parseData.record.length === 0 && parseData.field.length === 0) {
        return parseData;
    } else {
        return endRecord(parseData);
    }
}

const initial = Object.freeze<ParseData>({
    state: "None",
    result: [],
    record: [],
    field: ""
});

export function parse(data: string): ReadonlyArray<ReadonlyArray<string>> {
    let resultState = data.split('')
            .reduce((data: ParseData, char: string) => {
                if (data.state === "AfterComma" && char === " ") {
                    return data;
                } else if (data.state === "InLineBreak" && char === "\n") {
                    return changeState(data, "None");
                } else if (data.state === "AfterQuote" && char === '"') {
                    return changeState(appendText(data, '"'), "InQuote");
                } else if (data.state === "InQuote") {
                    if (char === '"') {
                        return changeState(data, "AfterQuote");
                    } else {
                        return appendText(data, char);
                    }
                } else if (char === ",") {
                    return changeState(endField(data), "AfterComma");
                } else if (char === "\r") {
                    return changeState(endRecord(data), "InLineBreak");
                } else if (char === "\n") {
                    return changeState(endRecord(data), "None");
                } else if (char === '"') {
                    return changeState(data, "InQuote");
                } else {
                    return changeState(appendText(data, char), "None");
                }
            }, initial);

    return endData(resultState).result;
}

export function write(table: string[][]): string {
    return table
            .map(row => row
                    .map(field => '"' + field.replace(/"/g, '""') + '"')
                    .join(","))
            .join("\r\n");
}