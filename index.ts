import {map} from "@softwareventures/array";
import type {ReadonlyTable} from "@softwareventures/table";
import regexEscape = require("escape-string-regexp");

type ParseState = "none" | "after-comma" | "in-linebreak" | "in-quote" | "after-quote";

interface ParseData {
    readonly state: ParseState;
    readonly result: ReadonlyTable;
    readonly record: readonly string[];
    readonly field: string;
}

function changeState(parseData: ParseData, state: ParseState): ParseData {
    return {
        state,
        result: parseData.result,
        record: parseData.record,
        field: parseData.field
    };
}

function appendText(parseData: ParseData, text: string): ParseData {
    return {
        state: parseData.state,
        result: parseData.result,
        record: parseData.record,
        field: parseData.field + text
    };
}

function endField(parseData: ParseData): ParseData {
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

export const csv: Configuration = {
    separator: defaultSeparator,
    quote: defaultQuote
};

export const tsv: Configuration = {
    separator: "\t",
    quote: defaultQuote
};

const initial: ParseData = {
    state: "none",
    result: [],
    record: [],
    field: ""
};

export function parse(data: string, configuration?: Configuration): ReadonlyTable {
    const separator = configuration?.separator ?? defaultSeparator;
    const quote = configuration?.quote ?? defaultQuote;

    const resultState = String(data)
        .split("")
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

export function write(table: ReadonlyTable, configuration?: Configuration): string {
    const separator = configuration?.separator ?? defaultSeparator;
    const quote = configuration?.quote ?? defaultQuote;

    const quoteRegex = new RegExp(regexEscape(quote), "gu");

    return map(table, row =>
        map(row, field => quote + field.replace(quoteRegex, quote + quote) + quote).join(separator)
    ).join("\r\n");
}
