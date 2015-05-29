﻿var parser = require('../jsoql-parser').parser;

export function Parse(source: string): Statement {
    return parser.parse(source);
}

export interface Selectable {
    Expression: any;
    Alias: string;
}

export interface FromClauseNode {
    Target?: any;
    Left?: FromClauseNode;
    Right?: FromClauseNode;
    Expression: any;
    Over?: FromClauseNode;
    Alias?: string;
    KeyValues?: {
        Key: string;
        Value: any;
    }[];
    Quoted: string;
}

export interface GroupByClause {
    Groupings: any[];
    Having: any
}
export interface Statement {
    Select: {
        SelectList: Selectable[];
        Limit: number;
    }
    FromWhere: {
        From: FromClauseNode;
        Where: any;
    }
    GroupBy: GroupByClause;
    OrderBy: {
        Expression: any;
        Asc: boolean
    }[]
}