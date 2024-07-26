import { ZzzResponse } from "../types";
import {
  FieldCompareCondition,
  WhereClause,
  WhereConnector,
  WhereComparison,
  ZzzSelectQ,
  ZzzInsertQ,
  ZzzQ,
  formatParentheses,
  isWhereConnector,
  mapCompareOp,
  ZzzCreateTableQ,
  ZzzUpdateQ,
  ZzzTransactionQ,
} from "./zzz.model";
import mysql, { Pool, PoolOptions, QueryResult } from "mysql2/promise";

export type DbConfig = PoolOptions;

let db: Pool;

const init = (config: DbConfig) => {
  db = mysql.createPool(config);
};

const handleFieldCondition = (
  fieldCondition: FieldCompareCondition,
  values: (string | number | null | Date)[]
) => {
  if (isWhereConnector(fieldCondition)) {
    return fieldCondition;
  }
  if (Array.isArray(fieldCondition)) {
    return fieldCondition.map((condition: FieldCompareCondition) => {
      return handleFieldCondition(condition, values);
    });
  }
  return Object.entries(fieldCondition)
    .filter(([_fieldName, compareObj]) => {
      const [compareOp, compareValue] = Object.entries(compareObj)[0];
      return compareValue !== undefined;
    })
    .map(([fieldName, compareObj]) => {
      const [compareOp, compareValue] = Object.entries(compareObj)[0];
      if (Array.isArray(compareValue)) {
        values.push(...compareValue.filter((e) => e !== undefined));
        return compareValue
          .map((e) => `${fieldName} ${mapCompareOp(compareOp)} ?`)
          .join(" OR ");
      }
      values.push(compareValue);
      return `${fieldName} ${mapCompareOp(compareOp)} ?`;
    })
    .filter((condition) => condition !== undefined);
};

const handleWhereClause = (where: WhereClause) => {
  if (!Array.isArray(where)) {
    throw new Error("Not supported yet. TODO: implement a single where clause");
  }
  const values = [];
  const nestedWhere = where.map(
    (whereObj: WhereConnector | WhereComparison) => {
      if (isWhereConnector(whereObj)) {
        return whereObj;
      }
      if (!Array.isArray(whereObj)) {
        return handleFieldCondition(whereObj, values);
      }
      return whereObj.map((fieldCondition: FieldCompareCondition) => {
        return handleFieldCondition(fieldCondition, values);
      });
    }
  );

  const conditionsString = formatParentheses(nestedWhere);

  return { statement: `WHERE ${conditionsString}`, values };
};

const createSelectStatement = (q: ZzzSelectQ) => {
  const { select } = q;

  const whereClause =
    select.where === undefined ? undefined : handleWhereClause(select.where);

  if (!select.fields) {
    select.fields = "*";
  }

  const queryStringParts = [
    `SELECT`,
    Array.isArray(select.fields)
      ? (select.fields as string[]).join(", ")
      : select.fields,
    `FROM`,
    select.table,
    whereClause?.statement,
    select.forUpdate ? "for update" : undefined,
  ];

  return {
    statement: queryStringParts.filter((e) => e !== undefined).join(" "),
    values: whereClause?.values,
  };
};

const createInsertStatement = (q: ZzzInsertQ) => {
  const valuesData = q.insert.values
    ? Object.entries(q.insert.values).reduce(
        (a, [fieldName, fieldValue]) => {
          a.names.push(fieldName);
          a.values.push(fieldValue as any);
          a.placeholders.push("?");
          return a;
        },
        { names: [], placeholders: [], values: [] } as {
          names: string[];
          placeholders: "?"[];
          values: (string | number | Date | null)[];
        }
      )
    : undefined;
  const queryStrings = [
    `insert into ${q.insert.table}`,
    `(${valuesData.names.join(", ")})`,
    `values (${valuesData.placeholders.join(", ")})`,
  ];
  return { statement: queryStrings.join(" "), values: valuesData?.values };
};

const createCreateTableStatement = (q: ZzzCreateTableQ) => {
  const { table, fields } = q.createTable;
  const fieldsString = fields
    .map(
      (e) =>
        `${e.name} ${e.type}${e.params ? "(" + e.params.join(",") + ")" : ""} ${
          e.constraints
        }`
    )
    .join(", ");
  const queryStrings = [`create table ${table}`, fieldsString];
  return { statement: queryStrings.join(" "), values: [""] };
};

const createUpdateStatement = (q: ZzzUpdateQ) => {
  const setClause = Object.keys(q.update.set)
    .map((key) => `${key} = ?`)
    .join(", ");
  const whereClause = q.update.where
    ? handleWhereClause(q.update.where)
    : undefined;
  const queryStrings = [
    `update ${q.update.table}`,
    `set ${setClause}`,
    whereClause.statement,
  ];
  const values = [
    ...Object.values(q.update.set),
    ...whereClause?.values,
  ].filter((e) => e !== undefined);
  return { statement: queryStrings.join(" "), values };
};

const performTransaction = async (q: ZzzTransactionQ) => {
  try {
    await db.query(`start transaction`);
    for (const transaction of q.transaction) {
      await query(transaction);
    }
    const result = await db.query(`commit`);
    return result;
  } catch (e) {
    await db.query("rollback");
    return { error: e };
  }
};

const getQuery = (
  q: ZzzQ
): { statement: string; values?: (string | number | Date | null)[] } | null => {
  if ("transaction" in q) {
    return { statement: "-- performing transaction" };
  }

  if ("select" in q) {
    return createSelectStatement(q);
  } else if ("insert" in q) {
    return createInsertStatement(q);
  } else if ("createTable" in q) {
    return createCreateTableStatement(q);
  } else if ("update" in q) {
    return createUpdateStatement(q);
  } else {
    console.error("unsupported statement zzz.q=", q);
    return null;
  }
};

const q = async <T = QueryResult>(
  q: ZzzQ,
  validationFunction?: (o: unknown) => o is T
): Promise<ZzzResponse<T>> => {
  if (!db) {
    console.error("!zzz.init()");
    return;
  }

  try {
    const query = getQuery(q);
    console.debug("zzz.q => statement=", query);
    const response =
      "transaction" in q
        ? await performTransaction(q)
        : await db.query(query.statement, query.values);
    if ("error" in response) {
      return response;
    }
    const [result, _fields] = response;
    if (validationFunction && !validationFunction(result)) {
      return { error: { message: `invalid result`, meta: { result } } };
    }
    return result as T;
  } catch (e) {
    return { error: e };
  }
};

const query = q;

export default { init, q };
export const or = "or";
export const and = "and";
