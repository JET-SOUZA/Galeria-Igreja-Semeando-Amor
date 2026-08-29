# Semeando Memórias — importações de fotos

Checkpoint técnico: 2026-08-29

## Princípios

- Não reconstruir o sistema nem remover fluxos existentes.
- Upload local, Google Drive, Cloudinary, usuários/leads e reconhecimento facial continuam independentes das novas importações.
- Nenhum secret, link privado do iCloud, URL CDN assinada ou token deve existir no frontend, no PR ou no repositório.
- Novos lotes usam status persistente para permitir retomada e diagnóstico por item.
- Produção não deve receber o frontend desta branch antes da validação real do iCloud e da reconciliação do pipeline Vercel.

## ZIP — causa do erro no iPhone/iCloud Drive

O fluxo anterior guardava objetos `File` recebidos pelo `<input type=file>` e só tentava lê-los depois, quando o administrador clicava em “Ler ZIP e importar fotos”. Em iOS/WebKit, especialmente quando o arquivo vem de um provedor como iCloud Drive, o acesso temporário concedido pelo seletor pode deixar de ser válido. A leitura posterior então pode lançar `NotReadableError` com a mensagem “The requested file could not be read... after a reference to a file was acquired”.

A correção incremental copia os bytes do ZIP imediatamente no evento `onChange` (`file.arrayBuffer()`), enquanto o navegador ainda possui acesso ao arquivo, e só depois trabalha sobre essa cópia controlada pelo app.

O fluxo também:

- ignora `__MACOSX/` e arquivos `._...`;
- filtra arquivos não-imagem;
- aceita JPG/JPEG/PNG/WEBP/HEIC/HEIF/GIF/AVIF;
- mostra progresso;
- permite repetir somente itens que falharam;
- cede o event loop periodicamente para reduzir travamentos no navegador.

Para lotes muito grandes, manter o ZIP inteiro na RAM continua sendo uma limitação. A evolução recomendada é staging no backend + processamento por job.

## iCloud — dois mecanismos distintos

Existem dois tipos de compartilhamento Apple que parecem semelhantes, mas não usam necessariamente o mesmo mecanismo:

1. **Shared Album clássico** (`icloud.com/sharedalbum/#...`) — utiliza o fluxo `sharedstreams` conhecido por implementações comunitárias.
2. **Link moderno do app Fotos** (`share.icloud.com/photos/...`) — é uma aplicação web JavaScript e exige descoberta em navegador headless para o fluxo atual do projeto.

O Edge Function `icloud-import` mantém compatibilidade com Shared Albums clássicos. Para links modernos ele responde de forma explícita que é necessário o browser worker, em vez de fingir que o endpoint clássico serve para os dois formatos.

## Como identificar a foto original no CloudKit

A seleção do arquivo não deve usar “a maior imagem que apareceu na tela” nem assumir que respostas JPEG do visualizador são originais. O visualizador pode carregar miniaturas e derivados.

A implementação atual usa a estrutura dos registros de fotos do CloudKit:

- `CPLMaster` representa o master do ativo;
- `fields.resOriginalRes.value.downloadURL` é a URL usada como recurso original;
- `fields.resOriginalRes.value.size` fornece o tamanho declarado do recurso;
- `resOriginalWidth` e `resOriginalHeight` fornecem as dimensões quando presentes;
- `resOriginalFileType`/`itemType` identificam o tipo do arquivo;
- `filenameEnc` é usado para recuperar o nome quando disponível.

O worker registra para importação **somente imagens confirmadas por `CPLMaster.resOriginalRes`**. As imagens observadas na rede/DOM continuam apenas como diagnóstico e não são usadas como fallback de ingestão.

Se nenhum `resOriginalRes` de imagem for confirmado, o job falha de forma segura em vez de importar miniaturas.

## Paginação e proteção contra importação parcial

O CloudKit pode responder a `records/query` com `continuationMarker`. Esse marcador significa que ainda existem resultados da consulta a buscar.

O worker acompanha as páginas relevantes com registros `CPLMaster`/`CPLAsset`. Se o último lote relevante ainda indicar continuação, a ingestão é bloqueada. Assim o sistema prefere falhar e permitir nova tentativa a concluir um evento com fotos faltando silenciosamente.

A validação isolada realizada com um compartilhamento moderno real mostrou paginação do CloudKit em múltiplos lotes, enquanto o visualizador havia carregado apenas uma quantidade menor de respostas de imagem. Isso confirma que contar miniaturas carregadas na página não é uma forma confiável de medir o total do compartilhamento.

## Privacidade e deduplicação do iCloud

- O link privado do compartilhamento não deve ser escrito em código, PR ou logs públicos.
- URLs CDN assinadas não devem ser registradas em logs públicos.
- O identificador bruto do registro CloudKit é utilizado apenas em memória durante a descoberta.
- O identificador persistido/enviado como `source_item_id` é um hash, reduzindo exposição de identificadores internos do compartilhamento.
- O backend faz deduplicação por evento + identificador de origem, evitando recriar a mesma foto em nova tentativa.

O probe de diagnóstico também foi alterado para resumir/hashear identificadores sensíveis em vez de imprimir token e caminhos CDN reais.

## Arquitetura de importação persistente

Tabelas:

- `media_import_jobs`: um registro por lote.
- `media_import_items`: um registro por foto/arquivo.

Estados do job: `pending`, `discovering`, `ready`, `processing`, `completed`, `partial`, `failed`, `canceled`, `needs_worker`.

Cada item registra tentativa, status, foto criada e erro individual. Isso permite:

- mostrar progresso mesmo após recarregar a página;
- continuar sem depender da aba aberta;
- repetir somente falhas;
- não duplicar itens já importados;
- auditar a origem (`icloud`, `zip`, `drive`, `local`).

As tabelas têm RLS ativo e não expõem políticas amplas para anon/authenticated. O acesso ocorre pelo backend autenticado.

## Worker moderno do iCloud

Fluxo atual:

1. API/Edge Function autentica o administrador e cria `media_import_jobs`.
2. É criado um token aleatório para o worker; somente o hash fica persistido.
3. O backend aciona o worker server-to-server; o token não é entregue ao navegador do administrador.
4. O worker valida o token antes de receber/usar a origem confiável do job.
5. Chromium abre o link moderno do iCloud.
6. O worker observa as respostas CloudKit e seleciona somente `CPLMaster.resOriginalRes` de imagem.
7. Paginação incompleta bloqueia a ingestão.
8. Os itens são registrados no job com identificador de origem hasheado.
9. `worker_ingest` processa lotes pequenos, envia as imagens ao Cloudinary e cria `photos`.
10. Falhas ficam individualizadas para nova tentativa.

Limitação conhecida: URLs CDN assinadas podem expirar antes de uma repetição muito tardia. Uma evolução futura é redescobrir URLs quando a tentativa ocorrer após a expiração.

## Probe protegido

O workflow `Probe iCloud link` é manual (`workflow_dispatch`) e espera `ICLOUD_TEST_LINK` como GitHub Secret.

Foi feita uma execução de verificação e o secret não estava configurado; o teste falhou antes de abrir o navegador, sem expor o link. O gatilho temporário usado somente para essa verificação foi removido em seguida. Não adicionar o link ao corpo do PR nem ao YAML para contornar essa proteção.

## Reconhecimento facial incremental

O backend mantém o fluxo legado como fallback, mas adiciona:

- `prepare_incremental`;
- `index_pending_batch`.

Quando a coleção AWS existente está saudável, somente fotos `pending`/`failed` são processadas; não é necessário apagar a coleção nem reindexar todo o evento. Rebuild completo fica como fallback para coleção inexistente/inválida.

O evento real **Batismo** permaneceu preservado durante estas alterações, com 83 fotos ativas e 189 registros de face no checkpoint verificado. Nenhum rebuild foi disparado contra ele.

## Validações automatizadas

A branch possui CI que executa:

- instalação de dependências;
- regressão de extração ZIP;
- `next build` completo.

O commit que trocou a seleção heurística do iCloud pela seleção determinística em `CPLMaster.resOriginalRes` passou integralmente nessa validação.

## Produção em 2026-08-29

O deploy Vercel de produção verificado contém uma versão do gerenciador de fotos que não corresponde simplesmente à `main` legível. O pipeline observado usa um bootstrap `fetch-app.js` antes do `next build`.

Por isso:

- não publicar a branch atual diretamente em produção ainda;
- não sobrescrever a produção com uma fonte antiga;
- primeiro entender/reconciliar a origem usada por `fetch-app.js`;
- depois validar a importação real do iCloud em ambiente/teste controlado;
- somente então preparar o deploy do frontend.

O PR permanece propositalmente em rascunho e não deve ser integrado à `main` antes dessas validações.
