export function validateRequisition(body) {
  const errors = [];
  if (!String(body.title || "").trim()) errors.push("title");
  if (!Number(body.vacancies || 0)) errors.push("vacancies");
  if (!Number(body.dept_id || 0)) errors.push("dept_id");
  if (!Number(body.pos_id || 0)) errors.push("pos_id");
  return errors;
}

export function validateCandidate(body) {
  const errors = [];
  if (!String(body.first_name || "").trim()) errors.push("first_name");
  if (!String(body.last_name || "").trim()) errors.push("last_name");
  if (!String(body.email || "").trim()) errors.push("email");
  return errors;
}

export function validateLeaveRequest(body) {
  const errors = [];
  if (!Number(body.employee_id || 0)) errors.push("employee_id");
  if (!Number(body.leave_type_id || 0)) errors.push("leave_type_id");
  if (!String(body.start_date || "").trim()) errors.push("start_date");
  if (!String(body.end_date || "").trim()) errors.push("end_date");
  return errors;
}
