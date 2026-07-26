# `@lucid-softworks/structured-value-codec`

Lossless, JSON-compatible persistence for common structured JavaScript values.
It preserves `undefined`, bigint, dates, errors, `NaN`, infinities, and negative
zero in addition to ordinary arrays and enumerable object properties. Cycles,
functions, and symbols are rejected explicitly.

```ts
import {
  decodeStructuredValue,
  encodeStructuredValue,
} from "@lucid-softworks/structured-value-codec";

const encoded = encodeStructuredValue({
  completedAt: new Date(),
  result: undefined,
});
const decoded = decodeStructuredValue(encoded);
```

Repeated references are encoded by value rather than preserving identity.
