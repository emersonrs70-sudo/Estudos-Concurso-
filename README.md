# EstudaPro — Sistema de Gestão de Estudos

Aplicação web para controle de estudos semanais e mensais, acompanhamento de tempo dedicado por matéria, metas de aprendizado e gráficos de desempenho em tempo real, com persistência na nuvem via **Firebase Firestore** e autenticação Google.

## Persistência na Nuvem (Firebase)

- **Autenticação Google (`Firebase Auth`)**: Cada usuário acessa seus próprios dados de forma isolada e segura.
- **Sincronização em Tempo Real (`Cloud Firestore`)**: Todas as alterações (matérias, registros de estudo, metas, ciclos Pomodoro e preferência de tema) são salvas diretamente no Firestore e sincronizadas entre dispositivos.
- **Portabilidade JSON**: Também é possível exportar e importar backups `.json` diretamente para sua conta no Firestore.

## Como Hospedar no GitHub Pages

Este repositório já está configurado com caminho relativo (`base: './'` no `vite.config.ts`), arquivo `public/.nojekyll` e workflow automático em `.github/workflows/deploy.yml` usando **Node 22**.

1. Envie todos os arquivos do projeto para a branch `main` (ou `master`) no GitHub.
2. No seu repositório do GitHub, acesse **Settings → Pages → Build and deployment → Source** e selecione **GitHub Actions**.
3. No **Firebase Console → Authentication → Settings → Authorized domains**, adicione o domínio do seu GitHub Pages (ex.: `seu-usuario.github.io`) para permitir o login com Google na URL publicada.
4. Aguarde a execução do workflow **Deploy to GitHub Pages** na aba **Actions**.

## Desenvolvimento Local

```bash
npm install
npm run dev
```

Para gerar a versão de produção estática (pasta `dist/`):

```bash
npm run build
```
