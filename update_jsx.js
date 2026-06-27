const fs = require('fs');
let content = fs.readFileSync('client/src/pages/modules/administration/branches/BranchList.jsx', 'utf8');

const targetLF = '</select>\n                  </div>\n\n                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">';
const replacementLF = '</select>\n                  </div>\n\n                  <div className="mb-4">\n                    <label className="flex items-center gap-2 cursor-pointer">\n                      <input\n                        type="checkbox"\n                        className="w-4 h-4 text-brand rounded focus:ring-brand"\n                        checked={formData.is_superbranch || false}\n                        onChange={(e) => setFormData({ ...formData, is_superbranch: e.target.checked })}\n                      />\n                      <span className="text-sm font-semibold text-gray-700">Is Superbranch?</span>\n                    </label>\n                    <p className="text-xs text-gray-500 mt-1 ml-6">\n                      Users assigned here can also be given access to child branches.\n                    </p>\n                  </div>\n\n                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">';

const targetCRLF = targetLF.replace(/\n/g, '\r\n');
const replacementCRLF = replacementLF.replace(/\n/g, '\r\n');

if (content.includes(targetCRLF)) {
  content = content.replace(targetCRLF, replacementCRLF);
} else {
  content = content.replace(targetLF, replacementLF);
}

fs.writeFileSync('client/src/pages/modules/administration/branches/BranchList.jsx', content);
console.log('Update completed');
