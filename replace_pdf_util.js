const fs = require('fs');
const path = require('path');

const files = [
  "c:\\Users\\stanl\\OneDrive\\Documents\\serianamart\\client\\src\\pages\\modules\\sales\\sales-orders\\SalesOrderList.jsx",
  "c:\\Users\\stanl\\OneDrive\\Documents\\serianamart\\client\\src\\pages\\modules\\sales\\sales-orders\\SalesOrderForm.jsx",
  "c:\\Users\\stanl\\OneDrive\\Documents\\serianamart\\client\\src\\pages\\modules\\sales\\quotations\\QuotationList.jsx",
  "c:\\Users\\stanl\\OneDrive\\Documents\\serianamart\\client\\src\\pages\\modules\\sales\\invoices\\InvoiceList.jsx",
  "c:\\Users\\stanl\\OneDrive\\Documents\\serianamart\\client\\src\\pages\\modules\\sales\\delivery\\DeliveryList.jsx",
  "c:\\Users\\stanl\\OneDrive\\Documents\\serianamart\\client\\src\\pages\\modules\\purchase\\purchase-orders-local\\PurchaseOrdersLocalList.jsx",
  "c:\\Users\\stanl\\OneDrive\\Documents\\serianamart\\client\\src\\pages\\modules\\purchase\\purchase-bills\\PurchaseBillsList.jsx",
  "c:\\Users\\stanl\\OneDrive\\Documents\\serianamart\\client\\src\\pages\\modules\\purchase\\direct-purchase\\DirectPurchaseList.jsx",
  "c:\\Users\\stanl\\OneDrive\\Documents\\serianamart\\client\\src\\pages\\modules\\human-resources\\payslips\\PayslipList.jsx",
  "c:\\Users\\stanl\\OneDrive\\Documents\\serianamart\\client\\src\\pages\\modules\\inventory\\GRNLocalList.jsx",
  "c:\\Users\\stanl\\OneDrive\\Documents\\serianamart\\client\\src\\pages\\modules\\administration\\templates\\DocumentTemplatesPage.jsx"
];

for (const file of files) {
  if (fs.existsSync(file)) {
    console.log(`Processing ${file}...`);
    let content = fs.readFileSync(file, 'utf8');
    let newContent = content.replace(/renderHtmlToA4Pdf/g, 'renderHtmlToPdf');
    if (content !== newContent) {
      fs.writeFileSync(file, newContent, 'utf8');
      console.log(`Updated ${file}`);
    } else {
      console.log(`No change for ${file}`);
    }
  } else {
    console.warn(`File not found: ${file}`);
  }
}
