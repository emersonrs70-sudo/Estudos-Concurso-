# Especificação de Segurança Firestore (EstudaPro)

## 1. Invariantes de Dados (Data Invariants)
1. **Isolamento por Proprietário (Owner Isolation)**: Todos os documentos em `/users/{userId}` e suas subcoleções (`subjects`, `logs`, `goals`) pertencem exclusivamente ao usuário autenticado cujo `request.auth.uid == userId` e `request.auth.token.email_verified == true`.
2. **Integridade Referencial (Master Gate & Referential Integrity)**: Nenhuma matéria, sessão de estudo ou meta pode ser criada sem que `/users/{userId}` exista (ou seja criado atomicamente no mesmo batch via `existsAfter`). Nenhuma sessão de estudo ou meta pode referenciar um `subjectId` inexistente.
3. **Imutabilidade de Identidade e Criação**: `ownerId` e `createdAt` jamais podem ser alterados após a criação.
4. **Integridade Temporal**: `createdAt` e `updatedAt` devem ser iguais a `request.time` (serverTimestamp).
5. **Limites Volumétricos e de Tipo**: Todos os IDs obedecem `^[a-zA-Z0-9_\\-]+$` com tamanho máximo de 128 caracteres; strings e arrays possuem limites explícitos de `.size()`.

## 2. "Dirty Dozen" Payloads (Vetores de Ataque Bloqueados)
1. **Unauthenticated Write**: Criação/leitura sem `request.auth != null` -> `PERMISSION_DENIED`.
2. **Unverified Email**: Usuário autenticado com `email_verified: false` -> `PERMISSION_DENIED`.
3. **Cross-Tenant Read/List**: Usuário B tentando listar `/users/userA/logs` -> `PERMISSION_DENIED`.
4. **Owner Spoofing on Create**: Usuário A tentando criar matéria em `/users/userA/subjects/sub1` com `ownerId: "userB"` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: Payload com campo extra `isAdmin: true` ou `role: "admin"` -> bloqueado por `keys().hasOnly(...)`.
6. **ID Poisoning**: Documento criado com ID de 500 caracteres ou caracteres inválidos (`../admin`) -> bloqueado por `isValidId()`.
7. **Timestamp Forgery**: Envio de `createdAt` ou `updatedAt` com data retroativa do cliente em vez de `request.time` -> `PERMISSION_DENIED`.
8. **Orphaned StudyLog**: Criação de sessão de estudo referenciando `subjectId: "inexistente"` -> bloqueado por `exists()` / `existsAfter()`.
9. **Array Flood on Topics**: Envio de array `topics` com 1000 itens ou item não-string -> bloqueado por `topics.size() <= 15` e validação de índice.
10. **Duration Abuse**: Envio de `durationMinutes: -50` ou `durationMinutes: 99999` -> bloqueado por `>= 1 && <= 1440`.
11. **Immutable Field Tampering on Update**: Tentativa de alterar `ownerId` ou `createdAt` durante atualização -> `PERMISSION_DENIED`.
12. **Blanket User List Scraping**: Tentativa de executar `list` em `/users` -> `allow list: if false`.
