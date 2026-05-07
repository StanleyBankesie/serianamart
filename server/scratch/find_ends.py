with open('client/src/pages/modules/finance/vouchers/VoucherFormPage.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def find_end(start_line):
    open_b = 0
    for i in range(start_line, len(lines)):
        open_b += lines[i].count('{')
        open_b -= lines[i].count('}')
        if open_b == 0:
            return i
    return -1

print('JV:', find_end(1736 - 1))
print('RV:', find_end(2898 - 1))
print('PAYV:', find_end(4122 - 1))
print('CV:', find_end(5327 - 1))
