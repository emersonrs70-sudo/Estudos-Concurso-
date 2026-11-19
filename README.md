# EstudaPro — Sistema de Gestão de Estudos

Aplicação web estática para controle de estudos semanais e mensais, acompanhamento de tempo dedicado por matéria, metas de aprendizado e gráficos de desempenho em tempo real. Projetada para funcionar diretamente no navegador e ser hospedada gratuitamente no **GitHub Pages**.

## Como Hospedar no GitHub Pages (Passo a Passo)

Este repositório já está configurado com caminho relativo (`base: './'` no `vite.config.ts`), arquivo `public/.nojekyll` e workflow automático em `.github/workflows/deploy.yml` usando **Node 22**.

1. Envie todos os arquivos do projeto para a branch `main` (ou `master`) no GitHub.
2. No seu repositório do GitHub, acesse **Settings → Pages**.
3. Em **Build and deployment → Source**, selecione **GitHub Actions** (não deixe em *Deploy from a branch*, pois o código-fonte React/TypeScript precisa ser compilado para a pasta `dist/`).
4. Aguarde a execução do workflow **Deploy to GitHub Pages** na aba **Actions**. Ao concluir com sucesso, o link oficial do GitHub Pages estará ativo.

> **Dica caso a tela fique branca:** Verifique em **Settings → Pages → Source** se a opção selecionada é **GitHub Actions** e confirme na aba **Actions** se o deploy foi concluído sem erros. Se a fonte estiver como *Deploy from a branch* apontando para a raiz `/`, o navegador tentará abrir o `index.html` de desenvolvimento (`/src/main.tsx`) e exibirá tela branca.

## Desenvolvimento Local

```bash
npm install
npm run dev
```

Para gerar a versão de produção estática (pasta `dist/`):

```bash
npm run build
```
