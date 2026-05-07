import re
import sys

def main():
    with open('c:\\Users\\stanl\\OneDrive\\Documents\\serianamart\\client\\src\\pages\\modules\\finance\\vouchers\\VoucherFormPage.jsx', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Find the boundaries of the rendering blocks
    
    def find_block(start_pattern):
        for i, line in enumerate(lines):
            if re.match(start_pattern, line):
                # find the matching closing brace
                open_braces = 0
                for j in range(i, len(lines)):
                    open_braces += lines[j].count('{')
                    open_braces -= lines[j].count('}')
                    if open_braces == 0:
                        return i, j
        return -1, -1

    jv_start, jv_end = find_block(r'^\s*if\s*\(\s*isJV\s*\|\|')
    rv_start, rv_end = find_block(r'^\s*if\s*\(\s*isRV\s*\)\s*\{')
    payv_start, payv_end = find_block(r'^\s*if\s*\(\s*isPAYV\s*\)\s*\{')
    cv_start, cv_end = find_block(r'^\s*if\s*\(\s*isCV\s*\)\s*\{')

    print(f"JV: {jv_start}-{jv_end}")
    print(f"RV: {rv_start}-{rv_end}")
    print(f"PAYV: {payv_start}-{payv_end}")
    print(f"CV: {cv_start}-{cv_end}")

    # Create a list of lines, excluding the render blocks
    blocks_to_exclude = [(jv_start, jv_end), (rv_start, rv_end), (payv_start, payv_end), (cv_start, cv_end)]
    
    # Sort in reverse order to delete from back to front, or just build a new list
    
    new_lines = []
    extracted_blocks = {
        'jv': lines[jv_start:jv_end+1],
        'rv': lines[rv_start:rv_end+1],
        'payv': lines[payv_start:payv_end+1],
        'cv': lines[cv_start:cv_end+1]
    }

    # We also need to remove the trailing `return null;\n}` at the end of the file
    # We will just ignore the last two lines or whatever ends the function
    
    for i, line in enumerate(lines):
        in_block = False
        for start, end in blocks_to_exclude:
            if start <= i <= end:
                in_block = True
                break
        if not in_block:
            new_lines.append(line)

    # Now, find the end of the function.
    # The last line should be `}`
    # Actually, the last lines in new_lines might be:
    #   return null;
    # }
    
    while new_lines and new_lines[-1].strip() in ['}', 'return null;']:
        new_lines.pop()

    # Append the extracted blocks
    new_lines.extend(extracted_blocks['jv'])
    new_lines.extend(extracted_blocks['rv'])
    new_lines.extend(extracted_blocks['payv'])
    new_lines.extend(extracted_blocks['cv'])
    new_lines.append('  return null;\n')
    new_lines.append('}\n')

    with open('c:\\Users\\stanl\\OneDrive\\Documents\\serianamart\\client\\src\\pages\\modules\\finance\\vouchers\\VoucherFormPage.jsx', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("Done")

if __name__ == '__main__':
    main()
