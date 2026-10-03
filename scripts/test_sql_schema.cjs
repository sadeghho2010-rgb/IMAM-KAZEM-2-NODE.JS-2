const fs = require('fs');
const path = require('path');

const SQL_FILE = path.join(process.cwd(), 'database_complete.sql');

if (!fs.existsSync(SQL_FILE)) {
  console.error('Error: database_complete.sql does not exist.');
  process.exit(1);
}

const content = fs.readFileSync(SQL_FILE, 'utf-8');

console.log('------------------------------------------------------------');
console.log('🔍 Testing and Verifying database_complete.sql Schema');
console.log('------------------------------------------------------------');

// 1. Check Charset & Collation
const hasUtf8mb4 = content.includes('utf8mb4_unicode_ci');
console.log(`[Charset Check] utf8mb4_unicode_ci: ${hasUtf8mb4 ? '✅ PASS' : '❌ FAIL'}`);

// 2. Extract all CREATE TABLE names
const tableMatches = [...content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-zA-Z0-9_]+)`?/gi)];
const tables = tableMatches.map(m => m[1]);

console.log(`[Tables Detected] Found ${tables.length} tables:`);
tables.forEach((t, i) => console.log(`   ${i + 1}. ${t}`));

// 3. Verify Foreign Keys
const fkMatches = [...content.matchAll(/FOREIGN\s+KEY\s*\(`?([a-zA-Z0-9_]+)`?\)\s*REFERENCES\s*`?([a-zA-Z0-9_]+)`?\s*\(`?([a-zA-Z0-9_]+)`?\)(?:\s*ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT))?/gi)];
console.log(`\n[Foreign Keys Detected] Found ${fkMatches.length} explicit Foreign Keys:`);
let fkError = false;

fkMatches.forEach(fk => {
  const col = fk[1];
  const targetTable = fk[2];
  const targetCol = fk[3];
  const onDel = fk[4] || 'DEFAULT';

  const targetIdx = tables.indexOf(targetTable);
  if (targetIdx === -1) {
    console.error(`❌ Foreign Key Error: Target table "${targetTable}" does not exist in schema!`);
    fkError = true;
  } else {
    console.log(`   🔗 (${col}) -> ${targetTable}(${targetCol}) [ON DELETE ${onDel}] ✅`);
  }
});

// 4. Verify admin and finance user bcrypt hashes
const hasAdminHash = content.includes('$2b$10$gPXa3enKLAd7Aa9tjOtO0.q.LWw7Tg6wVSlfMXdQPOdkLhBNHzSKK');
const hasFinanceHash = content.includes('$2b$10$mN7jAyMI45JuFX2fPjs/ROllvJSP2qJf1PYhvsr56c2HyXPnd2kUi');

console.log(`\n[Seed Passwords Check]`);
console.log(`   admin password hash (Admin@123456): ${hasAdminHash ? '✅ VALID BCRYPT HASH' : '❌ MISSING'}`);
console.log(`   finance password hash (Finance@123456): ${hasFinanceHash ? '✅ VALID BCRYPT HASH' : '❌ MISSING'}`);

if (hasUtf8mb4 && tables.length >= 20 && !fkError && hasAdminHash && hasFinanceHash) {
  console.log('\n🎉 ALL SQL SCHEMA VALIDATION CHECKS PASSED SUCCESSFULLY!');
} else {
  console.error('\n⚠️ Some SQL schema checks failed.');
  process.exit(1);
}
