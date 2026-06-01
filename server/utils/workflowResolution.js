import { query } from "../db/pool.js";

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

function matchesAmount(workflow, amount) {
  if (amount === null || amount === undefined || amount === "") return true;
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return true;
  const minOk =
    workflow.min_amount === null ||
    workflow.min_amount === undefined ||
    numericAmount >= Number(workflow.min_amount);
  const maxOk =
    workflow.max_amount === null ||
    workflow.max_amount === undefined ||
    numericAmount <= Number(workflow.max_amount);
  return minOk && maxOk;
}

function pickMatchingWorkflow(workflows, amount, activeFlag) {
  for (const workflow of workflows || []) {
    if (activeFlag != null && Number(workflow.is_active) !== Number(activeFlag)) {
      continue;
    }
    if (matchesAmount(workflow, amount)) {
      return workflow;
    }
  }
  return null;
}

export async function resolveWorkflowSelection({
  companyId,
  workflowIdOverride = null,
  docRouteBase = null,
  typeSynonyms = [],
  amount = null,
}) {
  const normalizedTypes = uniqueStrings(typeSynonyms);
  const routeWorkflows = docRouteBase
    ? await query(
        `SELECT *
         FROM adm_workflows
         WHERE company_id = :companyId
           AND document_route = :docRouteBase
         ORDER BY id ASC`,
        { companyId, docRouteBase },
      )
    : [];

  let typeWorkflows = [];
  if (normalizedTypes.length > 0) {
    const typeClauses = normalizedTypes
      .map((_, index) => `document_type = :type${index}`)
      .join(" OR ");
    const params = { companyId };
    normalizedTypes.forEach((value, index) => {
      params[`type${index}`] = value;
    });
    typeWorkflows = await query(
      `SELECT *
       FROM adm_workflows
       WHERE company_id = :companyId
         AND (${typeClauses})
       ORDER BY id ASC`,
      params,
    );
  }

  if (workflowIdOverride) {
    const overrideRows = await query(
      `SELECT *
       FROM adm_workflows
       WHERE id = :workflowId
         AND company_id = :companyId
       LIMIT 1`,
      { workflowId: workflowIdOverride, companyId },
    );
    const overrideWorkflow = overrideRows[0] || null;
    const overrideMatches =
      overrideWorkflow &&
      ((docRouteBase &&
        String(overrideWorkflow.document_route || "") === String(docRouteBase)) ||
        normalizedTypes.includes(String(overrideWorkflow.document_type || "")));
    if (overrideMatches) {
      return {
        activeWorkflow:
          Number(overrideWorkflow.is_active) === 1 ? overrideWorkflow : null,
        inactiveWorkflow:
          Number(overrideWorkflow.is_active) === 1 ? null : overrideWorkflow,
      };
    }
  }

  const activeWorkflow =
    pickMatchingWorkflow(routeWorkflows, amount, 1) ||
    pickMatchingWorkflow(typeWorkflows, amount, 1);
  if (activeWorkflow) {
    return { activeWorkflow, inactiveWorkflow: null };
  }

  const inactiveWorkflow =
    pickMatchingWorkflow(routeWorkflows, amount, 0) ||
    pickMatchingWorkflow(typeWorkflows, amount, 0);

  return { activeWorkflow: null, inactiveWorkflow };
}

export function getInactiveWorkflowBehavior(workflow) {
  if (!workflow) return null;
  const behavior = String(workflow.default_behavior || "").trim().toUpperCase();
  return behavior || "AUTO_APPROVE";
}
