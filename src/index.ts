type EncodedValue =
  | { readonly type: "undefined" | "null" }
  | { readonly type: "boolean" | "string"; readonly value: boolean | string }
  | { readonly type: "number" | "bigint"; readonly value: string }
  | { readonly type: "array"; readonly value: readonly EncodedValue[] }
  | {
      readonly type: "object";
      readonly value: readonly (readonly [string, EncodedValue])[];
    }
  | {
      readonly type: "error";
      readonly name: string;
      readonly message: string;
      readonly stack?: string;
      readonly cause?: EncodedValue;
    }
  | { readonly type: "date"; readonly value: string };

export class StructuredValueCodecError extends Error {
  override readonly name = "StructuredValueCodecError";
}

function encode(value: unknown, ancestors: Set<object>): EncodedValue {
  if (value === undefined) return { type: "undefined" };
  if (value === null) return { type: "null" };
  if (typeof value === "boolean") return { type: "boolean", value };
  if (typeof value === "string") return { type: "string", value };
  if (typeof value === "number")
    return {
      type: "number",
      value: Object.is(value, -0) ? "-0" : String(value),
    };
  if (typeof value === "bigint")
    return { type: "bigint", value: String(value) };
  if (typeof value !== "object")
    throw new StructuredValueCodecError(`Cannot encode ${typeof value} value`);
  if (ancestors.has(value))
    throw new StructuredValueCodecError("Cannot encode a cyclic value");
  ancestors.add(value);
  try {
    if (value instanceof Date)
      return { type: "date", value: value.toISOString() };
    if (value instanceof Error) {
      const cause =
        "cause" in value ? encode(value.cause, ancestors) : undefined;
      return {
        message: value.message,
        name: value.name,
        type: "error",
        ...(value.stack === undefined ? {} : { stack: value.stack }),
        ...(cause === undefined ? {} : { cause }),
      };
    }
    if (Array.isArray(value))
      return {
        type: "array",
        value: value.map((item) => encode(item, ancestors)),
      };
    return {
      type: "object",
      value: Object.entries(value).map(([key, item]) => [
        key,
        encode(item, ancestors),
      ]),
    };
  } finally {
    ancestors.delete(value);
  }
}

function decode(value: EncodedValue): unknown {
  switch (value.type) {
    case "undefined": {
      return undefined;
    }
    case "null": {
      return null;
    }
    case "boolean":
    case "string": {
      return value.value;
    }
    case "number": {
      return value.value === "-0" ? -0 : Number(value.value);
    }
    case "bigint": {
      return BigInt(value.value);
    }
    case "date": {
      return new Date(value.value);
    }
    case "array": {
      return value.value.map((item) => decode(item));
    }
    case "object": {
      return Object.fromEntries(
        value.value.map(([key, item]) => [key, decode(item)]),
      );
    }
    case "error": {
      const error = new Error(
        value.message,
        value.cause === undefined ? {} : { cause: decode(value.cause) },
      );
      if (value.name !== "Error") error.name = value.name;
      if (value.stack !== undefined) error.stack = value.stack;
      return error;
    }
  }
  throw new StructuredValueCodecError("Stored value has an unknown type");
}

export function encodeStructuredValue(value: unknown): string {
  return JSON.stringify(encode(value, new Set()));
}

export function decodeStructuredValue(source: string): unknown {
  try {
    return decode(JSON.parse(source) as EncodedValue);
  } catch (cause) {
    if (cause instanceof StructuredValueCodecError) throw cause;
    throw new StructuredValueCodecError("Stored value is invalid", { cause });
  }
}
