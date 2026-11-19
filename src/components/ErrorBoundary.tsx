import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erro inesperado ao carregar a aplicação.',
    };
  }

  handleResetAndReload = () => {
    try {
      localStorage.removeItem('estudapro_subjects');
      localStorage.removeItem('estudapro_logs');
      localStorage.removeItem('estudapro_goals');
      localStorage.removeItem('estudapro_theme');
    } catch {
      // ignore storage errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <h1 className="text-lg font-bold text-slate-900">
              Não foi possível carregar o painel
            </h1>
            <p className="text-sm text-slate-600">
              Ocorreu um erro ao inicializar os dados locais no navegador. Você pode restaurar os dados padrão para continuar usando o sistema.
            </p>
            <p className="text-xs font-mono text-slate-500 bg-slate-100 p-3 rounded-lg break-words">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={this.handleResetAndReload}
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors"
            >
              Restaurar dados padrão e recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
