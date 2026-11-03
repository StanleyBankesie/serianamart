/**
 * @file payrollSalaryComponents.js
 * @description Utility functions for evaluating and calculating recurring employee salary components.
 */

/**
 * Calculates the amounts for a list of employee salary components.
 * Supports AMOUNT (fixed) and PERCENT (percentage of basic salary or a parent component).
 *
 * @param {Array<Object>} components - Array of employee salary components.
 * @param {number} basicSalary - The employee's basic salary.
 * @returns {Map<number, number>} Map of component id -> calculated amount.
 */
export function calculateEmployeeSalaryComponents(components = [], basicSalary = 0) {
  const result = new Map();
  if (!Array.isArray(components) || components.length === 0) {
    return result;
  }

  const byId = new Map();
  for (const comp of components) {
    if (comp && comp.id != null) {
      byId.set(Number(comp.id), comp);
    }
  }

  const base = Number(basicSalary || 0);
  const visiting = new Set();

  function compute(compId) {
    if (result.has(compId)) {
      return result.get(compId);
    }

    const comp = byId.get(compId);
    if (!comp) {
      throw new Error(`Basis component not found: ${compId}`);
    }

    if (visiting.has(compId)) {
      throw new Error(
        `Circular reference detected in salary component "${comp.component_name || compId}"`
      );
    }

    visiting.add(compId);

    const calcType = String(comp.calculation_type || "AMOUNT").toUpperCase();
    const val = Number(comp.value || 0);
    let amount = 0;

    if (calcType === "PERCENT") {
      const basisId =
        comp.basis_component_id != null && Number(comp.basis_component_id) > 0
          ? Number(comp.basis_component_id)
          : null;

      let basisVal = base;
      if (basisId) {
        if (!byId.has(basisId)) {
          throw new Error(
            `Percentage basis for ${comp.component_name || compId} is unavailable`
          );
        }
        basisVal = compute(basisId);
      }
      amount = (basisVal * val) / 100;
    } else {
      amount = val;
    }

    // Standard financial rounding to 2 decimal places
    amount = Math.round((amount + Number.EPSILON) * 100) / 100;

    visiting.delete(compId);
    result.set(compId, amount);
    return amount;
  }

  for (const comp of components) {
    if (comp && comp.id != null) {
      compute(Number(comp.id));
    }
  }

  return result;
}

export default {
  calculateEmployeeSalaryComponents,
};
