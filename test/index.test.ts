import { describe, expect, it } from "vitest";

import {
  decodeStructuredValue,
  encodeStructuredValue,
  StructuredValueCodecError,
} from "../src/index.js";

describe("structured value codec", () => {
  it("losslessly round-trips supported structured values", () => {
    const repeated = { value: 1 };
    const value = {
      array: [undefined, null, true, "text", repeated],
      bigint: 12n,
      date: new Date("2026-01-01T00:00:00.000Z"),
      error: new TypeError("broken", { cause: new Error("root") }),
      infinity: Number.POSITIVE_INFINITY,
      nan: Number.NaN,
      negativeInfinity: Number.NEGATIVE_INFINITY,
      negativeZero: -0,
      repeated,
    };
    const decoded = decodeStructuredValue(
      encodeStructuredValue(value),
    ) as typeof value;
    expect(decoded.array.slice(0, 4)).toEqual([undefined, null, true, "text"]);
    expect(decoded.bigint).toBe(12n);
    expect(decoded.date).toEqual(value.date);
    expect(decoded.error).toBeInstanceOf(Error);
    expect(decoded.error.name).toBe("TypeError");
    expect(decoded.error.cause).toBeInstanceOf(Error);
    expect(decoded.infinity).toBe(Number.POSITIVE_INFINITY);
    expect(decoded.nan).toBeNaN();
    expect(decoded.negativeInfinity).toBe(Number.NEGATIVE_INFINITY);
    expect(Object.is(decoded.negativeZero, -0)).toBe(true);
    expect(decoded.repeated).toEqual(repeated);
  });

  it("handles plain errors and rejects unsupported or malformed values", () => {
    const error = new Error("plain");
    delete error.stack;
    const decoded = decodeStructuredValue(
      encodeStructuredValue(error),
    ) as Error;
    expect(decoded.message).toBe("plain");
    expect(decoded.stack).toBeDefined();
    expect(() => encodeStructuredValue(() => undefined)).toThrow(
      StructuredValueCodecError,
    );
    expect(() => encodeStructuredValue(Symbol("x"))).toThrow(
      StructuredValueCodecError,
    );
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => encodeStructuredValue(cyclic)).toThrow("cyclic");
    expect(() => decodeStructuredValue("{")).toThrow("invalid");
    expect(() => decodeStructuredValue('{"type":"unknown"}')).toThrow(
      StructuredValueCodecError,
    );
  });

  it("preserves dangerous object keys as own data properties", () => {
    const value = Object.fromEntries([["__proto__", { safe: true }]]);
    const decoded = decodeStructuredValue(encodeStructuredValue(value)) as {
      __proto__: { safe: boolean };
    };
    expect(Object.hasOwn(decoded, "__proto__")).toBe(true);
    expect(decoded.__proto__).toEqual({ safe: true });
  });
});
