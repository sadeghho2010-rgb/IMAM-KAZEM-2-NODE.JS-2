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
  { title: 'اصول', code: 'USUL', description: 'مبانی، مباحث الفاظ و ادله عقلية و شرعیة', color: 'indigo', orderIndex: 1 },
  { title: 'فقه', code: 'FIQH', description: 'ابواب فقهی عبادات، معاملات و احکام', color: 'emerald', orderIndex: 2 },
  { title: 'فلسفه', code: 'PHIL', description: 'حکمت متعالیه و فلسفه اسلامی', color: 'amber', orderIndex: 3 },
];

export const DEFAULT_CURRICULUM_BOOKS: { subjectTitle: string; title: string; credits: number; orderIndex: number }[] = [
  // اصول
  { subjectTitle: 'اصول', title: 'رسائل', credits: 1, orderIndex: 1 },
  { subjectTitle: 'اصول', title: 'کفایة الاصول', credits: 1, orderIndex: 2 },
  { subjectTitle: 'اصول', title: 'حلقه ثالثه', credits: 1, orderIndex: 3 },
  { subjectTitle: 'اصول', title: 'اصول فقه مظفر', credits: 1, orderIndex: 4 },

  // فقه
  { subjectTitle: 'فقه', title: 'مکاسب', credits: 1, orderIndex: 1 },
  { subjectTitle: 'فقه', title: 'شرح لمعه', credits: 1, orderIndex: 2 },
  { subjectTitle: 'فقه', title: 'عروة الوثقی', credits: 1, orderIndex: 3 },

  // فلسفه
  { subjectTitle: 'فلسفه', title: 'بدایة الحکمة', credits: 1, orderIndex: 1 },
  { subjectTitle: 'فلسفه', title: 'نهایة الحکمة', credits: 1, orderIndex: 2 },
];

export const DEFAULT_CURRICULUM_CHAPTERS: { bookTitle: string; title: string; credits: number; orderIndex: number }[] = [
  // رسائل
  { bookTitle: 'رسائل', title: 'قطع و ظن', credits: 1, orderIndex: 1 },
  { bookTitle: 'رسائل', title: 'استصحاب', credits: 1, orderIndex: 2 },
  { bookTitle: 'رسائل', title: 'تعادل و تراجیح', credits: 1, orderIndex: 3 },

  // کفایة الاصول
  { bookTitle: 'کفایة الاصول', title: 'مباحث الفاظ', credits: 1, orderIndex: 1 },
  { bookTitle: 'کفایة الاصول', title: 'مباحث امارات و اصول عملیه', credits: 1, orderIndex: 2 },

  // مکاسب
  { bookTitle: 'مکاسب', title: 'مکاسب محرمه', credits: 1, orderIndex: 1 },
  { bookTitle: 'مکاسب', title: 'کتاب البيع', credits: 1, orderIndex: 2 },
  { bookTitle: 'مکاسب', title: 'خیارات', credits: 1, orderIndex: 3 },

  // شرح لمعه
  { bookTitle: 'شرح لمعه', title: 'عبادات', credits: 1, orderIndex: 1 },
  { bookTitle: 'شرح لمعه', title: 'معاملات', credits: 1, orderIndex: 2 },

  // بدایة الحکمة
  { bookTitle: 'بدایة الحکمة', title: 'مراحل ۱ تا ۶', credits: 1, orderIndex: 1 },
  { bookTitle: 'بدایة الحکمة', title: 'مراحل ۷ تا ۱۲', credits: 1, orderIndex: 2 },
];

export class StudentCourseProgressService {
  /**
   * Seeds initial default curriculum if database tables are empty and cleans up invalid subjects/duplicates
   */
  static async ensureDefaultCurriculumData(): Promise<{
    subjects: CurriculumSubject[];
    books: CurriculumBook[];
    chapters: CurriculumChapter[];
  }> {
    let subjects = await localDb.getDocs<CurriculumSubject>('curriculum_subjects');
    let books = await localDb.getDocs<CurriculumBook>('curriculum_books');
    let chapters = await localDb.getDocs<CurriculumChapter>('curriculum_chapters');

    // 1. Seed default subjects ONLY if curriculum_subjects table is completely empty
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

    // Deduplicate subjects by clean title
    const seenSubjects = new Map<string, CurriculumSubject>();
    for (const s of subjects) {
      const cleanTitle = (s.title || '').trim();
      if (seenSubjects.has(cleanTitle)) {
        await localDb.deleteDoc('curriculum_subjects', s.id);
      } else {
        seenSubjects.set(cleanTitle, s);
      }
    }
    subjects = Array.from(seenSubjects.values());

    // 2. Seed default books ONLY if curriculum_books table is completely empty
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
            credits: 1,
            orderIndex: b.orderIndex,
            createdAt: new Date().toISOString()
          };
          await localDb.setDoc('curriculum_books', doc);
        }
      }
      books = await localDb.getDocs<CurriculumBook>('curriculum_books');
    }

    // Deduplicate books
    const seenBooks = new Map<string, CurriculumBook>();
    for (const b of books) {
      const key = `${(b.subjectTitle || '').trim()}_${(b.title || '').trim()}`;
      if (seenBooks.has(key)) {
        await localDb.deleteDoc('curriculum_books', b.id);
      } else {
        seenBooks.set(key, b);
      }
    }
    books = Array.from(seenBooks.values());

    // 3. Seed default chapters ONLY if curriculum_chapters table is completely empty
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
            credits: 1,
            orderIndex: ch.orderIndex,
            createdAt: new Date().toISOString()
          };
          await localDb.setDoc('curriculum_chapters', doc);
        }
      }
      chapters = await localDb.getDocs<CurriculumChapter>('curriculum_chapters');
    }

    // Deduplicate chapters
    const seenChapters = new Map<string, CurriculumChapter>();
    for (const ch of chapters) {
      const key = `${(ch.bookTitle || '').trim()}_${(ch.title || '').trim()}`;
      if (seenChapters.has(key)) {
        await localDb.deleteDoc('curriculum_chapters', ch.id);
      } else {
        seenChapters.set(key, ch);
      }
    }
    chapters = Array.from(seenChapters.values());

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
