/**
 * The last unit chosen of each kind, wherever it was chosen (the header picker on any tab, or an overview).
 * Opening Ship Overview or Shore Overview returns to it instead of the first unit in the list.
 */
export const lastUnit: Partial<Record<'ship' | 'installation', string>> = {};
