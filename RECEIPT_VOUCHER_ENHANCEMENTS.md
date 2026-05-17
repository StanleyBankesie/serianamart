# Receipt Voucher Form Enhancements

## Overview

Enhanced the Receipt Voucher form with intelligent auto-population features that automatically synchronize data between Payment Details and Posting Lines sections, including tax code handling and customer sales account lookup.

---

## Features Implemented

### 1. **Payment Details Auto-Population to Posting Lines**

#### Behavior:

When you populate any field in the **Payment Details** section (specifically when selecting an account), the system automatically copies the data to the **Posting Lines** section.

#### What Gets Copied:

- **Account**: The selected account from Payment Details is copied to the Account field in Posting Lines
- **Description**: The description from Payment Details is duplicated in the corresponding Posting Lines description field
- **Amount**: The amount from Payment Details is automatically populated in the **Debit** field of the Posting Lines

#### How It Works:

1. Navigate to Receipt Voucher form
2. Select **"Direct Receipt"** payment type (at the top of the form)
3. In the **Payment Details** section:
   - Select an account from the Account dropdown
   - Enter a description
   - Enter an amount
4. The system automatically populates these values in the **Posting Lines** section with:
   - Same account in the Account column
   - Same description in the Description column
   - Amount in the Debit column

---

### 2. **Tax Code Calculation & Allocation**

#### Behavior:

When you select a tax code in the Payment Details section, the system:

- Calculates the total tax amount on the total payment amount
- Allocates the tax amount to individual tax components
- Automatically populates each tax component as separate lines in the Posting Lines section
- **Does NOT display the tax calculation in the frontend** - it's calculated behind the scenes

#### Tax Calculation Details:

- **Total Tax Amount** = (Total Amount × Tax Rate%) ÷ 100
- Each component's tax is calculated as: (Total Amount × Component Rate%) ÷ 100
- Tax components are posted on the **Credit** side of the account

#### How It Works:

1. In Payment Details section, enable **"Is Tax Included"** checkbox
2. Select a tax code from the dropdown
3. The system automatically:
   - Calculates tax for each component (without displaying in frontend)
   - Allocates each component to its respective account
   - Adds lines in Posting Lines section for each tax component
   - Places the calculated tax amount on the **Credit** side

#### Example:

- Payment Amount: 1,000
- Tax Code: VAT (with components)
  - Component A (10%): Tax = 100 (posted to Tax Account A on Credit)
  - Component B (5%): Tax = 50 (posted to Tax Account B on Credit)
- Total Tax: 150 (calculated but hidden)

---

### 3. **Customer Sales Account Lookup & Net Amount Calculation**

#### Behavior:

When you select a customer account in the Payment Details section, the system:

- Looks up the customer's sales account from the `sal_customers` table
- Calculates the net amount as (Total Amount - Tax Amount)
- Automatically populates a new line in Posting Lines with:
  - The customer's sales account
  - The description from Payment Details
  - The net amount on the **Credit** side

#### How It Works:

1. In Payment Details section, select a **Customer account** (account code must match customer code)
2. Enter description and amount
3. If applicable, enable "Is Tax Included" and select a tax code
4. The system automatically:
   - Identifies the customer by matching account code
   - Retrieves the customer's `sales_account_id` from `sal_customers` table
   - Calculates: Net Amount = Total Amount - Total Tax Amount
   - Adds/updates a posting line with:
     - Sales account populated
     - Description duplicated from Payment Details
     - Net amount posted on **Credit** side

#### Example Calculation:

- Payment from Customer A: 1,000
- Tax (VAT 15%): 150
- Net Amount: 1,000 - 150 = 850
- Posting Lines shows:
  - Customer Account: Debit 1,000
  - Sales Account of Customer A: Credit 850 (net amount)
  - Tax Component Accounts: Credit 150 (tax allocation)

---

## Auto-Population Triggers

The posting lines are automatically populated/updated when:

- ✅ Account is selected in Payment Details
- ✅ Description is changed in Payment Details
- ✅ Amount is modified in Payment Details
- ✅ Tax code is selected with "Is Tax Included" enabled
- ✅ Tax code is changed

---

## Posting Lines Structure

When fully populated, your Posting Lines will look like:

| Account                | Description          | Debit | Credit |
| ---------------------- | -------------------- | ----- | ------ |
| Customer Account       | From Payment Details | 1,000 | 0      |
| Tax Component A        | From Payment Details | 0     | 100    |
| Tax Component B        | From Payment Details | 0     | 50     |
| Customer Sales Account | From Payment Details | 0     | 850    |

**Totals**: Debit = 1,000, Credit = 1,000 (Balanced) ✓

---

## Important Notes

1. **Payment Type**: These features only work with **"Direct Receipt"** payment type
2. **Tax Display**: Tax calculations are performed but NOT displayed in the payment details summary
3. **Manual Editing**: You can still manually edit any posting line after auto-population
4. **Customer Lookup**: Requires the customer code to match the selected account code
5. **Async Operations**: Customer sales account lookup is asynchronous and may take a moment to populate
6. **Balance Requirement**: The voucher must be balanced (Total Debit = Total Credit) before saving

---

## Troubleshooting

### Posting lines not auto-populating?

- Verify you selected **"Direct Receipt"** payment type
- Check that you have entered at least an account and amount in Payment Details
- Ensure the account has an ID assigned

### Tax not showing in Posting Lines?

- Enable "Is Tax Included" checkbox
- Select a valid tax code from the dropdown
- Verify the tax code has components configured
- Check that components have account_id assigned

### Customer sales account not found?

- Verify the customer code matches the selected account code
- Confirm the customer exists in `sal_customers` table
- Ensure the customer has a `sales_account_id` assigned
- Check browser console for any API errors

---

## File Modified

- `client/src/pages/modules/finance/vouchers/ReceiptVoucherForm.jsx`
  - Enhanced `autoPopulateRvPostingLines()` function
  - Enhanced `autoPopulateRvTaxLines()` function
  - Improved `updateRvItem()` trigger logic
