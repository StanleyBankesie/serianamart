const fs = require('fs');
let content = fs.readFileSync('client/src/pages/modules/sales/invoices/InvoiceForm.jsx', 'utf8');

const s1 = '            <div>City: {form.city || ""}</div>\n            <div>State: {form.state || ""}</div>\n            <div>Country: {form.country || ""}</div>\n            <div>Phone: {form.phone || ""}</div>\n';

content = content.split(s1).join('');

// Also remove from company details if requested? 
// The user said: "in invoice page hide City, State, Country and Phone from the invoice page."
// Let's also check the company details section in the print view.
// It looks like:
//               {(companyInfo.city ||
//                 companyInfo.state ||
//                 companyInfo.country) && (
//                 <div>
//                   {[companyInfo.city, companyInfo.state, companyInfo.country]
//                     .filter(Boolean)
//                     .join(", ")}
//                 </div>
//               )}
//               <div className="flex gap-3">
//                 {companyInfo.phone && <span>{companyInfo.phone}</span>}

const companyLocationStr1 = `              {(companyInfo.city ||
                companyInfo.state ||
                companyInfo.country) && (
                <div>
                  {[companyInfo.city, companyInfo.state, companyInfo.country]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              )}`;

const companyPhoneStr1 = `              <div className="flex gap-3">
                {companyInfo.phone && <span>{companyInfo.phone}</span>}`;

const companyPhoneStr2 = `              <div className="flex gap-3 w-56">
                {companyInfo.phone && <span>{companyInfo.phone}</span>}`;

content = content.split(companyLocationStr1).join('');
content = content.split(companyPhoneStr1).join('              <div className="flex gap-3">\n                ');
content = content.split(companyPhoneStr2).join('              <div className="flex gap-3 w-56">\n                ');


fs.writeFileSync('client/src/pages/modules/sales/invoices/InvoiceForm.jsx', content, 'utf8');
console.log('done');
