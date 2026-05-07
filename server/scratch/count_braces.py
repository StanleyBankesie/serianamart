import re
with open('client/src/pages/modules/finance/vouchers/VoucherFormPage.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# very rough removal of strings and comments
text = re.sub(r'//.*', '', text)
text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
text = re.sub(r'"(?:\\.|[^"])*"', '', text)
text = re.sub(r"'(?:\\.|[^'])*'", '', text)
text = re.sub(r'`(?:\\.|[^`])*`', '', text)

print('Open:', text.count('{'), 'Close:', text.count('}'))
