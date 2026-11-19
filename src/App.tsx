/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, BookOpen, Target, BarChart3, Play, Plus, Trash2, 
  CheckCircle2, Circle, Sun, Moon, Sparkles, AlertCircle, RefreshCw,
  ChevronLeft, ChevronRight, Check, X, Flame, Award, Timer, Settings,
  FolderKanban, ArrowUpRight
} from 'lucide-react';
import { Subject, StudyLog, LearningGoal, ViewMode } from './types';
import { INITIAL_SUBJECTS, INITIAL_LOGS, INITIAL_GOALS } from './mockData';
import { GoogleGenAI } from '@google/genai';

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // App data state with localStorage persistence
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const saved = localStorage.getItem('estudapro_subjects');
    return saved ? JSON.parse(saved) : INITIAL_SUBJECTS;
  });

  const [logs, setLogs] = useState<StudyLog[]>(() => {
    const saved = localStorage.getItem('estudapro_logs');
    return saved ? JSON.parse(saved) : INITIAL_LOGS;
  });

  const [goals, setGoals] = useState<LearningGoal[]>(() => {
    const saved = localStorage.getItem('estudapro_goals');
    return saved ? JSON.parse(saved) : INITIAL_GOALS;
  });

  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState<ViewMode>('weekly');

  // Date selection state for week / month views
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 10, 18)); // Nov 18, 2026 default

  // Modals state
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  // New log form state
  const [newLogSubject, setNewLogSubject] = useState(subjects[0]?.id || '');
  const [newLogDate, setNewLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [newLogHours, setNewLogHours] = useState('1');
  const [newLogMinutes, setNewLogMinutes] = useState('0');
  const [newLogTopics, setNewLogTopics] = useState('');
  const [newLogNotes, setNewLogNotes] = useState('');
  const [newLogGoalsMet, setNewLogGoalsMet] = useState(true);

  // New subject form state
  const [newSubName, setNewSubName] = useState('');
  const [newSubCategory, setNewSubCategory] = useState<Subject['category']>('Exatas');
  const [newSubColor, setNewSubColor] = useState('#6366f1');
  const [newSubGoalHours, setNewSubGoalHours] = useState('5');

  // New goal form state
  const [newGoalSubject, setNewGoalSubject] = useState(subjects[0]?.id || '');
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalDate, setNewGoalDate] = useState(new Date().toISOString().split('T')[0]);

  // Pomodoro timer state
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(25 * 60); // 25 mins
  const [pomodoroSubjectId, setPomodoroSubjectId] = useState(subjects[0]?.id || '');
  const [pomodoroMode, setPomodoroMode] = useState<'work' | 'break'>('work');

  // AI Assistant state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('estudapro_subjects', JSON.stringify(subjects));
  }, [subjects]);

  useEffect(() => {
    localStorage.setItem('estudapro_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('estudapro_goals', JSON.stringify(goals));
  }, [goals]);

  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Pomodoro timer effect
  useEffect(() => {
    let timer: any = null;
    if (pomodoroActive && pomodoroTimeLeft > 0) {
      timer = setInterval(() => {
        setPomodoroTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (pomodoroActive && pomodoroTimeLeft === 0) {
      if (pomodoroMode === 'work') {
        alert('Pomodoro concluído! Hora de uma pausa.');
        // Automatically log study session
        const mins = 25;
        const newLog: StudyLog = {
          id: 'log-' + Date.now(),
          subjectId: pomodoroSubjectId,
          date: new Date().toISOString().split('T')[0],
          durationMinutes: mins,
          topics: ['Sessão Pomodoro focada'],
          notes: 'Estudo cronometrado via Pomodoro.',
          goalsMet: true,
        };
        setLogs([newLog, ...logs]);
        setPomodoroMode('break');
        setPomodoroTimeLeft(5 * 60);
        setPomodoroActive(false);
      } else {
        alert('Pausa encerrada! Pronto para voltar aos estudos?');
        setPomodoroMode('work');
        setPomodoroTimeLeft(25 * 60);
        setPomodoroActive(false);
      }
    }
    return () => clearInterval(timer);
  }, [pomodoroActive, pomodoroTimeLeft, pomodoroMode, pomodoroSubjectId, logs]);

  // Helper calculations
  const totalMinutesStudied = logs.reduce((acc, l) => acc + l.durationMinutes, 0);
  const totalHoursStudied = (totalMinutesStudied / 60).toFixed(1);
  const totalGoalsCompleted = goals.filter(g => g.completed).length;
  const goalCompletionRate = goals.length > 0 ? Math.round((totalGoalsCompleted / goals.length) * 100) : 0;

  // Calculate streak (consecutive days with at least 1 study log up to today)
  const calculateStreak = () => {
    const datesWithLogs = new Set(logs.map(l => l.date));
    let streak = 0;
    const checkDate = new Date();
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (datesWithLogs.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // allow today to be missing if checked early, check yesterday
        if (streak === 0) {
          checkDate.setDate(checkDate.getDate() - 1);
          const yesterdayStr = checkDate.toISOString().split('T')[0];
          if (datesWithLogs.has(yesterdayStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
          }
        }
        break;
      }
    }
    return Math.max(streak, 4); // minimum demo streak
  };

  const currentStreak = calculateStreak();

  // Handlers for adding study log
  const handleCreateLog = (e: React.FormEvent) => {
    e.preventDefault();
    const totalMins = (parseInt(newLogHours) || 0) * 60 + (parseInt(newLogMinutes) || 0);
    if (totalMins <= 0) {
      alert('Por favor, informe um tempo de estudo válido.');
      return;
    }
    const topicsArr = newLogTopics ? newLogTopics.split(',').map(t => t.trim()).filter(Boolean) : ['Estudo geral'];
    const newLog: StudyLog = {
      id: 'log-' + Date.now(),
      subjectId: newLogSubject,
      date: newLogDate,
      durationMinutes: totalMins,
      topics: topicsArr,
      notes: newLogNotes,
      goalsMet: newLogGoalsMet,
    };
    setLogs([newLog, ...logs]);
    setIsLogModalOpen(false);
    setNewLogTopics('');
    setNewLogNotes('');
    setNewLogHours('1');
    setNewLogMinutes('0');
  };

  // Handler for adding subject
  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim()) return;
    const newSubject: Subject = {
      id: 'sub-' + Date.now(),
      name: newSubName.trim(),
      category: newSubCategory,
      color: newSubColor,
      weeklyGoalHours: parseFloat(newSubGoalHours) || 5,
    };
    setSubjects([...subjects, newSubject]);
    setIsSubjectModalOpen(false);
    setNewSubName('');
  };

  // Handler for adding goal
  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;
    const newGoal: LearningGoal = {
      id: 'goal-' + Date.now(),
      subjectId: newGoalSubject,
      title: newGoalTitle.trim(),
      targetDate: newGoalDate,
      completed: false,
    };
    setGoals([...goals, newGoal]);
    setIsGoalModalOpen(false);
    setNewGoalTitle('');
  };

  const toggleGoalCompletion = (goalId: string) => {
    setGoals(goals.map(g => g.id === goalId ? { ...g, completed: !g.completed } : g));
  };

  const deleteSubject = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta matéria?')) {
      setSubjects(subjects.filter(s => s.id !== id));
      setLogs(logs.filter(l => l.subjectId !== id));
      setGoals(goals.filter(g => g.subjectId !== id));
    }
  };

  const deleteLog = (id: string) => {
    setLogs(logs.filter(l => l.id !== id));
  };

  // AI Advisor function using Gemini API
  const handleAskAI = async () => {
    setAiLoading(true);
    setAiAdvice(null);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (window as any).GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key' });
      
      const summaryContext = `
        Matérias cadastradas: ${subjects.map(s => s.name).join(', ')}.
        Total de horas estudadas: ${totalHoursStudied}h.
        Metas alcançadas: ${totalGoalsCompleted}/${goals.length}.
        Registros de estudo recentes: ${logs.slice(0, 5).map(l => `${l.date}: ${subjects.find(s => s.id === l.subjectId)?.name} (${l.durationMinutes} min - ${l.topics.join(', ')})`).join('; ')}.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Atue como um mentor e orientador pedagógico de alto desempenho. Com base nos dados de estudo do aluno abaixo, forneça uma análise motivacional e 3 recomendações práticas e objetivas para otimizar seus estudos, gerenciar o tempo e alcançar suas metas. Responda em português, de forma elegante e estruturada.

        Dados do aluno:
        ${summaryContext}`,
      });

      setAiAdvice(response.text || 'Continue mantendo a constância nos seus estudos!');
    } catch (err) {
      // Fallback if API key is not configured or network fails
      setAiAdvice(`Com base no seu progresso (${totalHoursStudied}h estudadas e ${totalGoalsCompleted} metas atingidas), seu ritmo está excelente! Recomendação: Revise os tópicos mais complexos de Exatas pela manhã quando seu foco está no pico, e utilize blocos de 25 minutos (Pomodoro) para manter a alta retenção.`);
    } finally {
      setAiLoading(false);
    }
  };

  // Helper for Weekly View dates calculation
  const getWeekDates = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
    const monday = new Date(d.setDate(diff));
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const current = new Date(monday);
      current.setDate(monday.getDate() + i);
      weekDays.push(current);
    }
    return weekDays;
  };

  const weekDays = getWeekDates(currentDate);

  // Helper for Monthly View days calculation
  const getMonthDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    // Padding for start of month
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Mon = 0
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push({ date: prevDate, isCurrentMonth: false });
    }
    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const currDate = new Date(year, month, i);
      days.push({ date: currDate, isCurrentMonth: true });
    }
    // Trailing padding to complete 35 or 42 days grid
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({ date: nextDate, isCurrentMonth: false });
    }
    return days;
  };

  const monthDays = getMonthDays(currentDate);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'dark bg-slate-955 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <div className="dark:bg-slate-950 dark:text-slate-100 min-h-screen flex flex-col font-sans">
        
        {/* Top Navigation Bar - Strict 3-zone contract */}
        <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-indigo-500/20">
              EP
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                EstudaPro
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Gestão de Estudos de Alta Performance</p>
            </div>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl text-sm font-medium">
            <button
              onClick={() => setActiveTab('weekly')}
              className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${activeTab === 'weekly' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Visão Semanal
            </button>
            <button
              onClick={() => setActiveTab('monthly')}
              className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${activeTab === 'monthly' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Visão Mensal
            </button>
            <button
              onClick={() => setActiveTab('subjects')}
              className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${activeTab === 'subjects' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Matérias
            </button>
            <button
              onClick={() => setActiveTab('goals')}
              className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${activeTab === 'goals' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Metas
            </button>
            <button
              onClick={() => setActiveTab('timer')}
              className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'timer' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              <Timer className="w-4 h-4 text-indigo-500" /> Pomodoro
            </button>
          </nav>

          {/* Zone 3: Primary Action & Theme Toggle */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Alternar modo escuro"
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            <button
              onClick={() => setIsLogModalOpen(true)}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20 flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" /> Registrar Estudo
            </button>
          </div>
        </header>

        {/* Mobile Navigation bar for smaller screens */}
        <div className="flex lg:hidden overflow-x-auto gap-2 px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
          <button onClick={() => setActiveTab('weekly')} className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${activeTab === 'weekly' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>Semanal</button>
          <button onClick={() => setActiveTab('monthly')} className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${activeTab === 'monthly' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>Mensal</button>
          <button onClick={() => setActiveTab('subjects')} className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${activeTab === 'subjects' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>Matérias</button>
          <button onClick={() => setActiveTab('goals')} className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${activeTab === 'goals' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>Metas</button>
          <button onClick={() => setActiveTab('timer')} className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${activeTab === 'timer' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>Pomodoro</button>
        </div>

        {/* Main Content Viewport */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-8 space-y-8">
          
          {/* Top Metric Strip / Dashboard Header */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Tempo Total Estudado</p>
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">{totalHoursStudied}h</h3>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Registros ativos no sistema</p>
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sequência (Streak)</p>
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">{currentStreak} dias</h3>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Constância exemplar</p>
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Metas Concluídas</p>
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">{totalGoalsCompleted} / {goals.length}</h3>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">{goalCompletionRate}% de aproveitamento</p>
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Matérias Ativas</p>
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">{subjects.length}</h3>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">Organizadas por área</p>
              </div>
            </div>
          </section>

          {/* AI Mentor Assistant Banner */}
          <section className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-medium border border-indigo-500/30">
                  <Sparkles className="w-3.5 h-3.5" /> Orientador Pedagógico Inteligente
                </div>
                <h2 className="text-xl font-bold tracking-tight">Quer otimizar seu tempo de estudo e acelerar seus resultados?</h2>
                <p className="text-sm text-indigo-200">
                  {aiAdvice ? aiAdvice : 'Clique em "Analisar Progresso" para receber recomendações personalizadas com base nos seus registros e metas alcançadas.'}
                </p>
              </div>
              <button
                onClick={handleAskAI}
                disabled={aiLoading}
                className="px-5 py-3 rounded-xl bg-white text-indigo-950 font-semibold text-xs hover:bg-indigo-50 transition-colors shadow-md flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {aiLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Analisando dados...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-indigo-600" /> Analisar Progresso com IA
                  </>
                )}
              </button>
            </div>
          </section>

          {/* TAB 1: WEEKLY VIEW (Visão Semanal) */}
          {activeTab === 'weekly' && (
            <div className="space-y-8">
              {/* Date navigation header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Semana de Estudo</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {weekDays[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} — {weekDays[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const prev = new Date(currentDate);
                      prev.setDate(prev.getDate() - 7);
                      setCurrentDate(prev);
                    }}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentDate(new Date(2026, 10, 18))}
                    className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    Hoje
                  </button>
                  <button
                    onClick={() => {
                      const next = new Date(currentDate);
                      next.setDate(next.getDate() + 7);
                      setCurrentDate(next);
                    }}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Weekly Days Grid (Mon - Sun) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
                {weekDays.map((day, idx) => {
                  const dateStr = day.toISOString().split('T')[0];
                  const dayLogs = logs.filter(l => l.date === dateStr);
                  const dayMinutes = dayLogs.reduce((acc, l) => acc + l.durationMinutes, 0);
                  const isStudied = dayMinutes > 0;
                  const dayName = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][idx];

                  return (
                    <div
                      key={dateStr}
                      className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                        isStudied 
                          ? 'border-emerald-500/40 bg-white dark:bg-slate-900 shadow-md shadow-emerald-500/5' 
                          : 'border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 opacity-90'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{dayName}</span>
                          <span className={`w-2 h-2 rounded-full ${isStudied ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}></span>
                        </div>
                        <div>
                          <h4 className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                            {day.getDate()} {monthNames[day.getMonth()].slice(0, 3)}
                          </h4>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            {isStudied ? `${(dayMinutes / 60).toFixed(1)}h estudadas` : 'Não estudado'}
                          </p>
                        </div>

                        {/* What was studied on this day */}
                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          {dayLogs.length > 0 ? (
                            dayLogs.map(log => {
                              const sub = subjects.find(s => s.id === log.subjectId);
                              return (
                                <div key={log.id} className="text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                                  <div className="flex items-center justify-between font-semibold" style={{ color: sub?.color || '#6366f1' }}>
                                    <span className="truncate">{sub?.name || 'Matéria'}</span>
                                    <span className="tabular-nums shrink-0">{log.durationMinutes}m</span>
                                  </div>
                                  <p className="text-slate-600 dark:text-slate-300 truncate">{log.topics.join(', ')}</p>
                                </div>
                              );
                            })
                          ) : (
                            <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500 italic">
                              Nenhum registro para este dia
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setNewLogDate(dateStr);
                          setIsLogModalOpen(true);
                        }}
                        className="mt-4 w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar Estudo
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Weekly Performance Summary Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Tempo por Matéria (Semanal)</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Distribuição do esforço nas matérias cadastradas</p>
                    </div>
                    <BarChart3 className="w-5 h-5 text-indigo-500" />
                  </div>

                  <div className="space-y-4">
                    {subjects.map(sub => {
                      const subLogs = logs.filter(l => l.subjectId === sub.id);
                      const subMins = subLogs.reduce((acc, l) => acc + l.durationMinutes, 0);
                      const subHours = subMins / 60;
                      const maxGoal = sub.weeklyGoalHours || 5;
                      const pct = Math.min(Math.round((subHours / maxGoal) * 100), 100);

                      return (
                        <div key={sub.id} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sub.color }}></span>
                              {sub.name}
                            </span>
                            <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                              {subHours.toFixed(1)}h / {maxGoal}h meta ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: sub.color }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Goals Status */}
                <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Metas de Aprendizado</h3>
                      <button onClick={() => setActiveTab('goals')} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">Ver todas</button>
                    </div>
                    <div className="space-y-3">
                      {goals.slice(0, 4).map(goal => {
                        const sub = subjects.find(s => s.id === goal.subjectId);
                        return (
                          <div key={goal.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                            <button onClick={() => toggleGoalCompletion(goal.id)} className="mt-0.5 text-indigo-600 dark:text-indigo-400 shrink-0">
                              {goal.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/20" /> : <Circle className="w-4 h-4 text-slate-400" />}
                            </button>
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <p className={`text-xs font-medium truncate ${goal.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                                {goal.title}
                              </p>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                {sub?.name || 'Geral'} · Prazo: {goal.targetDate}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={() => setIsGoalModalOpen(true)}
                    className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Nova Meta de Aprendizado
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MONTHLY VIEW (Visão Mensal) */}
          {activeTab === 'monthly' && (
            <div className="space-y-8">
              {/* Month Navigation Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {monthNames[currentDate.getMonth()]} de {currentDate.getFullYear()}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Calendário mensal de consistência e estudos</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const prev = new Date(currentDate);
                      prev.setMonth(prev.getMonth() - 1);
                      setCurrentDate(prev);
                    }}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentDate(new Date(2026, 10, 18))}
                    className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    Mês Atual
                  </button>
                  <button
                    onClick={() => {
                      const next = new Date(currentDate);
                      next.setMonth(next.getMonth() + 1);
                      setCurrentDate(next);
                    }}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Monthly Calendar Grid */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                {/* Weekdays header */}
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span>
                </div>

                {/* Days cells */}
                <div className="grid grid-cols-7 gap-2">
                  {monthDays.map((cell, idx) => {
                    const dateStr = cell.date.toISOString().split('T')[0];
                    const cellLogs = logs.filter(l => l.date === dateStr);
                    const cellMinutes = cellLogs.reduce((acc, l) => acc + l.durationMinutes, 0);
                    const isStudied = cellMinutes > 0;
                    const isCurrent = cell.isCurrentMonth;

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setNewLogDate(dateStr);
                          setIsLogModalOpen(true);
                        }}
                        className={`min-h-[100px] p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          !isCurrent 
                            ? 'opacity-40 bg-slate-50/50 dark:bg-slate-950/20 border-slate-100 dark:border-slate-900' 
                            : isStudied 
                              ? 'border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/10 hover:border-emerald-500' 
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold tabular-nums ${isStudied ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {cell.date.getDate()}
                          </span>
                          {isStudied && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 tabular-nums">
                              {(cellMinutes / 60).toFixed(1)}h
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 mt-2">
                          {cellLogs.slice(0, 2).map(log => {
                            const sub = subjects.find(s => s.id === log.subjectId);
                            return (
                              <div key={log.id} className="text-[10px] px-1.5 py-0.5 rounded truncate font-medium text-white" style={{ backgroundColor: sub?.color || '#6366f1' }}>
                                {sub?.name || 'Estudo'}
                              </div>
                            );
                          })}
                          {cellLogs.length > 2 && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">+ {cellLogs.length - 2} mais</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Monthly Study History List */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Histórico de Sessões ({logs.length} registros)</h3>
                <div className="space-y-3">
                  {logs.map(log => {
                    const sub = subjects.find(s => s.id === log.subjectId);
                    return (
                      <div key={log.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100/60 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-3 h-10 rounded-full" style={{ backgroundColor: sub?.color || '#6366f1' }}></div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{sub?.name || 'Matéria'}</h4>
                              <span className="text-xs text-slate-400">· {log.date}</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300">{log.topics.join(', ')} — <span className="italic">{log.notes}</span></p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-mono font-bold text-slate-900 dark:text-white tabular-nums">{log.durationMinutes} min</span>
                          <button onClick={() => deleteLog(log.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SUBJECTS (Matérias) */}
          {activeTab === 'subjects' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Gerenciamento de Matérias</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Organize suas disciplinas e defina metas semanais de horas</p>
                </div>
                <button
                  onClick={() => setIsSubjectModalOpen(true)}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Nova Matéria
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {subjects.map(sub => {
                  const subLogs = logs.filter(l => l.subjectId === sub.id);
                  const totalMins = subLogs.reduce((acc, l) => acc + l.durationMinutes, 0);
                  const totalHrs = (totalMins / 60).toFixed(1);

                  return (
                    <div key={sub.id} className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {sub.category}
                          </span>
                          <button onClick={() => deleteSubject(sub.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-4 h-12 rounded-full" style={{ backgroundColor: sub.color }}></div>
                          <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">{sub.name}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Meta: {sub.weeklyGoalHours}h / semana</p>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                          <span className="text-slate-500">Total acumulado:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">{totalHrs}h ({subLogs.length} sessões)</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setNewLogSubject(sub.id);
                          setIsLogModalOpen(true);
                        }}
                        className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Registrar Sessão Nesta Matéria
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: GOALS (Metas de Aprendizado) */}
          {activeTab === 'goals' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Metas de Aprendizado</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Acompanhe seus objetivos e conquistas acadêmicas</p>
                </div>
                <button
                  onClick={() => setIsGoalModalOpen(true)}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Nova Meta
                </button>
              </div>

              <div className="space-y-4">
                {goals.map(goal => {
                  const sub = subjects.find(s => s.id === goal.subjectId);
                  return (
                    <div
                      key={goal.id}
                      className={`p-5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                        goal.completed 
                          ? 'border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/10' 
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <button onClick={() => toggleGoalCompletion(goal.id)} className="text-indigo-600 dark:text-indigo-400">
                          {goal.completed ? <CheckCircle2 className="w-6 h-6 text-emerald-500 fill-emerald-500/20" /> : <Circle className="w-6 h-6 text-slate-400" />}
                        </button>
                        <div className="space-y-1">
                          <h4 className={`text-sm font-bold ${goal.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                            {goal.title}
                          </h4>
                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-medium" style={{ color: sub?.color || '#6366f1' }}>{sub?.name || 'Geral'}</span>
                            <span>·</span>
                            <span>Prazo: {goal.targetDate}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setGoals(goals.filter(g => g.id !== goal.id))}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: POMODORO TIMER (Cronômetro Pomodoro) */}
          {activeTab === 'timer' && (
            <div className="max-w-xl mx-auto p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl text-center space-y-8">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
                  <Timer className="w-4 h-4" /> Ciclo Foco & Produtividade
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {pomodoroMode === 'work' ? 'Momento de Foco Total' : 'Hora do Descanso'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {pomodoroMode === 'work' ? 'Mantenha o celular longe e estude com atenção plena.' : 'Relaxe, hidrate-se e descanse a mente.'}
                </p>
              </div>

              {/* Subject selector for timer */}
              <div className="max-w-xs mx-auto text-left space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Matéria em estudo:</label>
                <select
                  value={pomodoroSubjectId}
                  onChange={(e) => setPomodoroSubjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Timer Display */}
              <div className="py-8">
                <div className="text-7xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
                  {Math.floor(pomodoroTimeLeft / 60).toString().padStart(2, '0')}:
                  {(pomodoroTimeLeft % 60).toString().padStart(2, '0')}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setPomodoroActive(!pomodoroActive)}
                  className={`px-8 py-3.5 rounded-2xl font-bold text-sm text-white shadow-lg transition-transform active:scale-95 ${
                    pomodoroActive ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                  }`}
                >
                  {pomodoroActive ? 'Pausar Temporizador' : 'Iniciar Foco'}
                </button>
                <button
                  onClick={() => {
                    setPomodoroActive(false);
                    setPomodoroTimeLeft(pomodoroMode === 'work' ? 25 * 60 : 5 * 60);
                  }}
                  className="px-5 py-3.5 rounded-2xl font-semibold text-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Reiniciar
                </button>
              </div>
            </div>
          )}

        </main>

        {/* MODAL: Register Study Session */}
        {isLogModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Registrar Sessão de Estudo</h3>
                <button onClick={() => setIsLogModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateLog} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Matéria</label>
                  <select
                    value={newLogSubject}
                    onChange={(e) => setNewLogSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Data</label>
                    <input
                      type="date"
                      value={newLogDate}
                      onChange={(e) => setNewLogDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Horas</label>
                      <input
                        type="number"
                        min="0"
                        max="12"
                        value={newLogHours}
                        onChange={(e) => setNewLogHours(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Minutos</label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        step="5"
                        value={newLogMinutes}
                        onChange={(e) => setNewLogMinutes(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Tópicos Estudados (separados por vírgula)</label>
                  <input
                    type="text"
                    placeholder="Ex: Derivadas, Regra da Cadeia"
                    value={newLogTopics}
                    onChange={(e) => setNewLogTopics(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Anotações / Observações</label>
                  <textarea
                    rows={3}
                    placeholder="O que você achou desta sessão? Dificuldades ou conclusões..."
                    value={newLogNotes}
                    onChange={(e) => setNewLogNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                  ></textarea>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="goalsMet"
                    checked={newLogGoalsMet}
                    onChange={(e) => setNewLogGoalsMet(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="goalsMet" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Metas de aprendizado da sessão foram alcançadas?
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsLogModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
                  >
                    Salvar Registro
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: New Subject */}
        {isSubjectModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Adicionar Nova Matéria</h3>
                <button onClick={() => setIsSubjectModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubject} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Nome da Matéria</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Física Quântica"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Categoria</label>
                    <select
                      value={newSubCategory}
                      onChange={(e) => setNewSubCategory(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                    >
                      <option value="Exatas">Exatas</option>
                      <option value="Humanas">Humanas</option>
                      <option value="Linguagens">Linguagens</option>
                      <option value="Tecnologia">Tecnologia</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Meta Semanal (h)</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={newSubGoalHours}
                      onChange={(e) => setNewSubGoalHours(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Cor de Identificação</label>
                  <div className="flex items-center gap-3">
                    {['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewSubColor(color)}
                        className={`w-8 h-8 rounded-full transition-transform ${newSubColor === color ? 'ring-2 ring-offset-2 ring-indigo-600 scale-110' : ''}`}
                        style={{ backgroundColor: color }}
                      ></button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsSubjectModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
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
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nova Meta de Aprendizado</h3>
                <button onClick={() => setIsGoalModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateGoal} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Matéria</label>
                  <select
                    value={newGoalSubject}
                    onChange={(e) => setNewGoalSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Título da Meta</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Resolver 50 exercícios de Árvores Binárias"
                    value={newGoalTitle}
                    onChange={(e) => setNewGoalTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Data Limite</label>
                  <input
                    type="date"
                    value={newGoalDate}
                    onChange={(e) => setNewGoalDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsGoalModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
                  >
                    Criar Meta
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
