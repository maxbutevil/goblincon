
import Val from "./validate"
export type Submission = { drawing: string, name?: string };
export const SUBMISSION = { drawing: Val.STR, name: Val.optional(Val.STR) };
