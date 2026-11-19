import { Subject, StudyLog, LearningGoal } from './types';

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const getRelativeDateString = (dayOffset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return formatLocalDate(d);
};

export const INITIAL_SUBJECTS: Subject[] = [
  { id: 'sub-1', name: 'Matemática Avançada', color: '#4f46e5', category: 'Exatas', weeklyGoalHours: 6 },
  { id: 'sub-2', name: 'Algoritmos & Estruturas de Dados', color: '#0284c7', category: 'Tecnologia', weeklyGoalHours: 8 },
  { id: 'sub-3', name: 'Física I (Mecânica)', color: '#059669', category: 'Exatas', weeklyGoalHours: 5 },
  { id: 'sub-4', name: 'História Contemporânea', color: '#d97706', category: 'Humanas', weeklyGoalHours: 4 },
  { id: 'sub-5', name: 'Inglês Instrumental', color: '#db2777', category: 'Linguagens', weeklyGoalHours: 3 },
];

export const INITIAL_LOGS: StudyLog[] = [
  {
    id: 'log-1',
    subjectId: 'sub-1',
    date: getRelativeDateString(-6),
    durationMinutes: 90,
    topics: ['Derivadas parciais', 'Regra da cadeia em várias variáveis'],
    notes: 'Estudo focado em resolver listas de exercícios 3 e 4.',
    goalsMet: true,
  },
  {
    id: 'log-2',
    subjectId: 'sub-2',
    date: getRelativeDateString(-6),
    durationMinutes: 120,
    topics: ['Árvores Binárias de Busca', 'Percursos em ordem e pós-ordem'],
    notes: 'Implementação em TypeScript de BST com inserção e busca.',
    goalsMet: true,
  },
  {
    id: 'log-3',
    subjectId: 'sub-3',
    date: getRelativeDateString(-4),
    durationMinutes: 75,
    topics: ['Leis de Newton', 'Plano inclinado com atrito'],
    notes: 'Revisão de diagramas de corpo livre.',
    goalsMet: false,
  },
  {
    id: 'log-4',
    subjectId: 'sub-1',
    date: getRelativeDateString(-3),
    durationMinutes: 105,
    topics: ['Integrais Múltiplas', 'Coordenadas Polares'],
    notes: 'Ótima sessão, compreensão clara da mudança de variáveis.',
    goalsMet: true,
  },
  {
    id: 'log-5',
    subjectId: 'sub-4',
    date: getRelativeDateString(-3),
    durationMinutes: 60,
    topics: ['Guerra Fria', 'Crise dos Mísseis em Cuba'],
    notes: 'Leitura de capítulos 7 e 8 do livro base.',
    goalsMet: true,
  },
  {
    id: 'log-6',
    subjectId: 'sub-2',
    date: getRelativeDateString(-2),
    durationMinutes: 150,
    topics: ['Grafos', 'Busca em Largura (BFS) e Profundidade (DFS)'],
    notes: 'Resolução de problemas práticos de travessia.',
    goalsMet: true,
  },
  {
    id: 'log-7',
    subjectId: 'sub-5',
    date: getRelativeDateString(-1),
    durationMinutes: 45,
    topics: ['Reading Comprehension', 'Academic Vocabulary'],
    notes: 'Tradução e análise de artigo técnico.',
    goalsMet: true,
  },
  {
    id: 'log-8',
    subjectId: 'sub-3',
    date: getRelativeDateString(0),
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
    targetDate: getRelativeDateString(5),
    completed: true,
  },
  {
    id: 'goal-2',
    subjectId: 'sub-2',
    title: 'Implementar algoritmos de caminho mínimo (Dijkstra)',
    targetDate: getRelativeDateString(10),
    completed: false,
  },
  {
    id: 'goal-3',
    subjectId: 'sub-3',
    title: 'Resolver 30 questões de dinâmica e atrito',
    targetDate: getRelativeDateString(8),
    completed: false,
  },
  {
    id: 'goal-4',
    subjectId: 'sub-4',
    title: 'Resumo completo sobre a geopolítica da Guerra Fria',
    targetDate: getRelativeDateString(2),
    completed: true,
  },
];
