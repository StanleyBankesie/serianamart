import re

path = 'server/index.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("  ensureLoginBrandingTable,\n", "")
content = content.replace('            ["login branding table", () => ensureLoginBrandingTable()],\n', "")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed index.js")
