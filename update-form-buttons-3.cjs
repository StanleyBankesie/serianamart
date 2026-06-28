const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'client/src/pages/modules/service-management/service-execution/ServiceExecutionForm.jsx');
let c = fs.readFileSync(file, 'utf8');

// Section 1
c = c.replace(
  /<div className="flex gap-2 justify-end">\s*<button\s*type="button"\s*className="btn-secondary mr-auto opacity-0 pointer-events-none"\s*>\s*Back\s*<\/button>\s*<button\s*type="button"\s*className="btn-primary"\s*onClick=\{\(e\) => submit\(e\)\}\s*>\s*Save & Exit\s*<\/button>\s*<button\s*type="button"\s*className="btn-success"\s*onClick=\{\(e\) => submit\(e, 2\)\}\s*>\s*Next: Material Requisition &rarr;\s*<\/button>\s*<\/div>/,
  `<div className="flex justify-between w-full pt-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn-secondary opacity-0 pointer-events-none"
                            >
                              Back
                            </button>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={(e) => submit(e)}
                            >
                              Save & Exit
                            </button>
                          </div>
                          <button
                            type="button"
                            className="btn-success"
                            onClick={(e) => submit(e, 2)}
                          >
                            Next: Material Requisition &rarr;
                          </button>
                        </div>`
);

// Section 2
c = c.replace(
  /<div className="flex gap-2 justify-end">\s*<button\s*type="button"\s*className="btn-secondary mr-auto"\s*onClick=\{\(\) => previousStep\(1\)\}\s*>\s*&larr; Back\s*<\/button>\s*<button\s*type="button"\s*className="btn-primary"\s*onClick=\{\(e\) => submit\(e\)\}\s*>\s*Save & Exit\s*<\/button>\s*<button\s*type="button"\s*className="btn-success"\s*onClick=\{\(e\) => submit\(e, 3\)\}\s*>\s*Next: Execution & Closing &rarr;\s*<\/button>\s*<\/div>/,
  `<div className="flex justify-between w-full pt-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => previousStep(1)}
                            >
                              &larr; Back
                            </button>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={(e) => submit(e)}
                            >
                              Save & Exit
                            </button>
                          </div>
                          <button
                            type="button"
                            className="btn-success"
                            onClick={(e) => submit(e, 3)}
                          >
                            Next: Execution & Closing &rarr;
                          </button>
                        </div>`
);

// Section 3
c = c.replace(
  /<div className="flex gap-2 pt-4 justify-end">\s*<button\s*type="button"\s*className="btn-secondary mr-auto"\s*onClick=\{\(\) => previousStep\(2\)\}\s*>\s*&larr; Back\s*<\/button>\s*<button\s*type="button"\s*className="btn-primary"\s*onClick=\{\(e\) => submit\(e\)\}\s*>\s*Save & Exit\s*<\/button>\s*<button\s*type="button"\s*className="btn-success"\s*onClick=\{\(e\) => submit\(e\)\}\s*disabled=\{!confirmClosure\}\s*>\s*Complete Service Execution\s*<\/button>\s*<\/div>/,
  `<div className="flex justify-between w-full pt-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => previousStep(2)}
                            >
                              &larr; Back
                            </button>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={(e) => submit(e)}
                            >
                              Save & Exit
                            </button>
                          </div>
                          <button
                            type="button"
                            className="btn-success"
                            onClick={(e) => submit(e)}
                            disabled={!confirmClosure}
                          >
                            Complete Service Execution
                          </button>
                        </div>`
);

fs.writeFileSync(file, c);
console.log("Updated button layout!");
