type ParseState = "None" | "AfterComma" | "InLineBreak" | "InQuote" | "AfterQuote";

interface ParseData {
    readonly state: ParseState;
    readonly result: ReadonlyArray<ReadonlyArray<string>>;
    readonly record: ReadonlyArray<string>;
    readonly field: string;
}

function changeState(parseData: ParseData, state: ParseState): Readonly<ParseData> {
    return {
        state,
        result: parseData.result,
        record: parseData.record,
        field: parseData.field
    };
}

function appendText(parseData: ParseData, text: string): Readonly<ParseData> {
    return {
        state: parseData.state,
        result: parseData.result,
        record: parseData.record,
        field: parseData.field + text
    };
}

function endField(parseData: ParseData): Readonly<ParseData> {
    return {
        state: parseData.state,
        result: parseData.result,
        record: parseData.record.concat([parseData.field]),
        field: ""
    };
}

function endRecord(parseData: ParseData): ParseData {
    return {
        state: parseData.state,
        result: parseData.result.concat([parseData.record.concat([parseData.field])]),
        record: [],
        field: ""
    };
}

function endData(parseData: ParseData): ParseData {
    if (parseData.record.length === 0 && parseData.field.length === 0) {
        return parseData;
    } else {
        return endRecord(parseData);
    }
}

export interface Configuration {
    readonly separator?: string;
    readonly quote?: string;
}

const defaultSeparator = ",";
const defaultQuote = '"';

const initial: ParseData = {
    state: "None",
    result: [],
    record: [],
    field: ""
};

export function parse(data: string, configuration?: Configuration): ReadonlyArray<ReadonlyArray<string>> {
    const separator = configuration && configuration.separator || defaultSeparator;
    const quote = configuration && configuration.quote || defaultQuote;

    const resultState = data.split("")
        .reduce((data: ParseData, char: string) => {
            if (data.state === "AfterComma" && char === " ") {
                return data;
            } else if (data.state === "InLineBreak" && char === "\n") {
                return changeState(data, "None");
            } else if (data.state === "AfterQuote" && char === quote) {
                return changeState(appendText(data, quote), "InQuote");
            } else if (data.state === "InQuote") {
                if (char === quote) {
                    return changeState(data, "AfterQuote");
                } else {
                    return appendText(data, char);
                }
            } else if (char === separator) {
                return changeState(endField(data), "AfterComma");
            } else if (char === "\r") {
                return changeState(endRecord(data), "InLineBreak");
            } else if (char === "\n") {
                return changeState(endRecord(data), "None");
            } else if (char === quote) {
                return changeState(data, "InQuote");
            } else {
                return changeState(appendText(data, char), "None");
            }
        }, initial);

    return endData(resultState).result;
}

function regexEscape(text: string): string {
    return text.replace(/[\\^$*+?.()|{}\[\]]/g, c => "\\" + c);
}

export function write(table: ReadonlyArray<ReadonlyArray<string>>, configuration?: Configuration): string {
    const separator = configuration && configuration.separator || defaultSeparator;
    const quote = configuration && configuration.quote || defaultQuote;

    const quoteRegex = new RegExp(regexEscape(quote), "g");

    return table
        .map(row => row
            .map(field => quote + field.replace(quoteRegex, quote + quote) + quote)
            .join(separator))
        .join("\r\n");
}