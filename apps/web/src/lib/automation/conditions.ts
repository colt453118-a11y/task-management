// ─── Condition Types ───────────────────────────────────────

export interface Condition {
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'is_empty' | 'is_not_empty';
  value: unknown;
}

export interface ConditionGroup {
  type: 'and' | 'or';
  conditions: Array<Condition | ConditionGroup>;
}

type ConditionInput = Array<Condition | ConditionGroup>;

// ─── Helpers ────────────────────────────────────────────────

function getFieldValue(field: string, data: Record<string, unknown>): unknown {
  // Handle dot-notation for nested fields
  if (field.includes('.')) {
    const parts = field.split('.');
    let current: unknown = data;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }
  return data[field];
}

function compareStrings(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function compareValues(
  fieldValue: unknown,
  operator: Condition['operator'],
  targetValue: unknown,
): boolean {
  switch (operator) {
    case 'eq': {
      if (fieldValue == null && targetValue == null) return true;
      if (fieldValue == null || targetValue == null) return false;
      if (typeof fieldValue === 'string' && typeof targetValue === 'string') {
        return compareStrings(fieldValue, targetValue);
      }
      return fieldValue === targetValue;
    }

    case 'neq': {
      if (fieldValue == null && targetValue == null) return false;
      if (fieldValue == null || targetValue == null) return true;
      if (typeof fieldValue === 'string' && typeof targetValue === 'string') {
        return !compareStrings(fieldValue, targetValue);
      }
      return fieldValue !== targetValue;
    }

    case 'contains': {
      if (typeof fieldValue !== 'string' || typeof targetValue !== 'string') return false;
      return fieldValue.toLowerCase().includes(targetValue.toLowerCase());
    }

    case 'gt': {
      const a = Number(fieldValue);
      const b = Number(targetValue);
      if (isNaN(a) || isNaN(b)) return false;
      return a > b;
    }

    case 'lt': {
      const a = Number(fieldValue);
      const b = Number(targetValue);
      if (isNaN(a) || isNaN(b)) return false;
      return a < b;
    }

    case 'gte': {
      const a = Number(fieldValue);
      const b = Number(targetValue);
      if (isNaN(a) || isNaN(b)) return false;
      return a >= b;
    }

    case 'lte': {
      const a = Number(fieldValue);
      const b = Number(targetValue);
      if (isNaN(a) || isNaN(b)) return false;
      return a <= b;
    }

    case 'is_empty': {
      if (fieldValue == null) return true;
      if (typeof fieldValue === 'string' && fieldValue.trim() === '') return true;
      if (Array.isArray(fieldValue) && fieldValue.length === 0) return true;
      return false;
    }

    case 'is_not_empty': {
      if (fieldValue == null) return false;
      if (typeof fieldValue === 'string' && fieldValue.trim() === '') return false;
      if (Array.isArray(fieldValue) && fieldValue.length === 0) return false;
      return true;
    }

    default:
      return false;
  }
}

// ─── Recursive Evaluation ───────────────────────────────────

function evaluateConditionOrGroup(
  input: Condition | ConditionGroup,
  data: Record<string, unknown>,
): boolean {
  if ('field' in input && 'operator' in input) {
    // It's a simple condition
    const fieldValue = getFieldValue(input.field, data);
    return compareValues(fieldValue, input.operator, input.value);
  }

  // It's a condition group
  const group = input as ConditionGroup;
  const results = group.conditions.map((c) => evaluateConditionOrGroup(c, data));

  if (group.type === 'and') {
    return results.every(Boolean);
  }

  // 'or'
  return results.some(Boolean);
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Evaluate a set of conditions against entity data.
 *
 * Top-level array is treated as AND (all must pass).
 * Use ConditionGroup with type 'or' for OR logic.
 */
export function evaluateConditions(
  conditions: ConditionInput,
  data: Record<string, unknown>,
): boolean {
  if (!conditions || conditions.length === 0) return true;

  return conditions.every((c) => evaluateConditionOrGroup(c, data));
}

/**
 * Get the human-readable label for a condition.
 */
export function getConditionLabel(condition: Condition): string {
  const fieldLabel = condition.field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase());

  const operatorLabels: Record<string, string> = {
    eq: 'is',
    neq: 'is not',
    contains: 'contains',
    gt: '>',
    lt: '<',
    gte: '>=',
    lte: '<=',
    is_empty: 'is empty',
    is_not_empty: 'is not empty',
  };

  const opLabel = operatorLabels[condition.operator] ?? condition.operator;
  const valLabel =
    condition.operator === 'is_empty' || condition.operator === 'is_not_empty'
      ? ''
      : ` ${String(condition.value)}`;

  return `${fieldLabel} ${opLabel}${valLabel}`;
}
