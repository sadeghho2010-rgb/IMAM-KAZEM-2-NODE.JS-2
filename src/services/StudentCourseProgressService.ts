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
export const DEFAULT_CURRICULUM_SUBJECTS: Omit<CurriculumSubject, 'id'>[] = [];

export const DEFAULT_CURRICULUM_BOOKS: { subjectTitle: string; title: string; credits: number; orderIndex: number }[] = [];

export const DEFAULT_CURRICULUM_CHAPTERS: { bookTitle: string; title: string; credits: number; orderIndex: number }[] = [];

export class StudentCourseProgressService {
  /**
   * Fetches current curriculum subjects, books, and chapters from localDb
   */
  static async ensureDefaultCurriculumData(): Promise<{
    subjects: CurriculumSubject[];
    books: CurriculumBook[];
    chapters: CurriculumChapter[];
  }> {
    let subjects = await localDb.getDocs<CurriculumSubject>('curriculum_subjects');
    let books = await localDb.getDocs<CurriculumBook>('curriculum_books');
    let chapters = await localDb.getDocs<CurriculumChapter>('curriculum_chapters');

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
   * Completely purges all curriculum subjects, books, chapters, and student course progress from the database
   */
  static async clearAllCurriculumBankData(): Promise<void> {
    const [subs, bks, chs, progs] = await Promise.all([
      localDb.getDocs<CurriculumSubject>('curriculum_subjects'),
      localDb.getDocs<CurriculumBook>('curriculum_books'),
      localDb.getDocs<CurriculumChapter>('curriculum_chapters'),
      localDb.getDocs<StudentCourseProgress>('student_course_progress'),
    ]);

    for (const s of subs) { await localDb.deleteDoc('curriculum_subjects', s.id); }
    for (const b of bks) { await localDb.deleteDoc('curriculum_books', b.id); }
    for (const c of chs) { await localDb.deleteDoc('curriculum_chapters', c.id); }
    for (const p of progs) { await localDb.deleteDoc('student_course_progress', p.id); }
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
