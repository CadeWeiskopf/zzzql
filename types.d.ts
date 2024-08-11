import { Pool } from "mysql2/promise";
import { DbConfig } from "./src/zzz";
import { ZzzQ, TZzzResponse } from "./src/zzz.model";

export interface Zzz {
  init: (config: DbConfig) => void;
  q: <T>(q: ZzzQ) => Promise<ZzzResponse<T>>;
  pool: () => Pool | undefined;
}
declare const zzz: Zzz;
export default zzz;

export const and = "and";
export const or = "or";
export type ZzzResponse<T> = TZzzResponse<T>;
