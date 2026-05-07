with open('client/src/pages/modules/finance/vouchers/VoucherFormPage.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

blocks = [
    (1735, 2436),
    (2897, 3860),
    (4121, 5300),
    (5326, 5914)
]

new_lines = []
extracted = []

# Collect extracted lines
for start, end in blocks:
    extracted.extend(lines[start:end+1])

# Collect non-extracted lines
for i, line in enumerate(lines):
    in_block = False
    for start, end in blocks:
        if start <= i <= end:
            in_block = True
            break
    if not in_block:
        new_lines.append(line)

# Remove the final `}` ONLY ONCE
# Actually, the last line of `new_lines` is lines[5915] which is `}\n`
# Let's just pop the last line if it is `}` or `}\n`
if new_lines and new_lines[-1].strip() == '}':
    new_lines.pop()

# Append the extracted blocks
new_lines.extend(extracted)
new_lines.append('  return null;\n')
new_lines.append('}\n')

with open('client/src/pages/modules/finance/vouchers/VoucherFormPage.jsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("Done")
