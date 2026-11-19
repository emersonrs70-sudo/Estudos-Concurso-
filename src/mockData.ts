import { Subject, StudyLog, LearningGoal } from './types';

export const INITIAL_SUBJECTS: Subject[] = [
  { id: 'sub-1', name: 'Matemática Avançada', color: '#6366f1', category: 'Exatas', weeklyGoalHours: 6 },
  { id: 'sub-2', name: 'Algoritmos & Estruturas de Dados', color: '#0ea5e9', category: 'Tecnologia', weeklyGoalHours: 8 },
  { id: 'sub-3', name: 'Física I (Mecânica)', color: '#10b981', category: 'Exatas', weeklyGoalHours: 5 },
  { id: 'sub-4', name: 'História Contemporânea', color: '#f59e0b', category: 'Humanas', categoryColor: '#f59e0b', weeklyGoalHours: 4 } as any,
  { id: 'sub-5', name: 'Inglês Instrumental', color: '#ec4899', category: 'Linguagens', weeklyGoalHours: 3 },
];

// Generate sample study logs for November 2026
const getRecentDateString = (dayOffset: number) => {
  const d = new Date(2026, 10, 18); // Nov 18, 2026
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().split('T')[0];
};

export const INITIAL_LOGS: StudyLog[] = [
  {
    id: 'log-1',
    subjectId: 'sub-1',
    date: getRecentDateString(-5),
    durationMinutes: 90,
    topics: ['Derivadas parciais', 'Regra da cadeia em várias variáveis'],
    notes: 'Estudo focado em resolver listas de exercícios 3 e 4.',
    goalsMet: true,
  },
  {
    id: 'log-2',
    subjectId: 'sub-2',
    date: getRecentDateString(-5),
    durationMinutes: 120,
    topics: ['Árvores Binárias de Busca', 'Percursos em ordem e pós-ordem'],
    notes: 'Implementação em TypeScript de BST com inserção e busca.',
    goalsMet: true,
  },
  {
    id: 'log-3',
    subjectId: 'sub-3',
    date: getRecentDateString(-4),
    durationMinutes: 75,
    topics: ['Leis de Newton', 'Plano inclinado com atrito'],
    notes: 'Revisão de diagramas de corpo livre.',
    goalsMet: false,
  },
  {
    id: 'log-4',
    subjectId: 'sub-1',
    date: getRecentDateString(-3),
    durationMinutes: 105,
    topics: ['Integrais Múltiplas', 'Coordenadas Polares'],
    notes: 'Ótima sessão, compreensão clara da mudança de variáveis.',
    goalsMet: true,
  },
  {
    id: 'log-5',
    subjectId: 'sub-4',
    date: getRecentDateString(-3),
    durationMinutes: 60,
    topics: ['Guerra Fria', 'Crise dos Mísseis em Cuba'],
    notes: 'Leitura de capítulos 7 e 8 do livro base.',
    goalsMet: true,
  },
  {
    id: 'log-6',
    subjectId: 'sub-2',
    date: getRecentDateString(-2),
    durationMinutes: 150,
    topics: ['Grafos', 'Busca em Largura (BFS) e Profundidade (DFS)'],
    notes: 'Resolução de problemas no LeetCode.',
    goalsMet: true,
  },
  {
    id: 'log-7',
    subjectId: 'sub-5',
    date: getRecentDateString(-1),
    durationMinutes: 45,
    topics: ['Reading Comprehension', 'Academic Vocabulary'],
    notes: 'Tradução e análise de paper científico.',
    goalsMet: true,
  },
  {
    id: 'log-8',
    subjectId: 'sub-3',
    date: getRecentDateString(0),
    durationMinutes: 90,
    topics: ['Trabalho e Energia', 'Conservação de Energia Mecânica'],
    notes: 'Exercícios práticos de sistemas conservativos.',
    goalsMet: true,
  },
];

export const INITIAL_GOALS: LearningGoal[] = [
  {
    id: 'goal-1',
    subjectId: 'sub-1',
    title: 'Dominar o cálculo de integrais duplas e triplas',
    targetDate: '2026-11-25',
    completed: true,
  },
  {
    id: 'goal-2',
    subjectId: 'sub-2',
    title: 'Implementar algoritmos de caminho mínimo (Dijkstra)',
    targetDate: '2026-11-30',
    completed: false,
  },
  {
    id: 'goal-3',
    subjectId: 'sub-3',
    title: 'Resolver 30 questões de dinâmica e atrito',
    targetDate: '2026-11-28',
    completed: false,
  },
  {
    id: 'goal-4',
    subjectId: 'sub-4',
    title: 'Resumo completo sobre a geopolítica da Guerra Fria',
    targetDate: '2026-11-22',
    completed: true,
  },
];
