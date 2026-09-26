import * as XLSX from 'xlsx';
import { OralExamPeriod, OralExamStudentRecord, Student, ScopeBook } from '../../types';

// Helper for Persian Digits
export const toPersianDigits = (num: number | string | undefined | null): string => {
  if (num === undefined || num === null || num === '') return '-';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/[0-9]/g, w => farsiDigits[+w]);
};

// -------------------------------------------------------------
// 1. EXCEL EXPORT: BULLETIN BOARD (تابلو اعلانات طلاب)
// -------------------------------------------------------------
export const exportBulletinBoardExcel = (
  period: OralExamPeriod,
  records: OralExamStudentRecord[],
  studentsMap: Map<string, Student>
) => {
  const sortedRecords = [...records].sort((a, b) => (a.examTime || '00:00').localeCompare(b.examTime || '00:00'));

  const rows = sortedRecords.map((rec, idx) => {
    const student = studentsMap.get(rec.studentId);
    return {
      'ردیف': idx + 1,
      'ساعت امتحان': rec.examTime || 'اعلام خواهد شد',
      'نام و نام خانوادگی طلبه': rec.studentName || student?.name || '-',
      'پایه تحصیلی': rec.grade || student?.grade || period.grade || '-',
      'شماره تماس': rec.phone || student?.phone || '-',
      'استاد ممتحن فقه': rec.fiqhExaminerTeacherName || '-',
      'محدوده درس فقه': [rec.fiqhMainScopeTitle, rec.fiqhSubScopeTitle, rec.fiqhPages].filter(Boolean).join(' - ') || '-',
      'استاد ممتحن اصول': rec.usulExaminerTeacherName || '-',
      'محدوده درس اصول': [rec.usulMainScopeTitle, rec.usulSubScopeTitle, rec.usulPages].filter(Boolean).join(' - ') || '-'
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'تابلو_اعلانات');
  const fileName = `تابلو_اعلانات_${period.title.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// -------------------------------------------------------------
// 2. EXCEL EXPORT: COMPREHENSIVE PERIOD RESULTS (کارنامه و صورتجلسه دوره)
// -------------------------------------------------------------
export const exportPeriodResultsExcel = (
  period: OralExamPeriod,
  records: OralExamStudentRecord[]
) => {
  const rows = records.map((rec, idx) => {
    return {
      'ردیف': idx + 1,
      'نام و نام خانوادگی طلبه': rec.studentName,
      'پایه': rec.grade || period.grade,
      'ساعت امتحان': rec.examTime || '-',
      'استاد فقه': rec.fiqhExaminerTeacherName || '-',
      'محدوده فقه': [rec.fiqhMainScopeTitle, rec.fiqhSubScopeTitle, rec.fiqhPages].filter(Boolean).join(' / ') || '-',
      'نمره فقه (از ۲۰)': rec.fiqhScore !== null && rec.fiqhScore !== undefined ? rec.fiqhScore : '-',
      'استاد اصول': rec.usulExaminerTeacherName || '-',
      'محدوده اصول': [rec.usulMainScopeTitle, rec.usulSubScopeTitle, rec.usulPages].filter(Boolean).join(' / ') || '-',
      'نمره اصول (از ۲۰)': rec.usulScore !== null && rec.usulScore !== undefined ? rec.usulScore : '-',
      'وضعیت نهایی': rec.overallStatus === 'passed' ? 'قبول' : rec.overallStatus === 'retake' ? 'تجدید / مجدد' : rec.overallStatus === 'absent' ? 'غایب' : 'نامشخص',
      'توضیحات ممتحن': rec.examinerNotes || rec.generalNotes || '-'
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'صورتجلسه_نتایج');
  XLSX.writeFile(wb, `صورتجلسه_نتایج_${period.title.replace(/\s+/g, '_')}.xlsx`);
};

// -------------------------------------------------------------
// 3. WORD EXPORT: A5 EXAMINER GRADE SHEETS (تولید برگه‌های A5 امتحان شفاهی طلاب)
// -------------------------------------------------------------
export const exportOralExamA5WordDoc = (
  period: OralExamPeriod,
  records: OralExamStudentRecord[],
  studentsMap: Map<string, Student>
) => {
  const sortedRecords = [...records].sort((a, b) => (a.examTime || '00:00').localeCompare(b.examTime || '00:00'));

  let pagesHtml = '';

  sortedRecords.forEach((rec, idx) => {
    const student = studentsMap.get(rec.studentId);
    const photoUrl = student?.photoUrl || '';
    const phone = rec.phone || student?.phone || 'ثبت نشده';
    const grade = rec.grade || student?.grade || period.grade || '-';

    const fiqhScopeStr = [rec.fiqhMainScopeTitle, rec.fiqhSubScopeTitle, rec.fiqhPages ? `(${rec.fiqhPages})` : '']
      .filter(Boolean).join(' - ') || 'تعیین نشده';

    const usulScopeStr = [rec.usulMainScopeTitle, rec.usulSubScopeTitle, rec.usulPages ? `(${rec.usulPages})` : '']
      .filter(Boolean).join(' - ') || 'تعیین نشده';

    pagesHtml += `
      <div class="a5-sheet" style="page-break-after: always; padding: 25px 30px; font-family: 'Tahoma', 'Vazirmatn', sans-serif; direction: rtl; text-align: right; color: #1e293b;">
        <!-- Header -->
        <table style="width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px;">
          <tr>
            <td style="width: 20%; text-align: right; vertical-align: middle;">
              <div style="font-size: 11px; font-weight: bold; color: #475569;">حوزه علمیه مروی</div>
              <div style="font-size: 10px; color: #64748b;">معاونت آموزش و سنجش</div>
            </td>
            <td style="width: 60%; text-align: center; vertical-align: middle;">
              <h2 style="margin: 0; font-size: 16px; font-weight: bold; color: #0f172a;">برگه ارزیابی و ثبت نمره امتحان شفاهی</h2>
              <div style="font-size: 12px; font-weight: bold; color: #334155; margin-top: 4px;">${period.title}</div>
            </td>
            <td style="width: 20%; text-align: left; vertical-align: middle; font-size: 10px; color: #475569;">
              <div>تاریخ: <b>${period.examDate || period.examDates?.[0] || '۱۴۰۳/--/--'}</b></div>
              <div>ساعت آزمون: <b>${rec.examTime || '--:--'}</b></div>
            </td>
          </tr>
        </table>

        <!-- Student Profile Row -->
        <table style="width: 100%; border: 1px solid #cbd5e1; border-collapse: collapse; margin-bottom: 15px; background-color: #f8fafc;">
          <tr>
            <td style="width: 90px; text-align: center; padding: 10px; border-left: 1px solid #cbd5e1; vertical-align: middle;">
              ${photoUrl ? `<img src="${photoUrl}" style="width: 75px; height: 95px; object-fit: cover; border: 1px solid #94a3b8; border-radius: 4px;" alt="عکس طلبه" />` 
                         : `<div style="width: 75px; height: 95px; border: 1px dashed #94a3b8; line-height: 95px; font-size: 11px; color: #94a3b8; text-align: center; background-color: #fff;">محل عکس</div>`}
            </td>
            <td style="padding: 10px 15px; vertical-align: middle;">
              <table style="width: 100%; font-size: 12px; line-height: 1.8;">
                <tr>
                  <td style="width: 50%;"><b>نام و نام خانوادگی:</b> <span style="font-size: 14px; font-weight: bold; color: #0f172a;">${rec.studentName}</span></td>
                  <td style="width: 50%;"><b>پایه تحصیلی:</b> <span style="color: #0f172a; font-weight: bold;">${grade}</span></td>
                </tr>
                <tr>
                  <td><b>شماره همراه:</b> <span style="color: #334155;">${phone}</span></td>
                  <td><b>کد ملی / شناسه:</b> <span style="color: #334155;">${rec.nationalId || student?.nationalId || '-'}</span></td>
                </tr>
                <tr>
                  <td colspan="2"><b>ساعت دقیق نوبت امتحان:</b> <span style="font-weight: bold; color: #0284c7; font-size: 13px;">${rec.examTime || 'طبق جدول نوبت‌بندی'}</span></td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Subjects & Scopes Table -->
        <table style="width: 100%; border: 1px solid #0f172a; border-collapse: collapse; margin-bottom: 15px; font-size: 11px;">
          <thead>
            <tr style="background-color: #f1f5f9; color: #0f172a; font-weight: bold; border-bottom: 2px solid #0f172a;">
              <th style="padding: 7px; border: 1px solid #94a3b8; text-align: center; width: 14%;">عنوان درس</th>
              <th style="padding: 7px; border: 1px solid #94a3b8; text-align: right; width: 44%;">محدوده امتحانی مصوب</th>
              <th style="padding: 7px; border: 1px solid #94a3b8; text-align: center; width: 22%;">استاد ممتحن</th>
              <th style="padding: 7px; border: 1px solid #94a3b8; text-align: center; width: 20%;">نمره (از ۲۰)</th>
            </tr>
          </thead>
          <tbody>
            ${(period.hasFiqh !== false) ? `
            <tr>
              <td style="padding: 10px 7px; border: 1px solid #94a3b8; text-align: center; font-weight: bold; background-color: #fefce8; color: #854d0e;">فـقـه</td>
              <td style="padding: 10px 8px; border: 1px solid #94a3b8; line-height: 1.5;">${fiqhScopeStr}</td>
              <td style="padding: 10px 7px; border: 1px solid #94a3b8; text-align: center; font-weight: bold;">${rec.fiqhExaminerTeacherName || 'استاد ممتحن فقه'}</td>
              <td style="padding: 10px 7px; border: 1px solid #94a3b8; text-align: center; font-weight: bold; font-size: 14px;">
                ${rec.fiqhScore !== null && rec.fiqhScore !== undefined ? rec.fiqhScore : '<span style="color:#cbd5e1;">( . . . . . . . . . )</span>'}
              </td>
            </tr>` : ''}

            ${(period.hasUsul !== false) ? `
            <tr>
              <td style="padding: 10px 7px; border: 1px solid #94a3b8; text-align: center; font-weight: bold; background-color: #e0e7ff; color: #3730a3;">اصـول</td>
              <td style="padding: 10px 8px; border: 1px solid #94a3b8; line-height: 1.5;">${usulScopeStr}</td>
              <td style="padding: 10px 7px; border: 1px solid #94a3b8; text-align: center; font-weight: bold;">${rec.usulExaminerTeacherName || 'استاد ممتحن اصول'}</td>
              <td style="padding: 10px 7px; border: 1px solid #94a3b8; text-align: center; font-weight: bold; font-size: 14px;">
                ${rec.usulScore !== null && rec.usulScore !== undefined ? rec.usulScore : '<span style="color:#cbd5e1;">( . . . . . . . . . )</span>'}
              </td>
            </tr>` : ''}
          </tbody>
        </table>

        <!-- Evaluation Criteria Table -->
        <table style="width: 100%; border: 1px solid #cbd5e1; border-collapse: collapse; margin-bottom: 15px; font-size: 10px; text-align: center;">
          <tr style="background-color: #f8fafc; font-weight: bold;">
            <td style="padding: 5px; border: 1px solid #cbd5e1;">شاخص ارزیابی</td>
            <td style="padding: 5px; border: 1px solid #cbd5e1;">صحت قرائت و اعراب متن (از ۵)</td>
            <td style="padding: 5px; border: 1px solid #cbd5e1;">ترجمه و توضیح روان عبارت (از ۵)</td>
            <td style="padding: 5px; border: 1px solid #cbd5e1;">استدلال و تسلط بر مبانی (از ۵)</td>
            <td style="padding: 5px; border: 1px solid #cbd5e1;">پاسخ به ان‌قلت‌ها و اشکالات (از ۵)</td>
          </tr>
          <tr>
            <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold;">ارزیابی ممتحن</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; color: #94a3b8;">[   ]</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; color: #94a3b8;">[   ]</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; color: #94a3b8;">[   ]</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; color: #94a3b8;">[   ]</td>
          </tr>
        </table>

        <!-- Examiner Notes & Signature Box -->
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 12px; background-color: #ffffff;">
          <div style="font-size: 11px; font-weight: bold; color: #334155; margin-bottom: 6px;">محل درج نظرات، نقاط ضعف و قوت و توضیحات اساتید ممتحن:</div>
          <div style="min-height: 70px; border-bottom: 1px dashed #cbd5e1; font-size: 11px; color: #475569; padding-top: 4px;">
            ${rec.examinerNotes || ''}
          </div>
          <div style="margin-top: 15px;">
            <table style="width: 100%; font-size: 11px;">
              <tr>
                <td style="width: 50%; text-align: center;">
                  <div>نام و امضای استاد ممتحن فقه</div>
                  <div style="height: 35px;"></div>
                </td>
                <td style="width: 50%; text-align: center;">
                  <div>نام و امضای استاد ممتحن اصول</div>
                  <div style="height: 35px;"></div>
                </td>
              </tr>
            </table>
          </div>
        </div>

        <div style="text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 5px;">
          صفحه ${idx + 1} از ${sortedRecords.length} — سامانه مدیریت آموزش و امتحانات شفاهی حوزه علمیه
        </div>
      </div>
    `;
  });

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <title>برگه‌های امتحان شفاهی - ${period.title}</title>
      <style>
        @page {
          size: A5 portrait;
          margin: 10mm;
        }
        body {
          font-family: 'Tahoma', 'Vazirmatn', sans-serif;
          margin: 0;
          padding: 0;
          direction: rtl;
        }
        .a5-sheet {
          page-break-after: always;
        }
      </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
  `;

  // Create Blob and trigger download as .doc file (Microsoft Word compatible)
  const blob = new Blob(['\ufeff', fullHtml], {
    type: 'application/msword;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `برگه‌های_A5_امتحان_شفاهی_${period.title.replace(/\s+/g, '_')}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// -------------------------------------------------------------
// 4. WORD EXPORT: COMPREHENSIVE REPORTS (گزارش‌های اساتید، دروس، و طلاب)
// -------------------------------------------------------------
export const exportReportWordDoc = (
  reportTitle: string,
  metaInfo: { label: string; value: string }[],
  tableHeaders: string[],
  tableRows: (string | number)[][]
) => {
  const metaHtml = metaInfo.map(m => `<b>${m.label}:</b> ${m.value} &nbsp;&nbsp;|&nbsp;&nbsp; `).join('');
  const headersHtml = tableHeaders.map(h => `<th style="padding: 8px; border: 1px solid #94a3b8; background-color: #f1f5f9;">${h}</th>`).join('');
  const rowsHtml = tableRows.map(row => `
    <tr>
      ${row.map(cell => `<td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${cell ?? '-'}</td>`).join('')}
    </tr>
  `).join('');

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <title>${reportTitle}</title>
      <style>
        body { font-family: 'Tahoma', 'Vazirmatn', sans-serif; direction: rtl; text-align: right; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
      </style>
    </head>
    <body>
      <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px;">
        <h2 style="margin: 0;">${reportTitle}</h2>
        <div style="font-size: 12px; color: #475569; margin-top: 5px;">${metaHtml}</div>
      </div>
      <table>
        <thead>
          <tr>${headersHtml}</tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${reportTitle.replace(/\s+/g, '_')}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
