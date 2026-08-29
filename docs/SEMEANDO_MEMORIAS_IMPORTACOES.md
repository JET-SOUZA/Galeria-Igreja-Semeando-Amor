# Semeando Memórias — importações de fotos

Checkpoint técnico: 2026-08-29

## Princípios

- Não reconstruir o sistema nem remover fluxos existentes.
- Upload local, Google Drive, Cloudinary, usuários/leads e reconhecimento facial continuam independentes das novas importações.
- Nenhum secret deve existir no frontend ou no repositório.
- Novos lotes usam status persistente para permitir retomada e diagnóstico por item.

## ZIP — causa do erro no iPhone/iCloud Drive

O fluxo anterior guardava objetos `File` recebidos pelo `<input type=file>` e só tentava lê-los depois, quando o administrador clicava em “Ler ZIP e importar fotos”. Em iOS/WebKit, especialmente quando o arquivo vem de um provedor como iCloud Drive, o acesso temporário concedido pelo seletor pode deixar de ser válido. A leitura posterior então pode lançar `NotReadableError` com a mensagem “The requested file could not be read... after a reference to a file was acquired”.

A correção incremental é copiar os bytes do ZIP imediatamente no evento `onChange` (`file.arrayBuffer()`), enquanto o navegador ainda possui acesso ao arquivo, e só depois trabalhar sobre essa cópia controlada pelo app.

Para lotes grandes, essa correção resolve a perda de permissão, mas não é a arquitetura final: manter um ZIP muito grande inteiro na RAM do navegador aumenta o risco de pressão de memória. A evolução prevista é staging no backend + processamento por job.

## iCloud — diferença importante

Existem dois tipos de compartilhamento Apple que parecem semelhantes mas não usam necessariamente o mesmo mecanismo:

1. **Shared Album clássico** (`icloud.com/sharedalbum/#...`) — existe um endpoint não documentado `sharedstreams` usado por implementações comunitárias (`webstream` + `webasseturls`).
2. **Link moderno do app Fotos** (`share.icloud.com/photos/...`) — é uma aplicação web JavaScript. Para importação confiável em 2026, é necessário um backend capaz de executar um navegador headless (Chromium/Playwright ou Puppeteer), observar/acionar o download e capturar as URLs CDN/originais.

O Edge Function `icloud-import` existente tentou tratar o link moderno como Shared Album e, para um link real do projeto, recebeu HTTP 404 da Apple. Portanto o botão não deve ser considerado “pronto” apenas porque existe no frontend.

## Arquitetura de importação persistente

Novas tabelas:

- `media_import_jobs`: um registro por lote.
- `media_import_items`: um registro por foto/arquivo.

Estados do job: `pending`, `discovering`, `ready`, `processing`, `completed`, `partial`, `failed`, `cancelled`, `needs_worker`.

Cada item registra tentativa, status, foto criada e erro individual. Isso permite:

- mostrar `370 / 487` mesmo após recarregar a página;
- continuar sem depender da aba aberta;
- repetir somente falhas;
- não duplicar itens já importados;
- auditar a origem (`icloud`, `zip`, `drive`).

As tabelas têm RLS ativo e não expõem políticas para anon/authenticated. O acesso deve ocorrer exclusivamente por backend autenticado.

## Worker iCloud recomendado

Para `share.icloud.com/photos/...`, usar uma Function Node.js com Chromium headless. Fluxo:

1. Edge/API autentica administrador e cria `media_import_jobs`.
2. Worker abre o link público do iCloud.
3. Descobre o total de miniaturas e os downloads/CDN originais.
4. Registra itens no job.
5. Processa em lotes pequenos com concorrência limitada.
6. Envia cada imagem para Cloudinary.
7. Insere `photos` com `source_type='icloud'`, identificador de origem e `face_index_status='pending'`.
8. Atualiza contadores persistentes.
9. Falhas ficam individualizadas e podem ser reenfileiradas.

Não guardar a foto usada em busca facial como referência permanente.

## Reconhecimento facial

Hoje o fluxo legado `prepare_index` recria a coleção e marca todas as fotos como pendentes. Isso funciona, mas reprocessa fotos já indexadas. A evolução correta é adicionar um modo incremental que selecione apenas `photos.face_index_status in ('pending','failed')`, preservando a coleção existente quando ela estiver saudável.

## Produção em 2026-08-29

O deploy Vercel de produção verificado em 2026-08-29 16:32 UTC contém uma versão mais nova do gerenciador de fotos do que `webapp/app/admin/evento/[slug]/fotos/page.tsx` da `main`. O deploy usa um bootstrap `fetch-app.js` antes do `next build`, portanto antes de um novo deploy é obrigatório reconciliar a fonte legível do repositório com a versão efetivamente publicada.

Não publicar a `main` antiga por cima da produção: isso reintroduziria o iCloud que apenas abre a Apple e o ZIP que mantém o `File` temporário até o clique.
