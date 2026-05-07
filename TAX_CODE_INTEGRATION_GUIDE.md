# Tax Code Integration Guide

This guide shows how to integrate automatic tax code population into any page form (Invoice, Purchase Bill, etc.).

## Quick Start

### 1. Import the Hook

```jsx
import { useTaxCodesByPageId, PAGE_IDS } from "@/hooks/useTaxCodesByPageId";
```

### 2. Use in Component

```jsx
export default function InvoicePage() {
  // Fetch tax codes for the Invoice page (ID 2)
  const { taxCodes, loading: taxLoading } = useTaxCodesByPageId(PAGE_IDS.INVOICE);
  
  // State for line items
  const [lines, setLines] = useState([]);
  
  // When adding a new line, you can pre-populate applicable taxes
  function addLine() {
    setLines([...lines, {
      item: "",
      qty: 1,
      rate: 0,
      taxes: taxCodes.length > 0 ? [taxCodes[0].id] : [] // Pre-select first tax
    }]);
  }
  
  // Render tax selector with available codes
  return (
    <div>
      {lines.map((line, idx) => (
        <div key={idx}>
          {/* ... other fields ... */}
          <select multiple>
            <option>-- Select Taxes --</option>
            {taxCodes.map(tax => (
              <option key={tax.id} value={tax.id}>
                {tax.code} - {tax.name} ({tax.rate_percent}%)
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
```

## PAGE_IDS Reference

Use these constants to fetch tax codes for any page:

| Constant | ID | Description |
|----------|----|----|
| DIRECT_PURCHASE | 1 | Direct Purchase |
| INVOICE | 2 | Sales Invoice |
| PURCHASE_BILL_LOCAL | 3 | Local Purchase Bill |
| PURCHASE_BILL_IMPORT | 4 | Import Purchase Bill |
| LOCAL_PURCHASE_ORDER | 5 | Local Purchase Order |
| IMPORT_PURCHASE_ORDER | 6 | Import Purchase Order |
| MAINTENANCE_BILL | 7 | Maintenance Bill |
| SERVICE_BILL | 8 | Service Bill |
| SALES_ORDER | 9 | Sales Order |
| QUOTATION | 10 | Quotation |
| SUPPLIER_QUOTATION | 11 | Supplier Quotation |
| PAYMENT_VOUCHER | 12 | Payment Voucher |
| RECEIPT_VOUCHER | 13 | Receipt Voucher |

## Automatic Tax Behavior

When a tax code is configured:
- **If Sales Tax is checked**: Receipt Voucher (ID 13) is automatically included
- **If Purchase Tax is checked**: Payment Voucher (ID 12) is automatically included
- **If Service Tax is checked**: Service pages are included (no voucher)

## Examples

### Example 1: Invoice Page

```jsx
import { useTaxCodesByPageId, PAGE_IDS } from "@/hooks/useTaxCodesByPageId";

export default function SalesInvoicePage() {
  const { taxCodes, loading } = useTaxCodesByPageId(PAGE_IDS.INVOICE);
  
  if (loading) return <div>Loading taxes...</div>;
  
  return (
    <div className="invoice-form">
      <h1>Sales Invoice</h1>
      <p>Available Taxes: {taxCodes.length}</p>
      {taxCodes.map(tax => (
        <div key={tax.id} className="tax-option">
          {tax.code} - {tax.name}: {tax.rate_percent}%
        </div>
      ))}
    </div>
  );
}
```

### Example 2: Purchase Bill Page

```jsx
import { useTaxCodesByPageId, PAGE_IDS } from "@/hooks/useTaxCodesByPageId";

export default function PurchaseBillPage() {
  const { taxCodes: localTaxes } = useTaxCodesByPageId(PAGE_IDS.PURCHASE_BILL_LOCAL);
  const { taxCodes: importTaxes } = useTaxCodesByPageId(PAGE_IDS.PURCHASE_BILL_IMPORT);
  
  return (
    <div className="purchase-form">
      <h1>Purchase Bill</h1>
      <div className="local-bill">
        <h2>Local</h2>
        <select>
          {localTaxes.map(tax => (
            <option key={tax.id} value={tax.id}>{tax.name}</option>
          ))}
        </select>
      </div>
      <div className="import-bill">
        <h2>Import</h2>
        <select>
          {importTaxes.map(tax => (
            <option key={tax.id} value={tax.id}>{tax.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
```

### Example 3: Voucher Page

```jsx
import { useTaxCodesByPageId, PAGE_IDS } from "@/hooks/useTaxCodesByPageId";

export default function PaymentVoucherPage() {
  // Automatically gets tax codes marked for Payment Voucher
  const { taxCodes } = useTaxCodesByPageId(PAGE_IDS.PAYMENT_VOUCHER);
  
  return (
    <div className="voucher-form">
      <h1>Payment Voucher</h1>
      <div className="taxes-available">
        {taxCodes.length > 0 ? (
          <ul>
            {taxCodes.map(tax => (
              <li key={tax.id}>{tax.name}</li>
            ))}
          </ul>
        ) : (
          <p>No taxes configured for this voucher</p>
        )}
      </div>
    </div>
  );
}
```

## API Endpoints

### Get Tax Codes by Page ID

```
GET /api/finance/tax-codes/by-page/:pageId
```

**Parameters:**
- `pageId` (numeric): The page ID (1-13)

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "code": "VAT",
      "name": "Value Added Tax",
      "rate_percent": 15,
      "type": "TAX",
      "is_active": 1,
      "valid_pages": "2,10,13",
      "is_sales_tax": 1,
      "is_purchase_tax": 0,
      "is_service_tax": 0
    }
  ]
}
```

## Testing the Integration

1. **Create a Tax Code in Tax & Deductions:**
   - Name: "Sales VAT"
   - Type: TAX
   - Check "Sales Tax"
   - Should auto-check "Receipt Voucher"

2. **Test API:**
   ```bash
   curl http://localhost:5000/api/finance/tax-codes/by-page/2
   ```
   Should return tax codes for invoices

3. **Integrate Hook:**
   - Add hook to Invoice page
   - Verify taxes load automatically
   - Verify taxes appear in line item selections

4. **Test Payment Voucher:**
   - Create tax code with "Purchase Tax"
   - Should auto-check "Payment Voucher"
   - Access Payment Voucher page
   - Verify taxes are available via hook
