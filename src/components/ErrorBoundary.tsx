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

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      let friendlyDetail = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed && parsed.error) {
          friendlyDetail = `${parsed.error} (${parsed.operationType || 'operação'} em ${parsed.path || 'Firestore'})`;
        }
      } catch {
        // plain error message
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <h1 className="text-lg font-bold text-slate-900">
              Ocorreu um erro na aplicação
            </h1>
            <p className="text-sm text-slate-600">
              Não foi possível concluir a comunicação com o Firebase ou processar os dados da tela.
            </p>
            <p className="text-xs font-mono text-slate-500 bg-slate-100 p-3 rounded-lg break-words">
              {friendlyDetail}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors"
            >
              Recarregar aplicação
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
