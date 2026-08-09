import re

path = 'server/index.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("  ensurePaymentPackagesTable,\n", "")
content = content.replace('            ["payment packages table", () => ensurePaymentPackagesTable()],\n', "")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed index.js again")
