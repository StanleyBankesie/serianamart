const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'client/src/pages/modules/service-management/service-execution/ServiceExecutionForm.jsx');
let c = fs.readFileSync(file, 'utf8');

// Replace Section 1 buttons
c = c.replace(
  /<div className="flex gap-2">\s*<button\s*type="button"\s*className="btn-primary"\s*onClick=\{\(e\) => submit\(e, 2\)\}\s*>\s*Next: Material Requisition &rarr;\s*<\/button>\s*<\/div>/g,
  `<div className="flex gap-2 justify-end">
  <button type="button" className="btn-primary" onClick={(e) => submit(e)}>
    Save & Exit
  </button>
  <button type="button" className="btn-success" onClick={(e) => submit(e, 2)}>
    Next: Material Requisition &rarr;
  </button>
</div>`
);

// Replace Section 2 buttons
c = c.replace(
  /<div className="flex gap-2">\s*<button\s*type="button"\s*className="btn-secondary"\s*onClick=\{([^}]+)\}\s*>\s*&larr; Back\s*<\/button>\s*<button\s*type="button"\s*className="btn-primary"\s*onClick=\{\(e\) => submit\(e, 3\)\}\s*>\s*Next: Execution & Closing &rarr;\s*<\/button>\s*<\/div>/g,
  `<div className="flex gap-2 justify-end">
  <button type="button" className="btn-secondary mr-auto" onClick={$1}>
    &larr; Back
  </button>
  <button type="button" className="btn-primary" onClick={(e) => submit(e)}>
    Save & Exit
  </button>
  <button type="button" className="btn-success" onClick={(e) => submit(e, 3)}>
    Next: Execution & Closing &rarr;
  </button>
</div>`
);

// Replace Section 3 buttons
c = c.replace(
  /<div className="flex gap-2 pt-4">\s*<button\s*type="button"\s*className="btn-secondary"\s*onClick=\{([^}]+)\}\s*>\s*&larr; Back\s*<\/button>\s*<button\s*type="submit"\s*className="btn-success"\s*disabled=\{!confirmClosure\}\s*>\s*Complete Service Execution\s*<\/button>\s*<\/div>/g,
  `<div className="flex gap-2 pt-4 justify-end">
  <button type="button" className="btn-secondary mr-auto" onClick={$1}>
    &larr; Back
  </button>
  <button type="button" className="btn-primary" onClick={(e) => submit(e)}>
    Save & Exit
  </button>
  <button type="submit" className="btn-success" disabled={!confirmClosure} onClick={(e) => submit(e)}>
    Complete Service Execution
  </button>
</div>`
);

fs.writeFileSync(file, c);
console.log("Replaced buttons!");
