import { QueryResult } from "mysql2";

type TableName = string;
type FieldName = string;

export const mapCompareOp = (op: string): string => {
  switch (op) {
    case "lt":
    case "<":
      return "<";
    case "lte":
    case "<=":
      return "<=";
    case "gt":
    case ">":
      return ">";
    case "gte":
    case ">=":
      return ">=";
    case "eq":
    case "=":
      return "=";

    default:
      throw new Error("do not recognize compare op: " + op);
  }
};

type CompareOpsDateNumeric =
  | "lt"
  | "<"
  | "lte"
  | "<="
  | "gt"
  | ">"
  | "gte"
  | ">=";

type CompareOpsDateNumericString = "eq" | "=";

type CompareDateNumber = {
  [key in CompareOpsDateNumeric]?: number | Date;
};

type CompareStringNull = {
  [key in CompareOpsDateNumericString]?:
    | string
    | null
    | number
    | Date
    | (string | null | number | Date)[];
};

type OneOf<T> = {
  [K in keyof T]: {
    [P in K]: T[K];
  } & Partial<Record<Exclude<keyof T, K>, never>>;
}[keyof T];

type CompareCondition = OneOf<CompareDateNumber> | OneOf<CompareStringNull>;

type FieldComparison = {
  [key: FieldName]: CompareCondition;
};
const whereConnectors = ["AND", "and", "OR", "or"];
export type WhereConnector = "AND" | "and" | "OR" | "or";
export const isWhereConnector = (o: unknown): o is WhereConnector => {
  if (typeof o !== "string") {
    return false;
  }
  return whereConnectors.includes(o);
};
export type FieldCompareCondition =
  | {
      [key: FieldName]: CompareCondition;
    }
  | WhereConnector
  | WhereClause;
export type WhereComparison =
  | Array<FieldCompareCondition | WhereConnector>
  | FieldCompareCondition;
export type WhereClause =
  | Array<WhereComparison | WhereConnector>
  | FieldComparison;

export type LeftJoin = {
  table: TableName | string;
  on: WhereClause;
};
export type ZzzSelectQ = {
  select: {
    fields?: string | string[];
    table: TableName | string;
    where?: WhereClause;
    forUpdate?: boolean;
    leftJoin?: LeftJoin;
  };
};

type InsertValues = {
  [key: string]: string | null | number | Date;
};
export type ZzzInsertQ = {
  insert: {
    table: TableName | string;
    values?: InsertValues;
  };
};

type DataType = {
  type:
    | "integer"
    | "smallint"
    | "decimal"
    | "numeric"
    | "float"
    | "real"
    | "double_precision"
    | "char"
    | "varchar"
    | "binary"
    | "varbinary"
    | "date"
    | "datetime"
    | "time"
    | "timestamp"
    | "year";
  params?: unknown[];
};

export type ZzzCreateTableQ = {
  createTable: {
    table: TableName | string;
    fields: (DataType & { name: string; constraints?: string })[];
  };
};

export type ZzzUpdateQ = {
  update: {
    table: string;
    set: { [key: string]: string | number | null | Date };
    where?: WhereClause;
  };
};

export type ZzzTransactionQ = {
  transaction: Exclude<ZzzQ, ZzzTransactionQ>[];
};

export type ZzzQ =
  | ZzzSelectQ
  | ZzzInsertQ
  | ZzzCreateTableQ
  | ZzzUpdateQ
  | ZzzTransactionQ;

const removeUndefinedStatements = (arr: unknown[]) => {
  let flag = false;
  let checkCompleteCondition = true;
  // console.log(arr);
  arr = arr.filter(
    (e) => isWhereConnector(e) || (Array.isArray(e) && e.length > 0)
  );
  for (let i = 0; i < arr.length; i++) {
    const arrI = arr[i];
    flag = flag || Array.isArray(arrI);
    // console.log(checkCompleteCondition, flag, arrI);
    if (flag) {
      if (isWhereConnector(arrI)) {
        // console.log("..");
        flag = false;
        checkCompleteCondition = true;
      } else {
        checkCompleteCondition = false;
      }
    } else if (isWhereConnector(arrI)) {
      // console.log("set", arr[i]);
      arr[i] = undefined;
      flag = false;
      // completeCondition = true;
    }
  }
  arr = arr.filter((e) => !!e);
  if (checkCompleteCondition) {
    // console.log("!!! not complete", `"${arr.join(",")}"`);
    arr.pop();
    // console.log("-=>", arr);
  }

  return arr;
};
export const formatParentheses = (arr: unknown[]) => {
  const replacedInput = removeUndefinedStatements(arr);
  return replacedInput
    .map((item) => {
      // console.log("format", item);
      const p = Array.isArray(item) ? `(${joinWithParentheses(item)})` : item;
      return p === "()" || !p ? "" : p;
    })
    .join(" ");
};
const joinWithParentheses = (input: unknown[]): string => {
  return input
    .map((item) =>
      Array.isArray(item) ? `(${joinWithParentheses(item)})` : item
    )
    .join(" ");
};

export type TZzzResponse<T = QueryResult> =
  | T
  | {
      error: object;
    };
