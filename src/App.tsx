/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock,
  BookOpen,
  Target,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  X,
  Flame,
  Timer,
  Download,
  Upload,
  RotateCcw,
  TrendingUp,
  CalendarDays,
  Check,
  AlertCircle,
  LogIn,
  LogOut,
  Cloud,
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  signInWithGoogle,
  signOutUser,
  OperationType,
  handleFirestoreError,
} from './firebase';
import { Subject, StudyLog, LearningGoal, ViewMode } from './types';
import {
  INITIAL_SUBJECTS,
  INITIAL_LOGS,
  INITIAL_GOALS,
  formatLocalDate,
  parseLocalDate,
} from './mockData';
import { PerformanceCharts } from './components/PerformanceCharts';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
}

const VALID_CATEGORIES: Subject['category'][] = [
  'Exatas',
  'Humanas',
  'Linguagens',
  'Tecnologia',
  'Outros',
];

function sanitizeId(raw: string, prefix: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '');
  if (cleaned.length >= 1 && cleaned.length <= 128) return cleaned;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function normalizeHexColor(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#4f46e5';
}

function normalizeDateString(dateStr: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : formatLocalDate(new Date());
}

export default function App() {
  // Firebase Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [asyncError, setAsyncError] = useState<Error | null>(null);

  if (asyncError) {
    throw asyncError;
  }

  // Theme & Data state (synced with Firestore)
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [goals, setGoals] = useState<LearningGoal[]>([]);

  const [activeTab, setActiveTab] = useState<ViewMode>('weekly');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDayStr, setSelectedDayStr] = useState<string>(() =>
    formatLocalDate(new Date())
  );

  // Toast & inline confirmation state
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmDeleteSubjectId, setConfirmDeleteSubjectId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  // Modals state
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  // Log form state
  const [newLogSubject, setNewLogSubject] = useState('');
  const [newLogDate, setNewLogDate] = useState(() => formatLocalDate(new Date()));
  const [newLogHours, setNewLogHours] = useState('1');
  const [newLogMinutes, setNewLogMinutes] = useState('0');
  const [newLogTopics, setNewLogTopics] = useState('');
  const [newLogNotes, setNewLogNotes] = useState('');
  const [newLogGoalsMet, setNewLogGoalsMet] = useState(true);
  const [logFormError, setLogFormError] = useState<string | null>(null);

  // Subject form state
  const [newSubName, setNewSubName] = useState('');
  const [newSubCategory, setNewSubCategory] = useState<Subject['category']>('Exatas');
  const [newSubColor, setNewSubColor] = useState('#4f46e5');
  const [newSubGoalHours, setNewSubGoalHours] = useState('5');

  // Goal form state
  const [newGoalSubject, setNewGoalSubject] = useState('');
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalDate, setNewGoalDate] = useState(() => formatLocalDate(new Date()));

  // Pomodoro state
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroDurationMins, setPomodoroDurationMins] = useState(25);
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(25 * 60);
  const [pomodoroSubjectId, setPomodoroSubjectId] = useState('');
  const [pomodoroMode, setPomodoroMode] = useState<'work' | 'break'>('work');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (message: string, type: ToastState['type'] = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(id);
  }, [toast]);

  // Apply dark mode class to html
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Listen for Firebase Authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setSubjects([]);
        setLogs([]);
        setGoals([]);
        setDataLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Seed initial user profile + sample data on first login, then subscribe in real-time
  useEffect(() => {
    if (!authReady || !user) return;

    let isCancelled = false;
    let unsubProfile: (() => void) | undefined;
    let unsubSubjects: (() => void) | undefined;
    let unsubLogs: (() => void) | undefined;
    let unsubGoals: (() => void) | undefined;

    const uid = user.uid;
    const userDocPath = `users/${uid}`;
    const subjectsPath = `users/${uid}/subjects`;
    const logsPath = `users/${uid}/logs`;
    const goalsPath = `users/${uid}/goals`;

    async function initAndSubscribe() {
      setDataLoading(true);
      setSyncError(null);

      try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          const batch = writeBatch(db);
          const displayName = (user!.displayName || 'Estudante').trim().slice(0, 100) || 'Estudante';

          batch.set(userRef, {
            ownerId: uid,
            displayName,
            theme: darkMode ? 'dark' : 'light',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          INITIAL_SUBJECTS.forEach((sub) => {
            const subRef = doc(db, subjectsPath, sub.id);
            batch.set(subRef, {
              ownerId: uid,
              name: sub.name.slice(0, 100),
              color: normalizeHexColor(sub.color),
              category: sub.category,
              weeklyGoalHours: sub.weeklyGoalHours,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });

          INITIAL_LOGS.forEach((log) => {
            const logRef = doc(db, logsPath, log.id);
            batch.set(logRef, {
              ownerId: uid,
              subjectId: log.subjectId,
              date: normalizeDateString(log.date),
              durationMinutes: Math.min(1440, Math.max(1, log.durationMinutes)),
              topics: log.topics.slice(0, 15).map((t) => t.slice(0, 120)),
              notes: log.notes.slice(0, 1000),
              goalsMet: Boolean(log.goalsMet),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });

          INITIAL_GOALS.forEach((goal) => {
            const goalRef = doc(db, goalsPath, goal.id);
            batch.set(goalRef, {
              ownerId: uid,
              subjectId: goal.subjectId,
              title: goal.title.slice(0, 200),
              targetDate: normalizeDateString(goal.targetDate),
              completed: Boolean(goal.completed),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });

          await batch.commit();
        }
      } catch (error) {
        if (!isCancelled) {
          try {
            handleFirestoreError(error, OperationType.WRITE, userDocPath);
          } catch (wrapped) {
            setAsyncError(wrapped as Error);
          }
        }
        return;
      }

      if (isCancelled) return;

      // Subscribe to User Profile (theme sync)
      unsubProfile = onSnapshot(
        doc(db, 'users', uid),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            if (data.theme === 'dark' || data.theme === 'light') {
              setDarkMode(data.theme === 'dark');
            }
          }
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.GET, userDocPath);
          } catch (wrapped) {
            setAsyncError(wrapped as Error);
          }
        }
      );

      // Subscribe to Subjects
      unsubSubjects = onSnapshot(
        query(collection(db, subjectsPath), where('ownerId', '==', uid)),
        (snapshot) => {
          const list: Subject[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: String(data.name || ''),
              color: normalizeHexColor(String(data.color || '#4f46e5')),
              category: VALID_CATEGORIES.includes(data.category)
                ? data.category
                : 'Outros',
              weeklyGoalHours: Number(data.weeklyGoalHours) || 5,
            };
          });
          setSubjects(list);
          setDataLoading(false);
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.LIST, subjectsPath);
          } catch (wrapped) {
            setAsyncError(wrapped as Error);
          }
        }
      );

      // Subscribe to Study Logs
      unsubLogs = onSnapshot(
        query(collection(db, logsPath), where('ownerId', '==', uid)),
        (snapshot) => {
          const list: StudyLog[] = snapshot.docs
            .map((d) => {
              const data = d.data();
              return {
                id: d.id,
                subjectId: String(data.subjectId || ''),
                date: String(data.date || ''),
                durationMinutes: Number(data.durationMinutes) || 0,
                topics: Array.isArray(data.topics) ? data.topics.map(String) : ['Estudo geral'],
                notes: String(data.notes || ''),
                goalsMet: Boolean(data.goalsMet),
              };
            })
            .sort((a, b) => b.date.localeCompare(a.date));
          setLogs(list);
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.LIST, logsPath);
          } catch (wrapped) {
            setAsyncError(wrapped as Error);
          }
        }
      );

      // Subscribe to Learning Goals
      unsubGoals = onSnapshot(
        query(collection(db, goalsPath), where('ownerId', '==', uid)),
        (snapshot) => {
          const list: LearningGoal[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              subjectId: String(data.subjectId || ''),
              title: String(data.title || ''),
              targetDate: String(data.targetDate || ''),
              completed: Boolean(data.completed),
            };
          });
          setGoals(list);
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.LIST, goalsPath);
          } catch (wrapped) {
            setAsyncError(wrapped as Error);
          }
        }
      );
    }

    initAndSubscribe();

    return () => {
      isCancelled = true;
      unsubProfile?.();
      unsubSubjects?.();
      unsubLogs?.();
      unsubGoals?.();
    };
  }, [authReady, user]);

  // Keep default select ids valid when subjects load/change
  useEffect(() => {
    if (subjects.length > 0) {
      if (!subjects.some((s) => s.id === newLogSubject)) {
        setNewLogSubject(subjects[0].id);
      }
      if (!subjects.some((s) => s.id === newGoalSubject)) {
        setNewGoalSubject(subjects[0].id);
      }
      if (!subjects.some((s) => s.id === pomodoroSubjectId)) {
        setPomodoroSubjectId(subjects[0].id);
      }
    } else {
      setNewLogSubject('');
      setNewGoalSubject('');
      setPomodoroSubjectId('');
    }
  }, [subjects, newLogSubject, newGoalSubject, pomodoroSubjectId]);

  // Helper to persist Pomodoro completion to Firestore
  const recordPomodoroSession = async (subjectId: string, durationMinutes: number) => {
    if (!user) return;
    const todayStr = formatLocalDate(new Date());
    const validSubjectId = subjects.some((s) => s.id === subjectId)
      ? subjectId
      : subjects[0]?.id;
    if (!validSubjectId) {
      showToast('Cadastre uma matéria para salvar ciclos Pomodoro no Firebase.', 'info');
      return;
    }
    const logId = `log-${Date.now()}`;
    const logPath = `users/${user.uid}/logs/${logId}`;
    try {
      await setDoc(doc(db, logPath), {
        ownerId: user.uid,
        subjectId: validSubjectId,
        date: todayStr,
        durationMinutes: Math.min(1440, Math.max(1, durationMinutes)),
        topics: ['Sessão Pomodoro focada'],
        notes: `Ciclo completo de ${durationMinutes} minutos cronometrado.`,
        goalsMet: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSelectedDayStr(todayStr);
      showToast(
        `Pomodoro de ${durationMinutes} min salvo no Firebase automaticamente!`,
        'success'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, logPath);
    }
  };

  // Pomodoro interval
  useEffect(() => {
    if (!pomodoroActive) return;

    const timer = setInterval(() => {
      setPomodoroTimeLeft((prev) => {
        if (prev <= 1) {
          setPomodoroActive(false);
          if (pomodoroMode === 'work') {
            recordPomodoroSession(pomodoroSubjectId, pomodoroDurationMins).catch(
              (err) => setAsyncError(err as Error)
            );
            setPomodoroMode('break');
            return 5 * 60;
          } else {
            setPomodoroMode('work');
            showToast('Pausa concluída! Pronto para um novo ciclo de foco.', 'info');
            return pomodoroDurationMins * 60;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pomodoroActive, pomodoroMode, pomodoroSubjectId, pomodoroDurationMins, user, subjects]);

  // Date helpers
  const weekDays = useMemo(() => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);

    const list: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const item = new Date(monday);
      item.setDate(monday.getDate() + i);
      list.push(item);
    }
    return list;
  }, [currentDate]);

  const monthCalendarCells = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const cells: { date: Date; isCurrentMonth: boolean }[] = [];
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      cells.push({ date: new Date(year, month, -i), isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      cells.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const totalCells = cells.length <= 35 ? 35 : 42;
    const remaining = totalCells - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return cells;
  }, [currentDate]);

  const currentMonthOnlyDays = useMemo(() => {
    return monthCalendarCells.filter((c) => c.isCurrentMonth).map((c) => c.date);
  }, [monthCalendarCells]);

  // Global & period metrics
  const totalMinutesStudied = useMemo(
    () => logs.reduce((acc, l) => acc + l.durationMinutes, 0),
    [logs]
  );
  const totalHoursStudied = (totalMinutesStudied / 60).toFixed(1);
  const totalGoalsCompleted = goals.filter((g) => g.completed).length;
  const goalCompletionRate =
    goals.length > 0 ? Math.round((totalGoalsCompleted / goals.length) * 100) : 0;

  const currentStreak = useMemo(() => {
    const datesWithLogs = new Set(logs.map((l) => l.date));
    let streak = 0;
    const checkDate = new Date();
    const todayStr = formatLocalDate(checkDate);

    if (!datesWithLogs.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dateStr = formatLocalDate(checkDate);
      if (datesWithLogs.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [logs]);

  // Real-time period diagnostics
  const periodDiagnostics = useMemo(() => {
    const periodDays = activeTab === 'monthly' ? currentMonthOnlyDays : weekDays;
    const periodDateSet = new Set(periodDays.map(formatLocalDate));
    const periodLogs = logs.filter((l) => periodDateSet.has(l.date));
    const studiedDays = new Set(periodLogs.map((l) => l.date)).size;
    const totalDays = periodDays.length;
    const periodMins = periodLogs.reduce((acc, l) => acc + l.durationMinutes, 0);

    const multiplier = activeTab === 'monthly' ? 4.3 : 1;
    let lowestSubject: { name: string; pct: number } | null = null;
    subjects.forEach((sub) => {
      const subMins = periodLogs
        .filter((l) => l.subjectId === sub.id)
        .reduce((acc, l) => acc + l.durationMinutes, 0);
      const targetMins = sub.weeklyGoalHours * multiplier * 60;
      const pct = targetMins > 0 ? Math.round((subMins / targetMins) * 100) : 100;
      if (!lowestSubject || pct < lowestSubject.pct) {
        lowestSubject = { name: sub.name, pct };
      }
    });

    const periodLabel = activeTab === 'monthly' ? 'neste mês' : 'nesta semana';
    if (periodLogs.length === 0) {
      return `Nenhum estudo registrado ${periodLabel}. Registre uma sessão ou inicie um ciclo Pomodoro para salvar no Firebase.`;
    }
    const baseSummary = `Você estudou ${(periodMins / 60).toFixed(1)}h em ${studiedDays} de ${totalDays} dias ${periodLabel} (${goalCompletionRate}% das metas concluídas).`;
    if (lowestSubject && (lowestSubject as { name: string; pct: number }).pct < 60) {
      const target = lowestSubject as { name: string; pct: number };
      return `${baseSummary} Prioridade sugerida: dedicar mais tempo a ${target.name} (${target.pct}% da meta do período).`;
    }
    return `${baseSummary} Excelente equilíbrio entre as matérias e constância no período.`;
  }, [activeTab, currentMonthOnlyDays, weekDays, logs, subjects, goalCompletionRate]);

  // Auth Actions
  const handleSignIn = async () => {
    setSyncError(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao autenticar com o Google.';
      setSyncError(msg);
      showToast('Não foi possível concluir o login com Google.', 'error');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      showToast('Sessão encerrada.', 'info');
    } catch {
      showToast('Erro ao encerrar sessão.', 'error');
    }
  };

  const handleToggleTheme = async () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (!user) return;
    const userPath = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, userPath), {
        theme: nextDark ? 'dark' : 'light',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      } catch (wrapped) {
        setAsyncError(wrapped as Error);
      }
    }
  };

  // CRUD Handlers -> Firebase Firestore
  const openLogModalForDate = (dateStr: string, subjectId?: string) => {
    setNewLogDate(dateStr);
    if (subjectId) setNewLogSubject(subjectId);
    setLogFormError(null);
    setIsLogModalOpen(true);
  };

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newLogSubject || !subjects.some((s) => s.id === newLogSubject)) {
      setLogFormError('Cadastre ao menos uma matéria antes de registrar estudos.');
      return;
    }
    const totalMins =
      (parseInt(newLogHours, 10) || 0) * 60 + (parseInt(newLogMinutes, 10) || 0);
    if (totalMins < 1 || totalMins > 1440) {
      setLogFormError('Informe uma duração válida entre 1 minuto e 24 horas.');
      return;
    }
    const rawTopics = newLogTopics
      ? newLogTopics
          .split(',')
          .map((t) => t.trim().slice(0, 120))
          .filter(Boolean)
          .slice(0, 15)
      : ['Estudo geral'];
    const topicsArr = rawTopics.length > 0 ? rawTopics : ['Estudo geral'];

    const logId = `log-${Date.now()}`;
    const logPath = `users/${user.uid}/logs/${logId}`;
    const validDate = normalizeDateString(newLogDate);

    try {
      await setDoc(doc(db, logPath), {
        ownerId: user.uid,
        subjectId: newLogSubject,
        date: validDate,
        durationMinutes: totalMins,
        topics: topicsArr,
        notes: newLogNotes.trim().slice(0, 1000),
        goalsMet: Boolean(newLogGoalsMet),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSelectedDayStr(validDate);
      setIsLogModalOpen(false);
      setNewLogTopics('');
      setNewLogNotes('');
      setNewLogHours('1');
      setNewLogMinutes('0');
      setLogFormError(null);
      showToast('Sessão de estudo salva no Firebase.', 'success');
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, logPath);
      } catch (wrapped) {
        setAsyncError(wrapped as Error);
      }
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmedName = newSubName.trim().slice(0, 100);
    if (!trimmedName) return;

    const subId = `sub-${Date.now()}`;
    const subPath = `users/${user.uid}/subjects/${subId}`;
    const goalHours = Math.min(80, Math.max(0.5, parseFloat(newSubGoalHours) || 5));

    try {
      await setDoc(doc(db, subPath), {
        ownerId: user.uid,
        name: trimmedName,
        category: newSubCategory,
        color: normalizeHexColor(newSubColor),
        weeklyGoalHours: goalHours,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setIsSubjectModalOpen(false);
      setNewSubName('');
      showToast(`Matéria "${trimmedName}" salva no Firebase.`, 'success');
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, subPath);
      } catch (wrapped) {
        setAsyncError(wrapped as Error);
      }
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmedTitle = newGoalTitle.trim().slice(0, 200);
    if (!trimmedTitle || !newGoalSubject || !subjects.some((s) => s.id === newGoalSubject)) {
      return;
    }

    const goalId = `goal-${Date.now()}`;
    const goalPath = `users/${user.uid}/goals/${goalId}`;

    try {
      await setDoc(doc(db, goalPath), {
        ownerId: user.uid,
        subjectId: newGoalSubject,
        title: trimmedTitle,
        targetDate: normalizeDateString(newGoalDate),
        completed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setIsGoalModalOpen(false);
      setNewGoalTitle('');
      showToast('Meta de aprendizado salva no Firebase.', 'success');
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, goalPath);
      } catch (wrapped) {
        setAsyncError(wrapped as Error);
      }
    }
  };

  const toggleGoalCompletion = async (goal: LearningGoal) => {
    if (!user) return;
    const goalPath = `users/${user.uid}/goals/${goal.id}`;
    try {
      await updateDoc(doc(db, goalPath), {
        completed: !goal.completed,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.UPDATE, goalPath);
      } catch (wrapped) {
        setAsyncError(wrapped as Error);
      }
    }
  };

  const deleteGoal = async (goalId: string) => {
    if (!user) return;
    const goalPath = `users/${user.uid}/goals/${goalId}`;
    try {
      await deleteDoc(doc(db, goalPath));
      showToast('Meta removida do Firebase.', 'info');
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.DELETE, goalPath);
      } catch (wrapped) {
        setAsyncError(wrapped as Error);
      }
    }
  };

  const confirmAndDeleteSubject = async (subjectId: string) => {
    if (!user) return;
    const basePath = `users/${user.uid}`;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, `${basePath}/subjects/${subjectId}`));
      logs
        .filter((l) => l.subjectId === subjectId)
        .forEach((l) => batch.delete(doc(db, `${basePath}/logs/${l.id}`)));
      goals
        .filter((g) => g.subjectId === subjectId)
        .forEach((g) => batch.delete(doc(db, `${basePath}/goals/${g.id}`)));

      await batch.commit();
      setConfirmDeleteSubjectId(null);
      showToast('Matéria e registros associados removidos do Firebase.', 'info');
    } catch (error) {
      try {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `${basePath}/subjects/${subjectId}`
        );
      } catch (wrapped) {
        setAsyncError(wrapped as Error);
      }
    }
  };

  const deleteLog = async (logId: string) => {
    if (!user) return;
    const logPath = `users/${user.uid}/logs/${logId}`;
    try {
      await deleteDoc(doc(db, logPath));
      showToast('Registro de estudo removido do Firebase.', 'info');
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.DELETE, logPath);
      } catch (wrapped) {
        setAsyncError(wrapped as Error);
      }
    }
  };

  // Backup Export / Import (writes directly to Firestore on import)
  const handleExportBackup = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      subjects,
      logs,
      goals,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estudapro-backup-${formatLocalDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup exportado em JSON com sucesso.', 'success');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (
          !Array.isArray(parsed.subjects) ||
          !Array.isArray(parsed.logs) ||
          !Array.isArray(parsed.goals)
        ) {
          showToast('Arquivo inválido: estrutura de backup não reconhecida.', 'error');
          return;
        }

        const uid = user.uid;

        if (subjects.length > 0 || logs.length > 0 || goals.length > 0) {
          const deleteBatch = writeBatch(db);
          subjects.forEach((s) => deleteBatch.delete(doc(db, `users/${uid}/subjects/${s.id}`)));
          logs.forEach((l) => deleteBatch.delete(doc(db, `users/${uid}/logs/${l.id}`)));
          goals.forEach((g) => deleteBatch.delete(doc(db, `users/${uid}/goals/${g.id}`)));
          await deleteBatch.commit();
        }

        const createBatch = writeBatch(db);
        const importedSubjectIds = new Set<string>();
        parsed.subjects.forEach((s: Partial<Subject>, idx: number) => {
          const subId = sanitizeId(String(s.id || `sub-${idx}`), 'sub');
          importedSubjectIds.add(subId);
          createBatch.set(doc(db, `users/${uid}/subjects/${subId}`), {
            ownerId: uid,
            name: String(s.name || 'Matéria').trim().slice(0, 100) || 'Matéria',
            color: normalizeHexColor(String(s.color || '#4f46e5')),
            category: VALID_CATEGORIES.includes(s.category as Subject['category'])
              ? s.category
              : 'Outros',
            weeklyGoalHours: Math.min(80, Math.max(0.5, Number(s.weeklyGoalHours) || 5)),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });

        parsed.logs.forEach((l: Partial<StudyLog>, idx: number) => {
          const subjectId = sanitizeId(String(l.subjectId || ''), 'sub');
          if (!importedSubjectIds.has(subjectId)) return;
          const logId = sanitizeId(String(l.id || `log-${idx}`), 'log');
          const topicsArr = Array.isArray(l.topics)
            ? l.topics
                .map((t) => String(t).trim().slice(0, 120))
                .filter(Boolean)
                .slice(0, 15)
            : [];
          createBatch.set(doc(db, `users/${uid}/logs/${logId}`), {
            ownerId: uid,
            subjectId,
            date: normalizeDateString(String(l.date || '')),
            durationMinutes: Math.min(1440, Math.max(1, Number(l.durationMinutes) || 30)),
            topics: topicsArr.length > 0 ? topicsArr : ['Estudo geral'],
            notes: String(l.notes || '').slice(0, 1000),
            goalsMet: Boolean(l.goalsMet),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });

        parsed.goals.forEach((g: Partial<LearningGoal>, idx: number) => {
          const subjectId = sanitizeId(String(g.subjectId || ''), 'sub');
          if (!importedSubjectIds.has(subjectId)) return;
          const goalId = sanitizeId(String(g.id || `goal-${idx}`), 'goal');
          createBatch.set(doc(db, `users/${uid}/goals/${goalId}`), {
            ownerId: uid,
            subjectId,
            title: String(g.title || 'Meta').trim().slice(0, 200) || 'Meta',
            targetDate: normalizeDateString(String(g.targetDate || '')),
            completed: Boolean(g.completed),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });

        await createBatch.commit();
        showToast('Backup importado e sincronizado com o Firebase.', 'success');
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
        } catch (wrapped) {
          setAsyncError(wrapped as Error);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetDemoData = async () => {
    if (!user) return;
    const uid = user.uid;
    try {
      if (subjects.length > 0 || logs.length > 0 || goals.length > 0) {
        const deleteBatch = writeBatch(db);
        subjects.forEach((s) => deleteBatch.delete(doc(db, `users/${uid}/subjects/${s.id}`)));
        logs.forEach((l) => deleteBatch.delete(doc(db, `users/${uid}/logs/${l.id}`)));
        goals.forEach((g) => deleteBatch.delete(doc(db, `users/${uid}/goals/${g.id}`)));
        await deleteBatch.commit();
      }

      const createBatch = writeBatch(db);
      INITIAL_SUBJECTS.forEach((sub) => {
        createBatch.set(doc(db, `users/${uid}/subjects/${sub.id}`), {
          ownerId: uid,
          name: sub.name.slice(0, 100),
          color: normalizeHexColor(sub.color),
          category: sub.category,
          weeklyGoalHours: sub.weeklyGoalHours,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      INITIAL_LOGS.forEach((log) => {
        createBatch.set(doc(db, `users/${uid}/logs/${log.id}`), {
          ownerId: uid,
          subjectId: log.subjectId,
          date: normalizeDateString(log.date),
          durationMinutes: Math.min(1440, Math.max(1, log.durationMinutes)),
          topics: log.topics.slice(0, 15).map((t) => t.slice(0, 120)),
          notes: log.notes.slice(0, 1000),
          goalsMet: Boolean(log.goalsMet),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      INITIAL_GOALS.forEach((goal) => {
        createBatch.set(doc(db, `users/${uid}/goals/${goal.id}`), {
          ownerId: uid,
          subjectId: goal.subjectId,
          title: goal.title.slice(0, 200),
          targetDate: normalizeDateString(goal.targetDate),
          completed: Boolean(goal.completed),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await createBatch.commit();
      setCurrentDate(new Date());
      setSelectedDayStr(formatLocalDate(new Date()));
      setConfirmReset(false);
      showToast('Dados de exemplo restaurados no Firebase.', 'info');
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
      } catch (wrapped) {
        setAsyncError(wrapped as Error);
      }
    }
  };

  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  // Selected Day Inspector logs
  const selectedDayLogs = useMemo(
    () => logs.filter((l) => l.date === selectedDayStr),
    [logs, selectedDayStr]
  );
  const selectedDayTotalMinutes = selectedDayLogs.reduce(
    (acc, l) => acc + l.durationMinutes,
    0
  );
  const selectedDayDateObj = parseLocalDate(selectedDayStr);

  // Period logs
  const activePeriodDays = activeTab === 'monthly' ? currentMonthOnlyDays : weekDays;
  const activePeriodSet = new Set(activePeriodDays.map(formatLocalDate));
  const activePeriodLogs = logs.filter((l) => activePeriodSet.has(l.date));

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => setActiveTab('weekly')}
          className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-md"
        >
          EstudaPro
        </button>

        {/* Zone 2: Clean single-line Navigation Links */}
        <nav
          aria-label="Navegação principal"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {(
            [
              { id: 'weekly', label: 'Semanal' },
              { id: 'monthly', label: 'Mensal' },
              { id: 'subjects', label: 'Matérias' },
              { id: 'goals', label: 'Metas' },
              { id: 'timer', label: 'Pomodoro' },
            ] as { id: ViewMode; label: string }[]
          ).map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1 whitespace-nowrap shrink-0 border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isActive
                    ? 'border-indigo-600 dark:border-indigo-400 text-slate-900 dark:text-white font-semibold'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          {user ? (
            <button
              type="button"
              onClick={() => openLogModalForDate(selectedDayStr)}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
            >
              <Plus className="w-4 h-4" /> Registrar Estudo
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <LogIn className="w-4 h-4" /> Entrar com Google
            </button>
          )}
        </div>
      </header>

      {/* Mobile Navigation */}
      {user && (
        <nav
          aria-label="Navegação móvel"
          className="flex md:hidden overflow-x-auto gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
        >
          {(
            [
              { id: 'weekly', label: 'Semanal' },
              { id: 'monthly', label: 'Mensal' },
              { id: 'subjects', label: 'Matérias' },
              { id: 'goals', label: 'Metas' },
              { id: 'timer', label: 'Pomodoro' },
            ] as { id: ViewMode; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-2 rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                activeTab === item.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}

      {/* Inline Toast Feedback */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-xl border shadow-lg flex items-center gap-3 text-xs font-medium bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
        >
          {toast.type === 'success' && (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
          {toast.type === 'error' && (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          )}
          {toast.type === 'info' && (
            <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Fechar aviso"
            className="ml-auto text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* AUTH LOADING STATE */}
      {!authReady && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-8 flex items-center justify-center">
          <div className="w-full max-w-md p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 animate-pulse">
            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
            <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg w-full" />
          </div>
        </main>
      )}

      {/* SIGN-IN SCREEN WHEN UNAUTHENTICATED */}
      {authReady && !user && (
        <main className="flex-1 max-w-4xl w-full mx-auto p-6 lg:p-12 flex items-center justify-center">
          <div className="w-full p-8 sm:p-10 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                <Cloud className="w-4 h-4" /> Sincronização em nuvem com Firebase
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Gerencie seus estudos semanais e mensais em qualquer dispositivo
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Entre com sua conta Google para salvar matérias, sessões de estudo, cronômetro Pomodoro e metas de aprendizado diretamente no Firebase Firestore, sem depender de armazenamento local.
              </p>
            </div>

            {syncError && (
              <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                {syncError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
              <div className="space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white">Visão Semanal e Mensal</p>
                <p>Identifique dias estudados, dias sem registro e o conteúdo visto em cada dia.</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white">Gráficos em Tempo Real</p>
                <p>Acompanhe horas acumuladas por matéria frente às suas metas.</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white">Backup na Nuvem</p>
                <p>Alterações salvas automaticamente no Firestore e acessíveis de onde estiver.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSignIn}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors inline-flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" /> Entrar com Google para começar
              </button>
              <button
                type="button"
                onClick={() => setDarkMode(!darkMode)}
                className="px-4 py-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5"
              >
                {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
                {darkMode ? 'Tema Claro' : 'Tema Escuro'}
              </button>
            </div>
          </div>
        </main>
      )}

      {/* AUTHENTICATED MAIN WORKSPACE */}
      {authReady && user && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-8 space-y-6">
          {/* Workspace Utility Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="space-y-0.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Painel de Gestão de Estudos
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sincronizado no Firebase · {user.displayName || user.email}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportBackup}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleExportBackup}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" /> Exportar JSON
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" /> Importar JSON
              </button>

              {confirmReset ? (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-xs">
                  <span className="text-amber-800 dark:text-amber-300 font-medium">
                    Restaurar exemplo?
                  </span>
                  <button
                    type="button"
                    onClick={handleResetDemoData}
                    className="px-2 py-1 rounded bg-amber-600 text-white font-semibold hover:bg-amber-500"
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="px-2 py-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restaurar Exemplo
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleTheme}
                aria-label={darkMode ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                {darkMode ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" /> Claro
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-slate-600" /> Escuro
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" /> Sair
              </button>
            </div>
          </div>

          {dataLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-28 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse p-5"
                />
              ))}
            </div>
          ) : (
            <>
              {/* 4-Column KPI Strip */}
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Tempo Total Acumulado
                    </p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                      {totalHoursStudied}h
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                      {logs.length} sessões registradas
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Sequência Atual
                    </p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                      {currentStreak} {currentStreak === 1 ? 'dia' : 'dias'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {currentStreak > 0 ? 'Ritmo ativo consecutivo' : 'Inicie hoje sua sequência'}
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                    <Flame className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Metas Alcançadas
                    </p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                      {totalGoalsCompleted} / {goals.length}
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                      {goalCompletionRate}% de conclusão
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Target className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Matérias Ativas
                    </p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                      {subjects.length}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Organizadas por área
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                </div>
              </section>

              {/* Real-Time Period Diagnostic Bar */}
              {(activeTab === 'weekly' || activeTab === 'monthly') && (
                <section className="px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5 sm:mt-0" />
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {periodDiagnostics}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setActiveTab('weekly')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        activeTab === 'weekly'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Semana
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('monthly')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        activeTab === 'monthly'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Mês
                    </button>
                  </div>
                </section>
              )}

              {/* TAB 1 & 2 SHARED: WEEKLY OR MONTHLY VIEW */}
              {(activeTab === 'weekly' || activeTab === 'monthly') && (
                <div className="space-y-6">
                  {/* Period Navigation Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {activeTab === 'weekly'
                          ? 'Acompanhamento Semanal'
                          : `${monthNames[currentDate.getMonth()]} de ${currentDate.getFullYear()}`}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        {activeTab === 'weekly'
                          ? `${weekDays[0].toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                            })} — ${weekDays[6].toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}`
                          : `${activePeriodLogs.length} sessões registradas neste mês`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={activeTab === 'weekly' ? 'Semana anterior' : 'Mês anterior'}
                        onClick={() => {
                          const prev = new Date(currentDate);
                          if (activeTab === 'weekly') {
                            prev.setDate(prev.getDate() - 7);
                          } else {
                            prev.setMonth(prev.getMonth() - 1);
                          }
                          setCurrentDate(prev);
                        }}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date();
                          setCurrentDate(today);
                          setSelectedDayStr(formatLocalDate(today));
                        }}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap"
                      >
                        Hoje
                      </button>
                      <button
                        type="button"
                        aria-label={activeTab === 'weekly' ? 'Próxima semana' : 'Próximo mês'}
                        onClick={() => {
                          const next = new Date(currentDate);
                          if (activeTab === 'weekly') {
                            next.setDate(next.getDate() + 7);
                          } else {
                            next.setMonth(next.getMonth() + 1);
                          }
                          setCurrentDate(next);
                        }}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Real-Time Interactive Performance Charts */}
                  <PerformanceCharts
                    mode={activeTab}
                    days={activePeriodDays}
                    logs={logs}
                    subjects={subjects}
                    selectedDateStr={selectedDayStr}
                    onSelectDay={(dateStr) => setSelectedDayStr(dateStr)}
                  />

                  {/* WEEKLY GRID REPRESENTATION */}
                  {activeTab === 'weekly' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
                      {weekDays.map((day, idx) => {
                        const dateStr = formatLocalDate(day);
                        const dayLogs = logs.filter((l) => l.date === dateStr);
                        const dayMinutes = dayLogs.reduce((acc, l) => acc + l.durationMinutes, 0);
                        const isStudied = dayMinutes > 0;
                        const isSelected = selectedDayStr === dateStr;
                        const dayName = [
                          'Segunda',
                          'Terça',
                          'Quarta',
                          'Quinta',
                          'Sexta',
                          'Sábado',
                          'Domingo',
                        ][idx];

                        return (
                          <div
                            key={dateStr}
                            onClick={() => setSelectedDayStr(dateStr)}
                            className={`p-4 rounded-2xl border transition-colors cursor-pointer flex flex-col justify-between gap-3 ${
                              isSelected
                                ? 'border-indigo-600 dark:border-indigo-400 bg-white dark:bg-slate-900 ring-1 ring-indigo-600 dark:ring-indigo-400'
                                : isStudied
                                  ? 'border-emerald-500/40 bg-white dark:bg-slate-900 hover:border-emerald-500'
                                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between gap-1 text-xs">
                                <span className="font-semibold text-slate-600 dark:text-slate-400">
                                  {dayName}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 font-medium ${
                                    isStudied
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-slate-400 dark:text-slate-500'
                                  }`}
                                >
                                  {isStudied ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" /> Estudado
                                    </>
                                  ) : (
                                    'Sem estudo'
                                  )}
                                </span>
                              </div>

                              <div>
                                <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                                  {day.getDate()}{' '}
                                  <span className="text-xs font-sans font-medium text-slate-500 dark:text-slate-400">
                                    {monthNames[day.getMonth()].slice(0, 3)}
                                  </span>
                                </p>
                                <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                  {isStudied
                                    ? `${(dayMinutes / 60).toFixed(1)}h (${dayMinutes} min)`
                                    : '0h registradas'}
                                </p>
                              </div>

                              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                {dayLogs.length > 0 ? (
                                  dayLogs.map((log) => {
                                    const sub = subjects.find((s) => s.id === log.subjectId);
                                    return (
                                      <div key={log.id} className="text-xs space-y-0.5">
                                        <div className="flex items-center justify-between gap-1">
                                          <span
                                            className="font-semibold truncate"
                                            style={{ color: sub?.color || '#4f46e5' }}
                                          >
                                            {sub?.name || 'Matéria'}
                                          </span>
                                          <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400 shrink-0">
                                            {log.durationMinutes}m
                                          </span>
                                        </div>
                                        <p className="text-slate-600 dark:text-slate-400 truncate">
                                          {log.topics.join(', ')}
                                        </p>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <p className="py-3 text-xs text-slate-400 dark:text-slate-500">
                                    Dia não estudado
                                  </p>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openLogModalForDate(dateStr);
                              }}
                              className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" /> Registrar
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* MONTHLY CALENDAR REPRESENTATION */}
                  {activeTab === 'monthly' && (
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Mapa Mensal de Dias Estudados e Não Estudados
                        </h3>
                        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Dia estudado
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50" />
                            Dia não estudado
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <span>Seg</span>
                        <span>Ter</span>
                        <span>Qua</span>
                        <span>Qui</span>
                        <span>Sex</span>
                        <span>Sáb</span>
                        <span>Dom</span>
                      </div>

                      <div className="grid grid-cols-7 gap-2">
                        {monthCalendarCells.map((cell, idx) => {
                          const dateStr = formatLocalDate(cell.date);
                          const cellLogs = logs.filter((l) => l.date === dateStr);
                          const cellMinutes = cellLogs.reduce(
                            (acc, l) => acc + l.durationMinutes,
                            0
                          );
                          const isStudied = cellMinutes > 0;
                          const isSelected = selectedDayStr === dateStr;

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedDayStr(dateStr)}
                              className={`min-h-[96px] p-2.5 rounded-xl border text-left transition-colors flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                !cell.isCurrentMonth
                                  ? 'opacity-40 bg-slate-50/50 dark:bg-slate-950/30 border-slate-100 dark:border-slate-900'
                                  : isSelected
                                    ? 'border-indigo-600 dark:border-indigo-400 ring-1 ring-indigo-600 dark:ring-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20'
                                    : isStudied
                                      ? 'border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/15 hover:border-emerald-500'
                                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full gap-1">
                                <span
                                  className={`text-xs font-bold font-mono tabular-nums ${
                                    isStudied
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {cell.date.getDate()}
                                </span>
                                {isStudied ? (
                                  <span className="text-[11px] font-mono font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                                    {(cellMinutes / 60).toFixed(1)}h
                                  </span>
                                ) : (
                                  cell.isCurrentMonth && (
                                    <span className="text-[10px] text-slate-400 dark:text-slate-600 hidden sm:inline">
                                      —
                                    </span>
                                  )
                                )}
                              </div>

                              <div className="space-y-1 mt-1.5 w-full">
                                {cellLogs.slice(0, 2).map((log) => {
                                  const sub = subjects.find((s) => s.id === log.subjectId);
                                  return (
                                    <div
                                      key={log.id}
                                      className="text-[10px] px-1.5 py-0.5 rounded truncate font-medium text-white"
                                      style={{ backgroundColor: sub?.color || '#4f46e5' }}
                                    >
                                      {sub?.name || 'Estudo'}
                                    </div>
                                  );
                                })}
                                {cellLogs.length > 2 && (
                                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                                    +{cellLogs.length - 2} sessões
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* SELECTED DAY INSPECTOR */}
                  <section className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
                          <CalendarDays className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            O que foi estudado em{' '}
                            {selectedDayDateObj.toLocaleDateString('pt-BR', {
                              weekday: 'long',
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                            {selectedDayLogs.length > 0
                              ? `Status: Dia estudado · ${selectedDayLogs.length} ${
                                  selectedDayLogs.length === 1 ? 'sessão' : 'sessões'
                                } · ${(selectedDayTotalMinutes / 60).toFixed(1)}h (${selectedDayTotalMinutes} min)`
                              : 'Status: Dia não estudado · Nenhum registro encontrado para esta data'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openLogModalForDate(selectedDayStr)}
                        className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar neste dia
                      </button>
                    </div>

                    {selectedDayLogs.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {selectedDayLogs.map((log) => {
                          const sub = subjects.find((s) => s.id === log.subjectId);
                          return (
                            <div
                              key={log.id}
                              className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span
                                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                                    style={{ backgroundColor: sub?.color || '#4f46e5' }}
                                    aria-hidden="true"
                                  />
                                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                                    {sub?.name || 'Matéria removida'}
                                  </span>
                                  <span className="text-slate-400" aria-hidden="true">
                                    ·
                                  </span>
                                  <span className="text-slate-600 dark:text-slate-300">
                                    {log.goalsMet ? 'Meta da sessão atingida' : 'Em andamento'}
                                  </span>
                                </div>
                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                  Tópicos: {log.topics.join(', ')}
                                </p>
                                {log.notes && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {log.notes}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-4 shrink-0">
                                <span className="text-sm font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                                  {log.durationMinutes} min
                                </span>
                                <button
                                  type="button"
                                  onClick={() => deleteLog(log.id)}
                                  aria-label="Excluir registro de estudo"
                                  className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-6 text-center space-y-2">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Nenhuma matéria foi estudada nesta data.
                        </p>
                        <button
                          type="button"
                          onClick={() => openLogModalForDate(selectedDayStr)}
                          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Registrar estudo para {selectedDayDateObj.toLocaleDateString('pt-BR')}
                        </button>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* TAB 3: SUBJECTS */}
              {activeTab === 'subjects' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Gerenciamento de Matérias
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Organize suas disciplinas e defina metas semanais de horas
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSubjectModalOpen(true)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"
                    >
                      <Plus className="w-4 h-4" /> Nova Matéria
                    </button>
                  </div>

                  {subjects.length === 0 ? (
                    <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Você ainda não cadastrou nenhuma matéria.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsSubjectModalOpen(true)}
                        className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500"
                      >
                        Cadastrar Primeira Matéria
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {subjects.map((sub) => {
                        const subLogs = logs.filter((l) => l.subjectId === sub.id);
                        const totalMins = subLogs.reduce((acc, l) => acc + l.durationMinutes, 0);
                        const totalHrs = (totalMins / 60).toFixed(1);
                        const isConfirming = confirmDeleteSubjectId === sub.id;

                        return (
                          <div
                            key={sub.id}
                            className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between gap-5"
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                                    style={{ backgroundColor: sub.color }}
                                    aria-hidden="true"
                                  />
                                  <span>{sub.category}</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">
                                    Meta {sub.weeklyGoalHours}h/sem
                                  </span>
                                </span>

                                {isConfirming ? (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => confirmAndDeleteSubject(sub.id)}
                                      className="px-2 py-1 rounded bg-red-600 text-white text-[11px] font-semibold hover:bg-red-500"
                                    >
                                      Confirmar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteSubjectId(null)}
                                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px]"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteSubjectId(sub.id)}
                                    aria-label={`Excluir ${sub.name}`}
                                    className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>

                              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                {sub.name}
                              </h3>

                              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                                <span className="text-slate-500 dark:text-slate-400">
                                  Total acumulado
                                </span>
                                <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                                  {totalHrs}h ({subLogs.length} sessões)
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => openLogModalForDate(selectedDayStr, sub.id)}
                              className="w-full py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-2"
                            >
                              <Plus className="w-4 h-4" /> Registrar Sessão
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: GOALS */}
              {activeTab === 'goals' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Metas de Aprendizado
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        {totalGoalsCompleted} de {goals.length} metas concluídas ({goalCompletionRate}%)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsGoalModalOpen(true)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"
                    >
                      <Plus className="w-4 h-4" /> Nova Meta
                    </button>
                  </div>

                  {goals.length === 0 ? (
                    <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Nenhuma meta cadastrada no momento.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsGoalModalOpen(true)}
                        className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500"
                      >
                        Criar Primeira Meta
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                      {goals.map((goal) => {
                        const sub = subjects.find((s) => s.id === goal.subjectId);
                        return (
                          <div
                            key={goal.id}
                            className="p-5 flex items-center justify-between gap-4"
                          >
                            <div className="flex items-start gap-3.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => toggleGoalCompletion(goal)}
                                aria-label={
                                  goal.completed ? 'Marcar meta como pendente' : 'Concluir meta'
                                }
                                className="mt-0.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-full"
                              >
                                {goal.completed ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Circle className="w-5 h-5 text-slate-400 hover:text-indigo-500" />
                                )}
                              </button>
                              <div className="space-y-1 min-w-0">
                                <p
                                  className={`text-sm font-semibold ${
                                    goal.completed
                                      ? 'line-through text-slate-400 dark:text-slate-500'
                                      : 'text-slate-900 dark:text-white'
                                  }`}
                                >
                                  {goal.title}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  <span
                                    className="font-medium"
                                    style={{ color: sub?.color || '#4f46e5' }}
                                  >
                                    {sub?.name || 'Geral'}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">
                                    Prazo: {parseLocalDate(goal.targetDate).toLocaleDateString('pt-BR')}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>{goal.completed ? 'Concluída' : 'Em andamento'}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => deleteGoal(goal.id)}
                              aria-label="Excluir meta"
                              className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: POMODORO TIMER */}
              {activeTab === 'timer' && (
                <div className="max-w-xl mx-auto p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-8">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      <Timer className="w-4 h-4" />
                      <span>
                        {pomodoroMode === 'work' ? 'Ciclo de Foco' : 'Intervalo de Descanso'}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      {pomodoroMode === 'work' ? 'Foco Total nos Estudos' : 'Hora da Pausa'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {pomodoroMode === 'work'
                        ? 'Ao concluir o ciclo, o tempo é salvo automaticamente no Firebase.'
                        : 'Aproveite 5 minutos para descansar antes do próximo bloco.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto text-left">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Matéria em estudo
                      </label>
                      <select
                        value={pomodoroSubjectId}
                        onChange={(e) => setPomodoroSubjectId(e.target.value)}
                        disabled={pomodoroActive}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500 disabled:opacity-60"
                      >
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Duração do foco
                      </label>
                      <select
                        value={pomodoroDurationMins}
                        disabled={pomodoroActive || pomodoroMode === 'break'}
                        onChange={(e) => {
                          const mins = Number(e.target.value);
                          setPomodoroDurationMins(mins);
                          setPomodoroTimeLeft(mins * 60);
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500 disabled:opacity-60"
                      >
                        <option value={25}>25 minutos (Padrão)</option>
                        <option value={50}>50 minutos (Estendido)</option>
                        <option value={15}>15 minutos (Rápido)</option>
                      </select>
                    </div>
                  </div>

                  <div className="py-4">
                    <div className="text-6xl sm:text-7xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
                      {Math.floor(pomodoroTimeLeft / 60)
                        .toString()
                        .padStart(2, '0')}
                      :
                      {(pomodoroTimeLeft % 60).toString().padStart(2, '0')}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPomodoroActive(!pomodoroActive)}
                      className={`px-6 py-3 rounded-xl font-semibold text-sm text-white transition-colors ${
                        pomodoroActive
                          ? 'bg-amber-600 hover:bg-amber-500'
                          : 'bg-indigo-600 hover:bg-indigo-500'
                      }`}
                    >
                      {pomodoroActive ? 'Pausar' : 'Iniciar Foco'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPomodoroActive(false);
                        setPomodoroTimeLeft(
                          pomodoroMode === 'work' ? pomodoroDurationMins * 60 : 5 * 60
                        );
                      }}
                      className="px-5 py-3 rounded-xl font-semibold text-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      Reiniciar
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      )}

      {/* MODAL: Register Study Session */}
      {isLogModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-log-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 id="modal-log-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Registrar Sessão de Estudo
              </h3>
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                aria-label="Fechar janela"
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {logFormError && (
              <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                {logFormError}
              </div>
            )}

            <form onSubmit={handleCreateLog} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Matéria
                </label>
                <select
                  value={newLogSubject}
                  onChange={(e) => setNewLogSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Data
                  </label>
                  <input
                    type="date"
                    value={newLogDate}
                    onChange={(e) => setNewLogDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Horas
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="16"
                      value={newLogHours}
                      onChange={(e) => setNewLogHours(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500 font-mono tabular-nums"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Minutos
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      step="5"
                      value={newLogMinutes}
                      onChange={(e) => setNewLogMinutes(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500 font-mono tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Tópicos Estudados (separados por vírgula)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Derivadas, Regra da Cadeia"
                  value={newLogTopics}
                  onChange={(e) => setNewLogTopics(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Anotações
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  placeholder="Resumo do conteúdo, exercícios resolvidos ou pontos para revisar..."
                  value={newLogNotes}
                  onChange={(e) => setNewLogNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="goalsMet"
                  checked={newLogGoalsMet}
                  onChange={(e) => setNewLogGoalsMet(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="goalsMet"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Objetivo de aprendizado da sessão alcançado
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors"
                >
                  Salvar no Firebase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: New Subject */}
      {isSubjectModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-subject-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 id="modal-subject-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Adicionar Nova Matéria
              </h3>
              <button
                type="button"
                onClick={() => setIsSubjectModalOpen(false)}
                aria-label="Fechar janela"
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubject} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Nome da Matéria
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  placeholder="Ex: Física Quântica"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Categoria
                  </label>
                  <select
                    value={newSubCategory}
                    onChange={(e) =>
                      setNewSubCategory(e.target.value as Subject['category'])
                    }
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                  >
                    <option value="Exatas">Exatas</option>
                    <option value="Humanas">Humanas</option>
                    <option value="Linguagens">Linguagens</option>
                    <option value="Tecnologia">Tecnologia</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Meta Semanal (h)
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    max="80"
                    step="0.5"
                    value={newSubGoalHours}
                    onChange={(e) => setNewSubGoalHours(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500 font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Cor de Identificação
                </label>
                <div className="flex items-center gap-3">
                  {[
                    '#4f46e5',
                    '#0284c7',
                    '#059669',
                    '#d97706',
                    '#db2777',
                    '#7c3aed',
                    '#0d9488',
                  ].map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Selecionar cor ${color}`}
                      onClick={() => setNewSubColor(color)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        newSubColor === color
                          ? 'ring-2 ring-offset-2 ring-indigo-600 dark:ring-offset-slate-900 scale-110'
                          : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSubjectModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors"
                >
                  Criar Matéria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: New Goal */}
      {isGoalModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-goal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 id="modal-goal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Nova Meta de Aprendizado
              </h3>
              <button
                type="button"
                onClick={() => setIsGoalModalOpen(false)}
                aria-label="Fechar janela"
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Matéria
                </label>
                <select
                  value={newGoalSubject}
                  onChange={(e) => setNewGoalSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Título da Meta
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  placeholder="Ex: Resolver 50 exercícios de Árvores Binárias"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Data Limite
                </label>
                <input
                  type="date"
                  value={newGoalDate}
                  onChange={(e) => setNewGoalDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors"
                >
                  Criar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
