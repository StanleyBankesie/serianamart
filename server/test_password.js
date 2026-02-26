const bcrypt = require('bcrypt');

const hash = '$2a$10$x.59rYiGsPmrPPv8psJ8qeE47EmAQ5ZdB8AiRHk5d3XRISmXlt0A.';
const commonPasswords = [
  'admin', 'password', 'admin123', 'password123', 'admin1234', 'password1234',
  'admin12345', 'password12345', 'admin123456', 'password123456',
  'adminadmin', 'passwordpassword', 'omni', 'suite', 'omnisuite',
  'omni123', 'suite123', 'omnisuite123', '123456', '12345678',
  'Admin', 'Admin123', 'Password', 'Password123'
];

async function testPasswords() {
  console.log('Testing common passwords against hash:', hash);
  
  for (const password of commonPasswords) {
    const match = await bcrypt.compare(password, hash);
    if (match) {
      console.log(`✅ Found password: ${password}`);
      return;
    } else {
      console.log(`❌ ${password} - no match`);
    }
  }
  
  console.log('No matching password found in common list');
}

testPasswords().catch(console.error);