# EstudaPro — Sistema de Gestão de Estudos

Aplicação web estática para controle de estudos semanais e mensais, acompanhamento de tempo dedicado por matéria, metas de aprendizado e gráficos de desempenho em tempo real. Projetada para funcionar diretamente no navegador e ser hospedada gratuitamente no **GitHub Pages**.

## Funcionalidades

- **Visão Semanal e Mensal**: Alternância rápida entre semana e mês com indicação clara dos dias estudados e dos dias sem registro, além de detalhamento completo do que foi estudado em cada dia.
- **Gráficos de Desempenho em Tempo Real**: Gráficos interativos de barras diárias (empilhadas por matéria) e progresso em relação às metas semanais/mensais.
- **Gestão de Matérias e Metas**: Cadastro de disciplinas por área, definição de metas semanais de horas e acompanhamento de objetivos de aprendizado.
- **Cronômetro Pomodoro Integrado**: Ciclos de foco e pausa com registro automático da sessão ao concluir o tempo de estudo.
- **100% Client-Side com Backup JSON**: Todos os dados ficam salvos localmente no navegador (`localStorage`), com suporte a exportação e importação de backup em arquivo `.json`.

## Como Hospedar no GitHub Pages

Este repositório já está configurado com caminho relativo (`base: './'` no `vite.config.ts`), arquivo `public/.nojekyll` e workflow automático em `.github/workflows/deploy.yml`.

1. Crie um repositório no GitHub e envie este código para a branch `main`.
2. No GitHub, acesse **Settings → Pages**.
3. Em **Build and deployment → Source**, selecione **GitHub Actions**.
4. A cada `push` na branch `main` (ou executando manualmente na aba **Actions**), o site será compilado e publicado automaticamente.

## Desenvolvimento Local

```bash
npm install
npm run dev
```

Para gerar a versão de produção estática (pasta `dist/`):

```bash
npm run build
```
