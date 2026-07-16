# Shared Package Tests

## Structure

- `constants.test.ts` — Tests for task statuses, priorities, project statuses, labels, colors, workflow, pagination, and permissions constants
- `exports.test.ts` — Smoke tests verifying module exports work correctly

## When adding new source files

1. Create a corresponding `.test.ts` file in this directory
2. Match the file name to the source module (e.g., `utils.test.ts` → tests for `src/utils/`)

## Testing Zod schemas

When the `src/validations/` directory has Zod schemas, create `validations.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mySchema } from '../validations';

it('should validate correct data', () => {
  const result = mySchema.parse({ ... });
  expect(result).toEqual({ ... });
});
```
