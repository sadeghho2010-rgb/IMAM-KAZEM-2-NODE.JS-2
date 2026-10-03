const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();
const TARGET_DIRS = ['src', 'server.ts'];

function getFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    if (dir.endsWith('.ts') || dir.endsWith('.tsx')) return [dir];
    return [];
  }
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const s = fs.statSync(fullPath);
    if (s.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        results = results.concat(getFiles(fullPath));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

let allFiles = [];
TARGET_DIRS.forEach(d => {
  allFiles = allFiles.concat(getFiles(path.join(ROOT_DIR, d)));
});

const report = [];
const p1List = [];
const p2List = [];
const p3List = [];

allFiles.forEach(filePath => {
  const relPath = path.relative(ROOT_DIR, filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Regex matches ': any' or '<any>' or 'as any'
    if (/:\s*any\b|as\s+any\b|<any>/.test(line)) {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // Determine suggested replacement
      let suggested = 'unknown';
      let priority = 'P3';

      if (relPath.includes('Auth') || relPath.includes('auth') || relPath.includes('Security') || relPath.includes('pin') || relPath.includes('token')) {
        priority = 'P1';
        if (trimmed.includes('req') || trimmed.includes('res')) suggested = 'Request / Response (from express)';
        else if (trimmed.includes('user')) suggested = 'AppUser | SafeUser';
        else if (trimmed.includes('err') || trimmed.includes('error')) suggested = 'Error | unknown';
        else suggested = 'SafeUser | Record<string, unknown>';
      } else if (relPath.includes('finance') || relPath.includes('attendance') || relPath.includes('student') || relPath.includes('exam') || relPath.includes('request')) {
        priority = 'P2';
        if (trimmed.includes('err') || trimmed.includes('error')) suggested = 'Error | unknown';
        else if (trimmed.includes('data')) suggested = 'Record<string, unknown>';
        else suggested = 'Concrete Type (e.g. Student, RequestItem, FinanceRecord)';
      } else if (relPath.includes('localDb') || relPath.includes('storage') || relPath.includes('cache')) {
        priority = 'P3';
        suggested = 'T (generic) / Record<string, unknown>';
      } else {
        if (trimmed.includes('err') || trimmed.includes('error')) suggested = 'Error | unknown';
        else suggested = 'Record<string, unknown>';
      }

      const item = {
        file: relPath,
        line: lineNum,
        code: trimmed,
        suggested,
        priority
      };

      report.push(item);
      if (priority === 'P1') p1List.push(item);
      else if (priority === 'P2') p2List.push(item);
      else p3List.push(item);
    }
  });
});

let out = `================================================================================\n`;
out += `گزارش جامع آنالیز و ردیابی تایپ‌های any در پروژه (any_report.txt)\n`;
out += `تعداد کل موارد کشف‌شده: ${report.length}\n`;
out += `اولویت ۱ (امنیتی و احراز هویت - P1): ${p1List.length} مورد\n`;
out += `اولویت ۲ (منطق محاسباتی و بیزنس - P2): ${p2List.length} مورد\n`;
out += `اولویت ۳ (لایه ذخیره‌سازی محلی و کش - P3): ${p3List.length} مورد\n`;
out += `تاریخ گزارش: ${new Date().toISOString()}\n`;
out += `================================================================================\n\n`;

out += `--------------------------------------------------------------------------------\n`;
out += `🔴 اولویت ۱ (P1) - بخش‌های امنیتی، نشست و توکن‌ها (نیازمند حذف فوری)\n`;
out += `--------------------------------------------------------------------------------\n`;
p1List.forEach(i => {
  out += `[${i.priority}] ${i.file}:${i.line}\n`;
  out += `  کد: ${i.code}\n`;
  out += `  پیشنهاد جایگزین: ${i.suggested}\n\n`;
});

out += `--------------------------------------------------------------------------------\n`;
out += `🟡 اولویت ۲ (P2) - ماژول‌های بیزنس لاجیک، مالی و درخواست‌ها (فاز دوم)\n`;
out += `--------------------------------------------------------------------------------\n`;
p2List.forEach(i => {
  out += `[${i.priority}] ${i.file}:${i.line}\n`;
  out += `  کد: ${i.code}\n`;
  out += `  پیشنهاد جایگزین: ${i.suggested}\n\n`;
});

out += `--------------------------------------------------------------------------------\n`;
out += `🟢 اولویت ۳ (P3) - لایه ذخیره‌سازی آزاد و کش IndexedDB (قابل نگه‌داری به شکل جنریک T)\n`;
out += `--------------------------------------------------------------------------------\n`;
p3List.forEach(i => {
  out += `[${i.priority}] ${i.file}:${i.line}\n`;
  out += `  کد: ${i.code}\n`;
  out += `  پیشنهاد جایگزین: ${i.suggested}\n\n`;
});

fs.writeFileSync(path.join(ROOT_DIR, 'any_report.txt'), out, 'utf-8');
console.log(`Report generated successfully with ${report.length} items.`);
