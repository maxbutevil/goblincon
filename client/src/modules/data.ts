import Val from "./validate"

export type SubmissionData = { drawing: string, name?: string };
export const SUBMISSION_DATA = { drawing: Val.STR, name: Val.orUndefined(Val.STR) };


