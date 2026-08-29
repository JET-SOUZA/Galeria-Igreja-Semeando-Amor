# Semeando Memórias — deploy controlado

Checkpoint: 2026-08-29

## Estado atual da produção

O projeto Vercel de produção é `semeando-memorias` (`prj_wfKEX417Si9FsIpLBmnZ9nqLaGBR`).

O deploy de produção verificado em 2026-08-29 executou esta sequência:

1. Vercel recebeu um pacote mínimo de 2 arquivos de deployment.
2. `npm install` foi executado.
3. O build chamou `node fetch-app.js && next build`.
4. `fetch-app.js` buscou 12 arquivos de aplicação durante o build.
5. Somente depois o Next.js foi compilado.

Esse bootstrap não está versionado como fonte do `webapp/` nesta branch e não deve continuar como caminho oficial de produção.

### Risco técnico do bootstrap

Dependências são instaladas **antes** de `fetch-app.js` baixar a aplicação. Portanto um `package.json` obtido ou substituído durante o próprio build não é uma fonte confiável para instalar novas dependências.

Isso é especialmente importante para o worker moderno do iCloud, que depende de:

- `puppeteer-core`
- `@sparticuz/chromium-min`

O deploy definitivo deve instalar dependências diretamente do `webapp/package.json` versionado, sem buscar código remoto durante o build.

## Fonte oficial proposta

A fonte de deploy deve ser exclusivamente a pasta `webapp/` deste repositório.

Configuração validada na branch:

- Framework: Next.js
- Root/CWD: `webapp`
- Node: `22.x`, fixado em `webapp/package.json`
- Install: `npm install --no-audit --no-fund`
- Build: `npm run build` → `next build`
- Configuração: `webapp/vercel.json`
- Verificação: `npm run check:deploy`

O comando de build não pode conter `fetch-app.js` ou outro bootstrap que baixe a aplicação em tempo de build.

## Gate de CI

O workflow `Validate Semeando Memorias imports` agora executa, nesta ordem:

1. instalação das dependências;
2. `npm run check:deploy`;
3. regressão do ZIP;
4. build completo do Next.js.

`check:deploy` bloqueia a validação se:

- um arquivo crítico do app estiver ausente;
- o build deixar de ser `next build`;
- `fetch-app` aparecer nos scripts;
- Node deixar de estar fixado em `22.x`;
- dependências necessárias ao ZIP/iCloud estiverem ausentes;
- o worker moderno perder a seleção por `resOriginalRes`.

## Migração segura do Vercel

Não alterar a produção até o PR fechar os testes reais do iCloud.

Quando estiver pronto para migrar:

1. manter o deploy atual como rollback conhecido;
2. criar primeiro um Preview usando `webapp/` diretamente;
3. validar login/admin, criação de evento, upload local, Drive, ZIP, iCloud e reconhecimento facial em evento de teste;
4. confirmar que o Preview instalou Puppeteer/Chromium durante `npm install`;
5. comparar as rotas geradas com a produção atual;
6. só então promover o mesmo artefato/configuração para produção;
7. manter o deploy anterior disponível para rollback imediato.

## Regra de propriedade

Código de aplicação, dependências, scripts de build e configuração de deploy devem permanecer versionados no repositório do projeto. Produção não deve depender de um script externo não versionado para reconstruir o aplicativo.
