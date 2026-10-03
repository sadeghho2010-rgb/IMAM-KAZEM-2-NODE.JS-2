import fs from 'fs';
import path from 'path';

function validateSqlFile(filePath) {
  console.log(`\n[SQL Validator] Checking: ${filePath}`);
  if (!fs.existsSync(filePath)) {
    console.error(`File does not exist: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  console.log(`Total lines: ${lines.length}, file size: ${content.length} bytes`);

  // Count CREATE TABLE statements
  const createTableMatches = content.match(/CREATE TABLE\s+(IF NOT EXISTS\s+)?`?([a-zA-Z0-9_]+)`?/gi) || [];
  console.log(`Found ${createTableMatches.length} CREATE TABLE statements:`);

  const tables = [];
  const regex = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?`?([a-zA-Z0-9_]+)`?/i;
  for (const statement of createTableMatches) {
    const match = statement.match(regex);
    if (match && match[1]) {
      tables.push(match[1]);
    }
  }

  tables.forEach((t, i) => {
    console.log(`  ${i + 1}. \x1b[32m${t}\x1b[0m`);
  });

  // Basic syntax check: matching parentheses inside statements
  let openParenCount = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';

    if (inString) {
      if (char === stringChar && prevChar !== '\\') {
        inString = false;
      }
    } else {
      if (char === "'" || char === '"' || char === '`') {
        inString = true;
        stringChar = char;
      } else if (char === '(') {
        openParenCount++;
      } else if (char === ')') {
        openParenCount--;
        if (openParenCount < 0) {
          console.error(`\x1b[31m[ERROR] Mismatched closing parenthesis near character ${i}\x1b[0m`);
          process.exit(1);
        }
      }
    }
  }

  if (openParenCount !== 0) {
    console.error(`\x1b[31m[ERROR] Unbalanced parentheses in SQL file (diff: ${openParenCount})\x1b[0m`);
    process.exit(1);
  }

  console.log(`\x1b[32m[SUCCESS] ${path.basename(filePath)} passed all syntax and balance checks!\x1b[0m`);
}

validateSqlFile(path.join(process.cwd(), 'database_complete.sql'));
validateSqlFile(path.join(process.cwd(), 'database_migration_v2.sql'));
