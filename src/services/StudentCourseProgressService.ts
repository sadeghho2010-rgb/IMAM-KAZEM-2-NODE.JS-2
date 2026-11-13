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
   * Fetches current curriculum subjects, books, and chapters from localDb (synced with MySQL cloud)
   */
  static async ensureDefaultCurriculumData(forceCloudSync = false): Promise<{
    subjects: CurriculumSubject[];
    books: CurriculumBook[];
    chapters: CurriculumChapter[];
  }> {
    let [subjects, books, chapters] = await Promise.all([
      localDb.getDocs<CurriculumSubject>('curriculum_subjects'),
      localDb.getDocs<CurriculumBook>('curriculum_books'),
      localDb.getDocs<CurriculumChapter>('curriculum_chapters')
    ]);

    if (forceCloudSync || subjects.length === 0 || books.length === 0) {
      try {
        await Promise.all([
          localDb.syncCollectionFromCloud('curriculum_subjects', forceCloudSync),
          localDb.syncCollectionFromCloud('curriculum_books', forceCloudSync),
          localDb.syncCollectionFromCloud('curriculum_chapters', forceCloudSync)
        ]);
        [subjects, books, chapters] = await Promise.all([
          localDb.getDocs<CurriculumSubject>('curriculum_subjects'),
          localDb.getDocs<CurriculumBook>('curriculum_books'),
          localDb.getDocs<CurriculumChapter>('curriculum_chapters')
        ]);
      } catch (e) {}
    }

    // Normalize legacy 'اصول فقه' to 'اصول' so it never collides with 'فقه'
    for (const s of subjects) {
      if ((s.title || '').trim() === 'اصول فقه') {
        s.title = 'اصول';
        await localDb.setDoc('curriculum_subjects', { ...s, title: 'اصول' });
      }
    }

    // Ensure core subjects ('اصول', 'فقه', 'فلسفه') exist if the bank is completely empty
    if (subjects.length === 0) {
      const baseSubjects: CurriculumSubject[] = [
        { id: 'subj_osool', title: 'اصول', orderIndex: 1 },
        { id: 'subj_feqh', title: 'فقه', orderIndex: 2 },
        { id: 'subj_falsafeh', title: 'فلسفه', orderIndex: 3 }
      ];
      for (const bs of baseSubjects) {
        await localDb.setDoc('curriculum_subjects', bs);
      }
      subjects = baseSubjects;
    }

    // Deduplicate subjects by clean title
    const seenSubjects = new Map<string, CurriculumSubject>();
    for (const s of subjects) {
      const cleanTitle = (s.title || '').trim();
      if (!cleanTitle) continue;
      if (seenSubjects.has(cleanTitle)) {
        await localDb.deleteDoc('curriculum_subjects', s.id);
      } else {
        seenSubjects.set(cleanTitle, s);
      }
    }
    subjects = Array.from(seenSubjects.values()).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    // Normalize books subjectId/subjectTitle to match canonical subjects and deduplicate
    const seenBooks = new Map<string, CurriculumBook>();
    for (const b of books) {
      let cleanSubjTitle = (b.subjectTitle || '').trim();
      if (cleanSubjTitle === 'اصول فقه') cleanSubjTitle = 'اصول';
      const matchedSubj = seenSubjects.get(cleanSubjTitle) || subjects.find(s => s.id === b.subjectId);
      const canonicalSubjTitle = matchedSubj ? matchedSubj.title.trim() : cleanSubjTitle;
      const canonicalSubjId = matchedSubj ? matchedSubj.id : b.subjectId;

      if (b.subjectTitle !== canonicalSubjTitle || b.subjectId !== canonicalSubjId) {
        b.subjectTitle = canonicalSubjTitle;
        b.subjectId = canonicalSubjId;
        await localDb.setDoc('curriculum_books', { ...b, subjectTitle: canonicalSubjTitle, subjectId: canonicalSubjId });
      }

      const key = `${canonicalSubjTitle}_${(b.title || '').trim()}`;
      if (seenBooks.has(key)) {
        await localDb.deleteDoc('curriculum_books', b.id);
      } else {
        seenBooks.set(key, b);
      }
    }
    books = Array.from(seenBooks.values()).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    // Deduplicate chapters and ensure bookId/bookTitle link cleanly
    const seenChapters = new Map<string, CurriculumChapter>();
    for (const ch of chapters) {
      const matchedBook = books.find(b => b.id === ch.bookId) || books.find(b => (b.title || '').trim() === (ch.bookTitle || '').trim());
      if (matchedBook && (ch.bookId !== matchedBook.id || ch.bookTitle !== matchedBook.title)) {
        ch.bookId = matchedBook.id;
        ch.bookTitle = matchedBook.title;
        await localDb.setDoc('curriculum_chapters', { ...ch, bookId: matchedBook.id, bookTitle: matchedBook.title });
      }
      const key = `${ch.bookId || (ch.bookTitle || '').trim()}_${(ch.title || '').trim()}`;
      if (seenChapters.has(key)) {
        await localDb.deleteDoc('curriculum_chapters', ch.id);
      } else {
        seenChapters.set(key, ch);
      }
    }
    chapters = Array.from(seenChapters.values()).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

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
   * Resolves the canonical CurriculumSubject, CurriculumBook, and CurriculumChapter for a given Program
   */
  static resolveProgramCurriculumTarget(
    program: Program,
    subjects: CurriculumSubject[],
    books: CurriculumBook[],
    chapters: CurriculumChapter[]
  ): {
    resolvedSubjectId: string;
    resolvedSubjectTitle: string;
    resolvedBookId: string;
    resolvedBookTitle: string;
    resolvedChapterId: string;
    resolvedChapterTitle: string;
  } {
    const catKey = ((program.subjectCategory as string) || '').trim() === 'اصول فقه'
      ? 'اصول'
      : ((program.subjectCategory as string) || '').trim();
    const bookKey = (program.subjectBook || '').trim();
    const chapterKey = (program.subjectChapter || '').trim();
    const programTitle = (program.title || '').trim();

    let matchedChapter: CurriculumChapter | undefined;
    if (program.chapterId) {
      matchedChapter = chapters.find(c => c.id === program.chapterId);
    }

    let matchedBook: CurriculumBook | undefined;
    if (matchedChapter) {
      matchedBook = books.find(b => b.id === matchedChapter!.bookId);
    }
    if (!matchedBook && bookKey) {
      matchedBook = books.find(b =>
        b.title.trim() === bookKey &&
        (!catKey || (b.subjectTitle || '').trim() === catKey)
      ) || books.find(b => b.title.trim() === bookKey);
    }
    if (!matchedBook && programTitle) {
      matchedBook = books.find(b =>
        b.title.trim() && (programTitle.includes(b.title.trim()) || b.title.trim() === programTitle)
      );
    }
    if (!matchedChapter && chapterKey) {
      matchedChapter = chapters.find(c =>
        (matchedBook ? c.bookId === matchedBook.id : true) &&
        c.title.trim() === chapterKey
      ) || chapters.find(c =>
        (matchedBook ? c.bookId === matchedBook.id : true) &&
        (c.title.trim().includes(chapterKey) || chapterKey.includes(c.title.trim()))
      );
    }
    if (!matchedChapter && programTitle) {
      matchedChapter = chapters.find(c =>
        (matchedBook ? c.bookId === matchedBook.id : true) &&
        c.title.trim() &&
        (programTitle === c.title.trim() || programTitle.includes(c.title.trim()) || c.title.trim().includes(programTitle))
      );
    }
    if (!matchedBook && matchedChapter) {
      matchedBook = books.find(b => b.id === matchedChapter!.bookId);
    }
    if (!matchedChapter && matchedBook && chapters.filter(c => c.bookId === matchedBook!.id).length === 1) {
      matchedChapter = chapters.find(c => c.bookId === matchedBook!.id);
    }

    const matchedSubj = subjects.find(s =>
      (matchedBook && (s.id === matchedBook.subjectId || s.title.trim() === (matchedBook.subjectTitle || '').trim())) ||
      (catKey && s.title.trim() === catKey)
    );

    const resolvedSubjectTitle = matchedSubj?.title || matchedBook?.subjectTitle || catKey || 'دروس اصلی';
    const resolvedSubjectId = matchedSubj?.id || matchedBook?.subjectId || `subj_${resolvedSubjectTitle}`;
    const resolvedBookTitle = matchedBook?.title || bookKey || programTitle;
    const resolvedBookId = matchedBook?.id || `book_${resolvedBookTitle}`;
    const resolvedChapterTitle = matchedChapter?.title || chapterKey || programTitle;
    const resolvedChapterId = matchedChapter?.id || program.chapterId || `chap_${program.id}`;

    return {
      resolvedSubjectId,
      resolvedSubjectTitle,
      resolvedBookId,
      resolvedBookTitle,
      resolvedChapterId,
      resolvedChapterTitle
    };
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

    const { subjects, books, chapters } = await this.ensureDefaultCurriculumData(false);
    const {
      resolvedSubjectId,
      resolvedSubjectTitle,
      resolvedBookId,
      resolvedBookTitle,
      resolvedChapterId,
      resolvedChapterTitle
    } = this.resolveProgramCurriculumTarget(program, subjects, books, chapters);

    const allProgressRecords = await localDb.getDocs<StudentCourseProgress>('student_course_progress');
    const cleanEnrolledIds = Array.from(new Set((enrolledStudentIds || []).map(id => String(id).trim()).filter(Boolean)));
    const cleanEnrolledSet = new Set(cleanEnrolledIds);

    // 1. Enrolled Students -> Set status = 'in_progress'
    for (const sid of cleanEnrolledIds) {
      const progressId = `progress_${sid}_${resolvedChapterId}`;
      const existing = allProgressRecords.find(p => 
        p.id === progressId || 
        (p.studentId === sid && (p.chapterId === resolvedChapterId || p.programId === program.id))
      );

      if (existing) {
        if (existing.status !== 'passed') {
          const needsUpdate = existing.status !== 'in_progress' || 
                              existing.programId !== program.id ||
                              existing.chapterId !== resolvedChapterId ||
                              existing.chapterTitle !== resolvedChapterTitle ||
                              existing.bookTitle !== resolvedBookTitle;
          if (needsUpdate) {
            await localDb.setDoc('student_course_progress', {
              ...existing,
              status: 'in_progress',
              programId: program.id,
              subjectId: resolvedSubjectId,
              subjectTitle: resolvedSubjectTitle,
              bookId: resolvedBookId,
              bookTitle: resolvedBookTitle,
              chapterId: resolvedChapterId,
              chapterTitle: resolvedChapterTitle,
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
    const candidateRemovedIds = new Set<string>(
      (previousStudentIds || []).map(id => String(id).trim()).filter(id => id && !cleanEnrolledSet.has(id))
    );
    allProgressRecords.forEach(p => {
      if (
        p.status === 'in_progress' &&
        (p.programId === program.id || p.chapterId === resolvedChapterId || (resolvedChapterTitle && p.chapterTitle === resolvedChapterTitle)) &&
        !cleanEnrolledSet.has(String(p.studentId).trim())
      ) {
        candidateRemovedIds.add(String(p.studentId).trim());
      }
    });

    for (const sid of candidateRemovedIds) {
      if (!sid) continue;
      const progressId = `progress_${sid}_${resolvedChapterId}`;
      const existing = allProgressRecords.find(p => 
        p.id === progressId || 
        (p.studentId === sid && (p.chapterId === resolvedChapterId || p.programId === program.id || (resolvedChapterTitle && p.chapterTitle === resolvedChapterTitle)))
      );

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

  private static isSyncingAll = false;

  /**
   * Complete synchronization of all active main programs with student course progress.
   * Single source of truth is active school programs (`programs`) and their explicitly enrolled `studentIds`.
   */
  static async syncAllProgramsWithCourseProgress(): Promise<void> {
    if (this.isSyncingAll) return;
    this.isSyncingAll = true;

    try {
      const [{ subjects, books, chapters }, allPrograms, allEnrollments] = await Promise.all([
        this.ensureDefaultCurriculumData(false),
        localDb.getDocs<Program>('programs'),
        localDb.getDocs<any>('enrollments')
      ]);

      const activeMainPrograms = (allPrograms || []).filter(p => 
        p &&
        p.type === 'اصلی' && 
        p.status !== 'deleted' && 
        p.status !== 'inactive' &&
        !p.isDeleted
      );

      // Map active program enrolled students and resolved chapter IDs/titles
      const programStudentMap = new Map<string, Set<string>>();
      const programChapterMap = new Map<string, { chapterId: string; chapterTitle: string }>();

      for (const prog of activeMainPrograms) {
        const enrolledStudentIds = new Set<string>();

        // Authoritative source: prog.studentIds (if defined on program, even if empty array [])
        if (Array.isArray(prog.studentIds)) {
          prog.studentIds.forEach(id => {
            if (id) enrolledStudentIds.add(String(id).trim());
          });
        } else {
          // Legacy fallback only when prog.studentIds is undefined
          (allEnrollments || [])
            .filter(e => String(e.programId) === String(prog.id) && e.status !== 'cancelled' && e.status !== 'deleted')
            .forEach(e => {
              if (e.studentId) enrolledStudentIds.add(String(e.studentId).trim());
            });
        }

        programStudentMap.set(prog.id, enrolledStudentIds);
        const resolved = this.resolveProgramCurriculumTarget(prog, subjects, books, chapters);
        programChapterMap.set(prog.id, {
          chapterId: resolved.resolvedChapterId,
          chapterTitle: resolved.resolvedChapterTitle
        });

        const existingProgress = await localDb.getDocs<StudentCourseProgress>('student_course_progress');
        const prevEnrolled = existingProgress
          .filter(p => (p.programId === prog.id || p.chapterId === resolved.resolvedChapterId || p.chapterTitle === resolved.resolvedChapterTitle) && p.status === 'in_progress')
          .map(p => p.studentId);

        await this.syncProgramEnrollmentProgress(prog, Array.from(enrolledStudentIds), prevEnrolled);
      }

      // Re-check all in_progress records to ensure ANY student removed from a class or from a deleted/inactive class immediately reverts to 'remaining'
      const allProgressRecords = await localDb.getDocs<StudentCourseProgress>('student_course_progress');
      for (const rec of allProgressRecords) {
        if (rec.status === 'in_progress') {
          let isStillEnrolled = false;

          for (const prog of activeMainPrograms) {
            const enrolledSet = programStudentMap.get(prog.id);
            const progChap = programChapterMap.get(prog.id);
            if (enrolledSet && enrolledSet.has(String(rec.studentId).trim())) {
              if (
                rec.programId === prog.id ||
                (progChap && rec.chapterId === progChap.chapterId) ||
                (progChap && progChap.chapterTitle && rec.chapterTitle === progChap.chapterTitle) ||
                (prog.chapterId && rec.chapterId === prog.chapterId)
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
