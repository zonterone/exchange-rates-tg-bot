import { ResultAsync, err, ok } from "neverthrow";
import type { Result } from "neverthrow";

// a zod safeParse is already a two-channel value: this only renames the
// channels, and stays structural so it never pins us to a zod version
export const fromZod = <T>(
  parsed: { success: true; data: T } | { success: false }
): Result<T, "shape"> => (parsed.success ? ok(parsed.data) : err("shape"));

// json-db throws on every call once a load has failed, so both callers bridge
// it the same way: the cause is logged here, the last place it exists, and
// only the word travels on. `what` names the record, not the operation
export const read = <T>(what: string, promise: PromiseLike<T>) =>
  ResultAsync.fromPromise(promise, (cause) => {
    console.error(`${what} read failed`, cause);
    return "unreadable" as const;
  });

export const write = (what: string, promise: PromiseLike<void>) =>
  ResultAsync.fromPromise(promise, (cause) => {
    console.error(`${what} write failed`, cause);
    return "store" as const;
  });
