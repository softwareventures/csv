import {ReadonlyTable} from "@softwareventures/table";

type ParseState = "none" | "after-comma" | "in-linebreak" | "in-quote" | "after-quote";

interface ParseData {
    readonly state: ParseState;
    readonly result: ReadonlyTable;
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
    state: "none",
    result: [],
    record: [],
    field: ""
};

export function parse(data: string, configuration?: Configuration): ReadonlyTable {
    const separator = configuration && configuration.separator || defaultSeparator;
    const quote = configuration && configuration.quote || defaultQuote;

    const resultState = data.split("")
        .reduce((data: ParseData, char: string) => {
            if (data.state === "after-comma" && char === " ") {
                return data;
            } else if (data.state === "in-linebreak" && char === "\n") {
                return changeState(data, "none");
            } else if (data.state === "after-quote" && char === quote) {
                return changeState(appendText(data, quote), "in-quote");
            } else if (data.state === "in-quote") {
                if (char === quote) {
                    return changeState(data, "after-quote");
                } else {
                    return appendText(data, char);
                }
            } else if (char === separator) {
                return changeState(endField(data), "after-comma");
            } else if (char === "\r") {
                return changeState(endRecord(data), "in-linebreak");
            } else if (char === "\n") {
                return changeState(endRecord(data), "none");
            } else if (char === quote) {
                return changeState(data, "in-quote");
            } else {
                return changeState(appendText(data, char), "none");
            }
        }, initial);

    return endData(resultState).result;
}

function regexEscape(text: string): string {
    return text.replace(/[\\^$*+?.()|{}\[\]]/g, c => "\\" + c);
}

export function write(table: ReadonlyTable, configuration?: Configuration): string {
    const separator = configuration && configuration.separator || defaultSeparator;
    const quote = configuration && configuration.quote || defaultQuote;

    const quoteRegex = new RegExp(regexEscape(quote), "g");

    return table
        .map(row => row
            .map(field => quote + field.replace(quoteRegex, quote + quote) + quote)
            .join(separator))
        .join("\r\n");
}