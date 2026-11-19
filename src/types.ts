export interface Subject {
  id: string;
  name: string;
  color: string; // Tailwind color class or hex e.g. 'bg-indigo-500' or '#6366f1'
  category: 'Exatas' | 'Humanas' | 'Linguagens' | 'Tecnologia' | 'Outros';
  weeklyGoalHours: number;
}

export interface StudyLog {
  id: string;
  subjectId: string;
  date: string; // 'YYYY-MM-DD'
  durationMinutes: number;
  topics: string[];
  notes: string;
  goalsMet: boolean;
}

export interface LearningGoal {
  id: string;
  subjectId: string;
  title: string;
  targetDate: string; // 'YYYY-MM-DD'
  completed: boolean;
}

export type ViewMode = 'weekly' | 'monthly' | 'subjects' | 'goals' | 'timer' | 'analytics';
