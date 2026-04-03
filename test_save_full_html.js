import { query } from "./server/db/pool.js";
import sanitizeHtml from "./server/node_modules/sanitize-html/index.js";

// Simulating the backend logic
function sanitize(rawHtml) {
  return sanitizeHtml(rawHtml, {
    allowedTags: false, // Allow all tags
    allowedAttributes: false, // Allow all attributes
    allowVulnerableTags: true,
  });
}

const testHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Salary Slip Test</title>
    <style>
        .bold { font-weight: bold; }
    </style>
</head>
<body>
    <div class="bold">Employee: {{employee_name}}</div>
</body>
</html>
`;

async function runTest() {
  const sanitized = sanitize(testHtml);
  console.log("Original Length:", testHtml.length);
  console.log("Sanitized Length:", sanitized.length);
  
  if (sanitized.includes("<html") && sanitized.includes("<head") && sanitized.includes("<style")) {
    console.log("SUCCESS: Root tags preserved!");
  } else {
    console.error("FAILURE: Root tags stripped!");
    console.log("Sanitized output snippet:", sanitized.slice(0, 200));
  }
  process.exit(0);
}

runTest();
