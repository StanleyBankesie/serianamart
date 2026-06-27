const fs = require('fs');
let content = fs.readFileSync('client/src/pages/modules/administration/users/UserForm.jsx', 'utf8');

// 1. Add Icons and State
content = content.replace(
  'import { Eye, EyeOff } from "lucide-react";',
  'import { Eye, EyeOff, X, Building2 } from "lucide-react";'
);

content = content.replace(
  'const [showPassword, setShowPassword] = useState(false);',
  'const [showPassword, setShowPassword] = useState(false);\n  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);'
);

// 2. Replace the inline branch UI with the button + modal
const targetRegex = /\{\/\* Branches - separate section \*\/\}.*?(?=\<div className="flex justify-end gap-3 mt-6"\>)/s;

const replacement = `{/* Branches - Modal Trigger */}
            <div>
              <label className="label">Branches *</label>
              <button
                type="button"
                onClick={() => setIsBranchModalOpen(true)}
                className="w-full text-left px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex justify-between items-center"
                disabled={!form.companyId}
              >
                <span>
                  {form.branchIds.length > 0
                    ? \`\${form.branchIds.length} branch(es) selected\`
                    : form.companyId ? "Select branches..." : "Select a company first"}
                </span>
                <Building2 className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Branch Selection Modal */}
            {isBranchModalOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Assign Branches</h3>
                    <button type="button" onClick={() => setIsBranchModalOpen(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-4">
                    {(() => {
                      const superbranches = filteredBranches.filter(b => Number(b.is_superbranch) === 1);
                      const regularBranches = filteredBranches.filter(b => Number(b.is_superbranch) !== 1);

                      if (filteredBranches.length === 0) {
                        return <div className="text-center py-8 text-slate-500">No branches available for this company.</div>;
                      }

                      return (
                        <div className="space-y-6">
                          {superbranches.length > 0 && (
                            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                              <div className="bg-brand/5 dark:bg-brand/10 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
                                <span className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">Superbranches</span>
                              </div>
                              <div className="p-4 space-y-4">
                                {superbranches.map(b => {
                                  const checked = form.branchIds.includes(String(b.id));
                                  const subOptions = regularBranches;
                                  return (
                                    <div key={b.id} className="space-y-2">
                                      <label className="flex items-center gap-3 cursor-pointer p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <input
                                          type="checkbox"
                                          className="w-4 h-4 text-brand rounded focus:ring-brand"
                                          checked={checked}
                                          onChange={(e) => {
                                            const isChecked = e.target.checked;
                                            setForm((prev) => {
                                              const arr = new Set(prev.branchIds);
                                              if (isChecked) { arr.add(String(b.id)); }
                                              else {
                                                arr.delete(String(b.id));
                                                subOptions.forEach(c => arr.delete(String(c.id)));
                                              }
                                              return { ...prev, branchIds: Array.from(arr) };
                                            });
                                          }}
                                        />
                                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                          {b.name}
                                          <span className="ml-2 text-xs font-normal text-slate-500">({b.code})</span>
                                        </span>
                                      </label>
                                      {checked && subOptions.length > 0 && (
                                        <div className="ml-7 border-l-2 border-brand/20 pl-4 py-1 space-y-2">
                                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2">
                                            Select sub-branches this user can access via {b.name}:
                                          </p>
                                          {subOptions.map(child => {
                                            const childChecked = form.branchIds.includes(String(child.id));
                                            return (
                                              <label key={child.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <input
                                                  type="checkbox"
                                                  className="w-3.5 h-3.5 text-brand rounded focus:ring-brand border-slate-300"
                                                  checked={childChecked}
                                                  onChange={(e) => {
                                                    const isChecked = e.target.checked;
                                                    setForm((prev) => {
                                                      const arr = new Set(prev.branchIds);
                                                      if (isChecked) arr.add(String(child.id));
                                                      else arr.delete(String(child.id));
                                                      return { ...prev, branchIds: Array.from(arr) };
                                                    });
                                                  }}
                                                />
                                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                                  {child.name} <span className="text-xs text-slate-400">({child.code})</span>
                                                </span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {regularBranches.length > 0 && (
                            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                              <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Regular Branches</span>
                                <p className="text-xs text-slate-500 mt-0.5">User can switch between these directly from their profile</p>
                              </div>
                              <div className="p-4 space-y-2 max-h-60 overflow-auto">
                                {regularBranches.map(b => {
                                  const checked = form.branchIds.includes(String(b.id));
                                  return (
                                    <label key={b.id} className="flex items-center gap-3 cursor-pointer p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                      <input
                                        type="checkbox"
                                        className="w-4 h-4 text-brand rounded focus:ring-brand border-slate-300"
                                        checked={checked}
                                        onChange={(e) => {
                                          const isChecked = e.target.checked;
                                          setForm((prev) => {
                                            const arr = new Set(prev.branchIds);
                                            if (isChecked) arr.add(String(b.id));
                                            else arr.delete(String(b.id));
                                            return { ...prev, branchIds: Array.from(arr) };
                                          });
                                        }}
                                      />
                                      <span className="text-sm text-slate-700 dark:text-slate-300">
                                        {b.name} <span className="text-xs text-slate-400">({b.code})</span>
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-xl flex justify-end">
                    <button type="button" onClick={() => setIsBranchModalOpen(false)} className="btn btn-primary px-6">
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}

            `;

content = content.replace(targetRegex, replacement);

fs.writeFileSync('client/src/pages/modules/administration/users/UserForm.jsx', content);
console.log('UserForm updated');
