const fs = require('fs');
const file = 'client/src/pages/modules/service-management/service-execution/ServiceExecutionForm.jsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  'import { Link, useNavigate } from "react-router-dom";',
  'import { Link, useNavigate, useSearchParams } from "react-router-dom";'
);

c = c.replace(
  'const navigate = useNavigate();',
  'const navigate = useNavigate();\n  const [searchParams] = useSearchParams();\n  const [executionId, setExecutionId] = useState(searchParams.get("id") || null);'
);

c = c.replace(
  'const [actualEndTime, setActualEndTime] = useState("");',
  'const [actualEndTime, setActualEndTime] = useState("");\n  const [actualEndDate, setActualEndDate] = useState("");'
);

c = c.replace(
  'const [assignedTechs, setAssignedTechs] = useState(new Set());\n',
  ''
);

c = c.replace(
  /function toggleTech[\s\S]*?\}\n/g,
  ''
);

c = c.replace(
  /\{\/\* --- From old Section 3 --- \*\/\}[\s\S]*?<div className="space-y-2">[\s\S]*?assignedTechs\.has[\s\S]*?<\/div>[\s\S]*?<\/div>/g,
  '{/* --- From old Section 3 --- */}'
);

const fetchEffect = `
  useEffect(() => {
    let mounted = true;
    if (executionId) {
      api.get(\`/purchase/service-executions/\${executionId}\`).then(res => {
        if (!mounted) return;
        const d = res.data;
        if (!d) return;
        setExecutionNumber(d.execution_no || "");
        if (d.order_id) {
          setSelectedOrder({
            id: d.order_id,
            orderNumber: d.order_no || "",
            customer: d.customer_name || "",
            serviceType: d.service_category || "",
            assigned_supervisor_username: d.assigned_supervisor_username || ""
          });
        }
        setExecutionDate(d.execution_date ? toYmd(d.execution_date) : "");
        setScheduledTime(d.scheduled_time || "");
        setActualEndDate(d.actual_end_date ? toYmd(d.actual_end_date) : "");
        setActualEndTime(d.actual_end_time || "");
        setAssignedSupervisor(d.assigned_supervisor_username || "");
        setRequisitionNotes(d.requisition_notes || "");
        setWorkStatus((d.work_status || "OPENED").toLowerCase());
        setWorkPerformed(d.work_performed_description || "");
        setMaterials((d.materials || []).map(m => ({
          id: crypto.randomUUID(),
          code: m.item_id,
          name: m.name,
          qty: m.qty,
          unit: m.unit,
          note: m.note
        })));
        if (d.photos_json) {
          try {
            const p = JSON.parse(d.photos_json);
            if (Array.isArray(p)) setClosingFiles(p);
          } catch(e) {}
        }
      }).catch(err => {
        console.error(err);
      });
    }
    return () => { mounted = false; };
  }, [executionId]);
`;

c = c.replace(
  /function nextStep\(n\) \{\s*setStep\(n\);\s*\}/,
  'function nextStep(n) { setStep(n); }\n' + fetchEffect
);

const oldSubmit = /async function submit\(e\) \{[\s\S]*?navigate\("\/service-management\/service-executions", \{\n\s*state: \{ success: "Service execution saved successfully" \},\n\s*\}\);\n\s*\} catch \(err\) \{\n\s*console\.error\(err\);\n\s*toast\.error\("Failed to save service execution"\);\n\s*\}\n\s*\}/;

const newSubmit = `
  async function submit(e, nextStepNum) {
    if (e) e.preventDefault();
    const orderId = selectedOrder?.id || null;
    let finalStatus = "PENDING";
    if (workStatus.toUpperCase() === "COMPLETED") finalStatus = "POSTED";
    
    const payload = {
      order_id: orderId,
      execution_no: executionNumber || "",
      execution_date: executionDate || null,
      scheduled_time: scheduledTime || null,
      actual_end_date: actualEndDate || null,
      actual_end_time: actualEndTime || null,
      assigned_supervisor_user_id: selectedOrder?.assigned_supervisor_user_id || null,
      assigned_supervisor_username: assignedSupervisor || selectedOrder?.assigned_supervisor_username || null,
      requisition_notes: requisitionNotes || null,
      work_status: workStatus.toUpperCase(),
      status: finalStatus,
      work_performed_description: workPerformed || null,
      photos: closingFiles,
      materials: materials.map((m) => ({
        code: m.code || null,
        name: m.name || "",
        unit: m.unit || "",
        qty: Number(m.qty || 0) || 0,
        note: m.note || "",
      })),
    };

    try {
      if (executionId) {
        await api.put(\`/purchase/service-executions/\${executionId}\`, payload);
      } else {
        const res = await api.post("/purchase/service-executions", payload);
        if (res.data?.id) {
          setExecutionId(res.data.id);
        }
        if (res.data?.execution_no) {
          setExecutionNumber(res.data.execution_no);
        }
      }
      
      if (nextStepNum) {
        setStep(nextStepNum);
      } else {
        navigate("/service-management/service-executions", {
          state: { success: "Service execution saved successfully" },
        });
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save service execution");
    }
  }
`;

c = c.replace(oldSubmit, newSubmit);

c = c.replace(
  'onClick={() => nextStep(2)}',
  'onClick={(e) => submit(e, 2)}'
);

c = c.replace(
  'onClick={() => nextStep(3)}',
  'onClick={(e) => submit(e, 3)}'
);

// Add actual_end_date next to actual_end_time
c = c.replace(
  '<label className="label">\n                            Actual End Time <span className="text-red-600">*</span>\n                          </label>',
  '<label className="label">\n                            Actual End Time\n                          </label>'
);

c = c.replace(
  /<div className="grid grid-cols-1 md:grid-cols-2 gap-3">\s*<div>\s*<label className="label">\n\s*Actual End Time\n\s*<\/label>\s*<input\s*className="input"\s*type="time"/g,
  '<div className="grid grid-cols-1 md:grid-cols-2 gap-3">\n<div><label className="label">Execution End Date</label><input type="date" className="input" value={actualEndDate} onChange={e => setActualEndDate(e.target.value)} /></div>\n<div><label className="label">Actual End Time</label><input className="input" type="time"'
);

c = c.replace(
  />\n\s*Next\s*<\/button>/g,
  '>Save & Next</button>'
);

c = c.replace(
  />\s*Next\s*<\/button>/g,
  '>Save & Next</button>'
);

fs.writeFileSync(file, c);
console.log('Done modifying ServiceExecutionForm');
