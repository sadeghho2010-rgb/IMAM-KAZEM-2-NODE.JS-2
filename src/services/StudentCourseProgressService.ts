import { localDb } from '../lib/localDb';
import { 
  CurriculumSubject, 
  CurriculumBook, 
  CurriculumChapter, 
  StudentCourseProgress,
  Program,
  Student 
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
    if (!program || program.type !== 'اصلی') {
      return;
    }

    const { subjects, books, chapters } = await this.ensureDefaultCurriculumData();

    const bookKey = (program.subjectBook || '').trim();
    const chapterKey = (program.subjectChapter || '').trim();
    const programTitle = (program.title || '').trim();

    // Match book for this program (by subjectBook or title)
    let matchedBook = books.find(b => 
      (bookKey && b.title.trim() === bookKey) ||
      (bookKey && b.title.includes(bookKey)) ||
      (bookKey && bookKey.includes(b.title.trim())) ||
      (programTitle && (programTitle.includes(b.title.trim()) || b.title.trim().includes(programTitle)))
    );

    let matchedChapter: CurriculumChapter | undefined;
    if (chapterKey) {
      matchedChapter = chapters.find(c => 
        (matchedBook ? c.bookId === matchedBook.id : true) &&
        (c.title.trim() === chapterKey || c.title.includes(chapterKey) || chapterKey.includes(c.title.trim()))
      );
    } else if (matchedBook) {
      matchedChapter = chapters.find(c => c.bookId === matchedBook.id);
    } else if (program.chapterId) {
      matchedChapter = chapters.find(c => c.id === program.chapterId);
    } else {
      matchedChapter = chapters.find(c => programTitle && (programTitle.includes(c.title.trim()) || c.title.trim().includes(programTitle)));
    }

    if (!matchedBook && matchedChapter) {
      matchedBook = books.find(b => b.id === matchedChapter?.bookId);
    }

    // Determine canonical identities so all active main classes are consistently tracked
    const resolvedSubjectTitle = matchedBook?.subjectTitle || program.subjectCategory || 'دروس اصلی';
    const resolvedSubjectId = matchedBook?.subjectId || `subj_${resolvedSubjectTitle}`;
    const resolvedBookTitle = matchedBook?.title || program.subjectBook || program.title;
    const resolvedBookId = matchedBook?.id || `book_${resolvedBookTitle}`;
    const resolvedChapterTitle = matchedChapter?.title || program.subjectChapter || program.title;
    const resolvedChapterId = matchedChapter?.id || program.chapterId || `chap_${program.id}`;

    const allProgressRecords = await localDb.getDocs<StudentCourseProgress>('student_course_progress');

    // 1. Enrolled Students -> Set status = 'in_progress'
    for (const sid of enrolledStudentIds) {
      if (!sid) continue;
      const progressId = `progress_${sid}_${resolvedChapterId}`;
      const existing = allProgressRecords.find(p => 
        p.id === progressId || 
        (p.studentId === sid && (p.chapterId === resolvedChapterId || p.chapterTitle === resolvedChapterTitle || p.programId === program.id))
      );

      if (existing) {
        // Only update if not already marked 'passed' by Education Manager
        if (existing.status !== 'passed') {
          const needsUpdate = existing.status !== 'in_progress' || 
                              existing.programId !== program.id ||
                              existing.chapterTitle !== resolvedChapterTitle ||
                              existing.bookTitle !== resolvedBookTitle;
          if (needsUpdate) {
            await localDb.setDoc('student_course_progress', {
              ...existing,
              status: 'in_progress',
              programId: program.id,
              chapterTitle: resolvedChapterTitle,
              bookTitle: resolvedBookTitle,
              subjectTitle: resolvedSubjectTitle,
              updatedAt: new Date().toISOString()
            });
          }
        }
      } else {
        const newRecord: StudentCourseProgress = {
          id: progressId,
          studentId: sid,
          subjectId: resolvedSubjectId,
          subjectTitle: resolvedSubjectTitle,
          bookId: resolvedBookId,
          bookTitle: resolvedBookTitle,
          chapterId: resolvedChapterId,
          chapterTitle: resolvedChapterTitle,
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
      const progressId = `progress_${sid}_${resolvedChapterId}`;
      const existing = allProgressRecords.find(p => 
        p.id === progressId || 
        (p.studentId === sid && (p.chapterId === resolvedChapterId || p.chapterTitle === resolvedChapterTitle || p.programId === program.id))
      );

      if (existing && existing.status === 'in_progress' && (existing.programId === program.id || existing.chapterId === resolvedChapterId)) {
        await localDb.setDoc('student_course_progress', {
          ...existing,
          status: 'remaining',
          programId: undefined,
          updatedAt: new Date().toISOString()
        });
      }
    }
  }

  private static isSyncingAll = false;

  /**
   * Complete synchronization of all active main programs with student course progress.
   * Single source of truth is active school programs and their enrolled students.
   */
  static async syncAllProgramsWithCourseProgress(): Promise<void> {
    if (this.isSyncingAll) return;
    this.isSyncingAll = true;

    try {
      const [allPrograms, allStudents, allEnrollments, allCourseEnrollments] = await Promise.all([
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<Student>('students'),
        localDb.getDocs<any>('enrollments'),
        localDb.getDocs<any>('course_enrollments')
      ]);

      const activeMainPrograms = (allPrograms || []).filter(p => 
        p.type === 'اصلی' && 
        p.status !== 'deleted' && 
        !p.isDeleted
      );

      // Map active program enrolled students
      const programStudentMap = new Map<string, Set<string>>();

      for (const prog of activeMainPrograms) {
        const enrolledStudentIds = new Set<string>();

        if (Array.isArray(prog.studentIds) && prog.studentIds.length > 0) {
          prog.studentIds.forEach(id => enrolledStudentIds.add(String(id)));
        }

        (allEnrollments || [])
          .filter(e => String(e.programId) === String(prog.id))
          .forEach(e => enrolledStudentIds.add(String(e.studentId)));

        (allCourseEnrollments || [])
          .filter(e => String(e.programId) === String(prog.id))
          .forEach(e => enrolledStudentIds.add(String(e.studentId)));

        const hasExplicit = prog.hasExplicitEnrollment || 
          (Array.isArray(prog.studentIds) && prog.studentIds.length > 0) || 
          (allEnrollments || []).some(e => String(e.programId) === String(prog.id));

        if (!hasExplicit && enrolledStudentIds.size === 0) {
          (allStudents || [])
            .filter(s => (s.isActive !== false) && (s.grade === prog.grade || prog.grade === 'همه پایه‌ها'))
            .forEach(s => enrolledStudentIds.add(String(s.id)));
        }

        programStudentMap.set(prog.id, enrolledStudentIds);

        // Fetch previous enrolled students from existing progress records to compute removed ones
        const existingProgress = await localDb.getDocs<StudentCourseProgress>('student_course_progress');
        const prevEnrolled = existingProgress
          .filter(p => p.programId === prog.id && p.status === 'in_progress')
          .map(p => p.studentId);

        await this.syncProgramEnrollmentProgress(prog, Array.from(enrolledStudentIds), prevEnrolled);
      }

      // Re-check all in_progress records to ensure no stale in_progress records remain
      const allProgressRecords = await localDb.getDocs<StudentCourseProgress>('student_course_progress');
      for (const rec of allProgressRecords) {
        if (rec.status === 'in_progress') {
          let isStillEnrolled = false;

          for (const prog of activeMainPrograms) {
            const enrolledSet = programStudentMap.get(prog.id);
            if (enrolledSet && enrolledSet.has(rec.studentId)) {
              if (
                rec.programId === prog.id ||
                rec.chapterId === prog.chapterId ||
                (rec.chapterTitle && prog.title && (prog.title.includes(rec.chapterTitle) || rec.chapterTitle.includes(prog.title))) ||
                (rec.bookTitle && prog.title && (prog.title.includes(rec.bookTitle) || rec.bookTitle.includes(prog.title)))
              ) {
                isStillEnrolled = true;
                break;
              }
            }
          }

          if (!isStillEnrolled) {
            await localDb.setDoc('student_course_progress', {
              ...rec,
              status: 'remaining',
              programId: undefined,
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
    } catch (err) {
      console.warn('Error during syncAllProgramsWithCourseProgress:', err);
    } finally {
      this.isSyncingAll = false;
    }
  }
}
