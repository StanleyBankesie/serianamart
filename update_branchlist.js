const fs = require('fs');
let content = fs.readFileSync('client/src/pages/modules/administration/branches/BranchList.jsx', 'utf8');

content = content.replace(
  '    isActive: true,\n    address: "",',
  '    isActive: true,\n    is_superbranch: false,\n    address: "",'
);

content = content.replace(
  '        isActive: branch.is_active,\n        address: branch.address || "",',
  '        isActive: branch.is_active,\n        is_superbranch: Boolean(Number(branch.is_superbranch)),\n        address: branch.address || "",'
);

content = content.replace(
  '          is_active: formData.isActive,\n          address: formData.address || null,',
  '          is_active: formData.isActive ? 1 : 0,\n          is_superbranch: formData.is_superbranch ? 1 : 0,\n          address: formData.address || null,'
);
content = content.replace(
  '          is_active: formData.isActive,\n          address: formData.address || null,',
  '          is_active: formData.isActive ? 1 : 0,\n          is_superbranch: formData.is_superbranch ? 1 : 0,\n          address: formData.address || null,'
);

const jsxTarget = '                  </select>\n                </div>';
const jsxReplacement = `                  </select>
                </div>

                <div className="mb-4 flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.is_superbranch}
                    onClick={(e) => { e.preventDefault(); setFormData({ ...formData, is_superbranch: !formData.is_superbranch }); }}
                    className={\`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 \${
                      formData.is_superbranch ? "bg-brand" : "bg-slate-300"
                    }\`}
                  >
                    <span
                      className={\`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform \${
                        formData.is_superbranch ? "translate-x-6" : "translate-x-1"
                      }\`}
                    />
                  </button>
                  <div>
                    <label className="text-sm font-semibold text-slate-800 cursor-pointer" onClick={(e) => { e.preventDefault(); setFormData({ ...formData, is_superbranch: !formData.is_superbranch }); }}>
                      Superbranch
                    </label>
                    <p className="text-xs text-slate-500">
                      Users assigned here can also be given access to child branches.
                    </p>
                  </div>
                </div>`;

content = content.replace(jsxTarget, jsxReplacement);

fs.writeFileSync('client/src/pages/modules/administration/branches/BranchList.jsx', content);
console.log('Update completed successfully.');
