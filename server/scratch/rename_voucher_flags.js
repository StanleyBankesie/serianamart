import fs from 'fs';

const filePath = 'client/src/pages/modules/finance/vouchers/VoucherFormPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Rename variable definitions and their specific mappings
content = content.replace(/const isPV = String\(voucherTypeCode\)\.toUpperCase\(\) === "PV";/g, 'const isPAYV = String(voucherTypeCode).toUpperCase() === "PAYV";');
content = content.replace(/const isPUV = String\(voucherTypeCode\)\.toUpperCase\(\) === "PUV";/g, 'const isPV = String(voucherTypeCode).toUpperCase() === "PV";');

// 2. Rename all usages of isPV to isPAYV (this is the most dangerous part, need to be careful with overlaps)
// Since we renamed isPUV to isPV already, we should only rename isPV where it is a full word.
// But wait, if I rename isPV to isPAYV first, it won't affect the newly created isPV (which was isPUV).
// Actually, I renamed isPV to isPAYV in the definition above.
// So now I should replace all OTHER occurrences of isPV with isPAYV.
// THEN rename isPUV to isPV.

// Let's re-do the logic safely:
content = fs.readFileSync(filePath, 'utf8');

// a. Temporarily rename isPV to something unique
content = content.replace(/\bisPV\b/g, '___IS_PAYV___');
// b. Rename isPUV to isPV
content = content.replace(/\bisPUV\b/g, 'isPV');
// c. Rename the temporary back to isPAYV
content = content.replace(/___IS_PAYV___/g, 'isPAYV');

// d. Update the actual string checks in definitions
content = content.replace(/String\(voucherTypeCode\)\.toUpperCase\(\) === "PV"/g, (match, offset) => {
    // If it's the one we want to be PAYV
    return 'String(voucherTypeCode).toUpperCase() === "PAYV"';
});
// Wait, the above is too simple. Let's look at the definitions again.
/*
40:   const isPV = String(voucherTypeCode).toUpperCase() === "PV";
46:   const isPUV = String(voucherTypeCode).toUpperCase() === "PUV";
*/
// After step a, b, c:
/*
40:   const isPAYV = String(voucherTypeCode).toUpperCase() === "PV";
46:   const isPV = String(voucherTypeCode).toUpperCase() === "PUV";
*/
// Now we need to fix the strings.
content = content.replace(/isPAYV = String\(voucherTypeCode\)\.toUpperCase\(\) === "PV"/g, 'isPAYV = String(voucherTypeCode).toUpperCase() === "PAYV"');
content = content.replace(/isPV = String\(voucherTypeCode\)\.toUpperCase\(\) === "PUV"/g, 'isPV = String(voucherTypeCode).toUpperCase() === "PV"');

// 3. Fix the preview logic for PV (Purchase) and SV
// Search for loadNextNo (PV)
content = content.replace(/\/finance\/vouchers\/next-no\?voucherTypeCode=PV/g, '/finance/vouchers/next-no?voucherTypeCode=PAYV');
// Wait, the new PV (Purchase) should also have next-no logic.
// I'll handle that in a separate step or just update the code.

fs.writeFileSync(filePath, content);
console.log("Renamed isPV to isPAYV and isPUV to isPV successfully.");
