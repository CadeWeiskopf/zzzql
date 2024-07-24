import { QueryResult } from "mysql2";
import { DbConfig } from "./src/zzz";
import { ZzzQ } from "./src/zzz.model";

export interface Zzz {
  init: (config: DbConfig) => void;
  q: (q: ZzzQ) => Promise<QueryResult>;
}
declare const zzz: Zzz;
export default zzz;

export const and = "and";
export const or = "or";
