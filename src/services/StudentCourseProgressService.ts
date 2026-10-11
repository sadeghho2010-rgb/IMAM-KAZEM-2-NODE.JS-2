import { localDb } from '../lib/localDb';
import { 
  CurriculumSubject, 
  CurriculumBook, 
  CurriculumChapter, 
  StudentCourseProgress,
  Program 
} from '../types';

/**
 * DEFAULT HAWZA CURRICULUM SEED DATA
 * Pre-populates standard subjects, books, and chapters for Hawza Level 1 & 2
 */
export const DEFAULT_CURRICULUM_SUBJECTS: Omit<CurriculumSubject, 'id'>[] = [
  { title: 'اصول فقه', code: 'USUL', description: 'مبانی، مباحث الفاظ و ادله عقلية و شرعیة', color: 'indigo', orderIndex: 1 },
  { title: 'فقه', code: 'FIQH', description: 'ابواب فقهی عبادات، معاملات و احکام', color: 'emerald', orderIndex: 2 },
  { title: 'فلسفه', code: 'PHIL', description: 'حکمت متعالیه و فلسفه اسلامی', color: 'amber', orderIndex: 3 },
  { title: 'منطق و کلام', code: 'LOGIC', description: 'منطق ارسطویی، عقاید و کلام اسلامی', color: 'sky', orderIndex: 4 },
  { title: 'ادبیات عرب', code: 'ARABIC', description: 'صرف، نحو، بلاغت و تجزیه و ترکیب', color: 'purple', orderIndex: 5 },
];

export const DEFAULT_CURRICULUM_BOOKS: { subjectTitle: string; title: string; credits: number; orderIndex: number }[] = [
  // اصول فقه
  { subjectTitle: 'اصول فقه', title: 'رسائل (فرائد الاصول)', credits: 8, orderIndex: 1 },
  { subjectTitle: 'اصول فقه', title: 'کفایة الاصول', credits: 10, orderIndex: 2 },
  { subjectTitle: 'اصول فقه', title: 'حلقه ثالثه', credits: 6, orderIndex: 3 },
  { subjectTitle: 'اصول فقه', title: 'اصول فقه مظفر', credits: 6, orderIndex: 4 },

  // فقه
  { subjectTitle: 'فقه', title: 'مکاسب (محرمه / بیع / خیارات)', credits: 12, orderIndex: 1 },
  { subjectTitle: 'فقه', title: 'شرح لمعه (الروضة البهية)', credits: 10, orderIndex: 2 },
  { subjectTitle: 'فقه', title: 'عروة الوثقی', credits: 8, orderIndex: 3 },

  // فلسفه
  { subjectTitle: 'فلسفه', title: 'بدایة الحکمة', credits: 4, orderIndex: 1 },
  { subjectTitle: 'فلسفه', title: 'نهایة الحکمة', credits: 6, orderIndex: 2 },
];

export const DEFAULT_CURRICULUM_CHAPTERS: { bookTitle: string; title: string; credits: number; orderIndex: number }[] = [
  // رسائل
  { bookTitle: 'رسائل (فرائد الاصول)', title: 'بخش قطع و ظن', credits: 3, orderIndex: 1 },
  { bookTitle: 'رسائل (فرائد الاصول)', title: 'بخش اصول عملیه (استصحاب)', credits: 3, orderIndex: 2 },
  { bookTitle: 'رسائل (فرائد الاصول)', title: 'بخش تعادل و تراجیح', credits: 2, orderIndex: 3 },

  // کفایة الاصول
  { bookTitle: 'کفایة الاصول', title: 'جلد اول (مباحث الفاظ)', credits: 5, orderIndex: 1 },
  { bookTitle: 'کفایة الاصول', title: 'جلد دوم (مباحث ملازمات و امارات)', credits: 5, orderIndex: 2 },

  // مکاسب
  { bookTitle: 'مکاسب (محرمه / بیع / خیارات)', title: 'بخش مکاسب محرمه', credits: 4, orderIndex: 1 },
  { bookTitle: 'مکاسب (محرمه / بیع / خیارات)', title: 'بخش کتاب البيع', credits: 4, orderIndex: 2 },
  { bookTitle: 'مکاسب (محرمه / بیع / خیارات)', title: 'بخش خیارات و شروط', credits: 4, orderIndex: 3 },

  // شرح لمعه
  { bookTitle: 'شرح لمعه (الروضة البهية)', title: 'جلد اول (عبادات)', credits: 5, orderIndex: 1 },
  { bookTitle: 'شرح لمعه (الروضة البهية)', title: 'جلد دوم (معاملات)', credits: 5, orderIndex: 2 },

  // بدایة الحکمة
  { bookTitle: 'بدایة الحکمة', title: 'بخش اول (مراحل ۱ تا ۶)', credits: 2, orderIndex: 1 },
  { bookTitle: 'بدایة الحکمة', title: 'بخش دوم (مراحل ۷ تا ۱۲)', credits: 2, orderIndex: 2 },
];

export class StudentCourseProgressService {
  /**
   * Seeds initial default curriculum if database tables are empty
   */
  static async ensureDefaultCurriculumData(): Promise<{
    subjects: CurriculumSubject[];
    books: CurriculumBook[];
    chapters: CurriculumChapter[];
  }> {
    let subjects = await localDb.getDocs<CurriculumSubject>('curriculum_subjects');
    let books = await localDb.getDocs<CurriculumBook>('curriculum_books');
    let chapters = await localDb.getDocs<CurriculumChapter>('curriculum_chapters');

    if (subjects.length === 0) {
      console.log('Seeding default curriculum subjects...');
      for (const s of DEFAULT_CURRICULUM_SUBJECTS) {
        const doc: CurriculumSubject = {
          id: `subj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          ...s,
          createdAt: new Date().toISOString()
        };
        await localDb.setDoc('curriculum_subjects', doc);
      }
      subjects = await localDb.getDocs<CurriculumSubject>('curriculum_subjects');
    }

    if (books.length === 0) {
      console.log('Seeding default curriculum books...');
      for (const b of DEFAULT_CURRICULUM_BOOKS) {
        const parentSubj = subjects.find(s => s.title === b.subjectTitle) || subjects[0];
        if (parentSubj) {
          const doc: CurriculumBook = {
            id: `book_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            subjectId: parentSubj.id,
            subjectTitle: parentSubj.title,
            title: b.title,
            credits: b.credits,
            orderIndex: b.orderIndex,
            createdAt: new Date().toISOString()
          };
          await localDb.setDoc('curriculum_books', doc);
        }
      }
      books = await localDb.getDocs<CurriculumBook>('curriculum_books');
    }

    if (chapters.length === 0) {
      console.log('Seeding default curriculum chapters...');
      for (const ch of DEFAULT_CURRICULUM_CHAPTERS) {
        const parentBook = books.find(b => b.title === ch.bookTitle);
        if (parentBook) {
          const doc: CurriculumChapter = {
            id: `chap_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            bookId: parentBook.id,
            bookTitle: parentBook.title,
            subjectId: parentBook.subjectId,
            subjectTitle: parentBook.subjectTitle,
            title: ch.title,
            credits: ch.credits,
            orderIndex: ch.orderIndex,
            createdAt: new Date().toISOString()
          };
          await localDb.setDoc('curriculum_chapters', doc);
        }
      }
      chapters = await localDb.getDocs<CurriculumChapter>('curriculum_chapters');
    }

    return { subjects, books, chapters };
  }

  /**
   * Syncs course progress status when students are enrolled into or disenrolled from a class/program.
   * 
   * Rule 1: Enrolling a student into a program sets their progress for that chapter to 'in_progress' (🔵 دایره آبی).
   * Rule 2: Disenrolling/removing a student reverts their progress for that chapter back to 'remaining' (🔴 ضربدر قرمز),
   * UNLESS the course was already manually marked as 'passed' (🟢 گذرانده شده) by Education Manager.
   */
  static async syncProgramEnrollmentProgress(
    program: Program,
    enrolledStudentIds: string[],
    previousStudentIds: string[] = []
  ): Promise<void> {
    if (!program || program.type !== 'اصلی' || !program.subjectBook) {
      return;
    }

    const { subjects, books, chapters } = await this.ensureDefaultCurriculumData();

    // Match book and chapter for this program
    let matchedBook = books.find(b => 
      b.title.trim() === (program.subjectBook || '').trim() ||
      (program.subjectBook && b.title.includes(program.subjectBook))
    );

    let matchedChapter: CurriculumChapter | undefined;
    if (program.subjectChapter) {
      matchedChapter = chapters.find(c => 
        (matchedBook ? c.bookId === matchedBook.id : true) &&
        (c.title.trim() === program.subjectChapter?.trim() || c.title.includes(program.subjectChapter || ''))
      );
    } else if (matchedBook) {
      // Fallback: match first chapter of that book
      matchedChapter = chapters.find(c => c.bookId === matchedBook.id);
    }

    if (!matchedBook && matchedChapter) {
      matchedBook = books.find(b => b.id === matchedChapter?.bookId);
    }

    if (!matchedBook || !matchedChapter) {
      console.log('No exact curriculum bank chapter matched for program:', program.title);
      return;
    }

    const allProgressRecords = await localDb.getDocs<StudentCourseProgress>('student_course_progress');

    // 1. Enrolled Students -> Set status = 'in_progress'
    for (const sid of enrolledStudentIds) {
      if (!sid) continue;
      const progressId = `progress_${sid}_${matchedChapter.id}`;
      const existing = allProgressRecords.find(p => p.id === progressId || (p.studentId === sid && p.chapterId === matchedChapter!.id));

      if (existing) {
        // Only update if not already marked 'passed' by Education Manager
        if (existing.status !== 'passed') {
          await localDb.setDoc('student_course_progress', {
            ...existing,
            status: 'in_progress',
            programId: program.id,
            updatedAt: new Date().toISOString()
          });
        }
      } else {
        const newRecord: StudentCourseProgress = {
          id: progressId,
          studentId: sid,
          subjectId: matchedBook.subjectId,
          subjectTitle: matchedBook.subjectTitle,
          bookId: matchedBook.id,
          bookTitle: matchedBook.title,
          chapterId: matchedChapter.id,
          chapterTitle: matchedChapter.title,
          status: 'in_progress',
          programId: program.id,
          updatedAt: new Date().toISOString()
        };
        await localDb.setDoc('student_course_progress', newRecord);
      }
    }

    // 2. Removed / Disenrolled Students -> Revert status = 'remaining' (unless 'passed')
    const removedStudentIds = previousStudentIds.filter(id => !enrolledStudentIds.includes(id));
    for (const sid of removedStudentIds) {
      if (!sid) continue;
      const progressId = `progress_${sid}_${matchedChapter.id}`;
      const existing = allProgressRecords.find(p => p.id === progressId || (p.studentId === sid && p.chapterId === matchedChapter!.id));

      if (existing && existing.status === 'in_progress') {
        await localDb.setDoc('student_course_progress', {
          ...existing,
          status: 'remaining',
          programId: undefined,
          updatedAt: new Date().toISOString()
        });
      }
    }
  }
}
