# Receipt Voucher Auto-Sync Removal

## Plan

**Information Gathered:**

- Target: client/src/pages/modules/finance/vouchers/VoucherFormPage.jsx
- RV payment details: rvForm.items (account, desc, amount)
- Posting lines: lines state table
- Auto-sync: 2 useEffect blocks trigger on rvForm.items/taxCodeId changes → generate/populate lines

**Files to Edit:**

- client/src/pages/modules/finance/vouchers/VoucherFormPage.jsx: Remove RV sync useEffects

**Dependent Files:** None

**Follow-up Steps:**

- [ ] Remove RV auto-sync useEffects
- [ ] Verify manual posting lines + submit() still works
- [ ] Test RV form (user skipped)

## Steps

1. [ ] Edit VoucherFormPage.jsx - remove/comment RV useEffect blocks
