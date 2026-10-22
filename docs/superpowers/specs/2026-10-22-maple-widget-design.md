# Maple Widget — Design

Data: 2026-10-22 · Status: aguardando revisão

## Objetivo

Widget flutuante (overlay) para MapleStory Classic World que, enquanto o jogador joga:

- mostra level, EXP, EXP/hora e se o ritmo atual "vale a pena";
- percebe o level up e mostra o conselho de AP/SP;
- sugere as melhores quests e mapas de grind para o level atual;
- consome fontes configuradas pelo usuário (links de guias do meowdb/NiaDB), exibindo ícones de mobs e itens.

## Decisões já tomadas

- **Stack:** Electron + TypeScript. Distribuível como instalador `.exe`.
- **Captura de dados:** leitura de tela (OCR/template matching) da HUD. Sem injeção, sem leitura de memória (risco de ban).
- **Modos de janela:** janela e borderless via overlay always-on-top. Tela cheia exclusiva não permite overlay: o widget detecta captura preta e orienta o usuário (mover para 2º monitor ou usar borderless). Validar empiricamente no PC do usuário.
- **Fontes:** o usuário cola links; o widget baixa o HTML (Next.js SSR, sem API) e extrai tabelas/seções.
- **Pasta do jogo:** `C:\Nexon\Library\maplestorycw` (sugerida e validada no assistente). Não há log de jogo com EXP; a pasta serve para localizar screenshots (`appdata\Maple_A_*.jpg`) e, no futuro, ícones.

## Fatos levantados

- HUD do jogo, em posição fixa: `LV. 13`, classe (`Archer`), nome, HP, MP, `EXP 1 [0.02%]`; minimapa com `Região · Mapa`; banner `LEVEL UP`; chat com `You received EXP (+3)`.
- Os dígitos do level usam fonte gráfica; EXP e minimapa usam fonte comum.
- meowdb: guias com seções H2 por faixa de level ("Level 11-15") e tabelas com cabeçalhos previsíveis. Ícones em `/msclassic/api/assets/icons/{id}`; animações de mob em `/msclassic/monsters/anim/{id}.stand.webp`. Guias úteis: `best-grind-maps-every-level`, `exp-table-level-1-to-100`, guias de classe, `beginners-guide-first-steps-in-maple-world`. O site vai migrar para o nome NiaDB (links antigos continuam funcionando).
- Cabeçalhos observados: grind `Map | Street | Max EXP/hr | Dominant mob | Portals to pots | Why`; quests `Quest | From | Lv | EXP | Reward`; EXP `Level | EXP to next | Cumulative from lv 1 | Milestone`.

## Arquitetura

Cinco módulos pequenos. Fluxo: `capture → tracker → advisor ← sources`, resultado para `ui`.

1. **capture** — captura a região da HUD (level, EXP abs/%, mapa, banner LEVEL UP) via `desktopCapturer`; regiões calibradas pelo usuário, salvas por resolução. Level por template matching de dígitos; EXP e mapa por `tesseract.js` (fallback: template matching).
2. **tracker** — converte leituras em `Estado`; descarta leituras implausíveis (EXP que diminui sem level up, level que pula >1); calcula EXP/hora e detecta level up.
3. **sources** — baixa links, cacheia em disco, extrai e normaliza em `GrindMap`, `Quest`, `ExpRow`, `Tip`.
4. **advisor** — funções puras: melhores mapas e quests do level, conselho AP/SP, veredito de ritmo.
5. **ui** — renderer do widget.

## Modelo de dados

```ts
Source   { url, title, fetchedAt, status: 'ok'|'erro'|'vazio', counts }
GrindMap { name, street, maxExpHr, mob{name,id,iconUrl}, why, levelMin, levelMax, sourceUrl }
Quest    { id, name, npc, level, exp, reward, iconUrl, sourceUrl }
ExpRow   { level, toNext }
Tip      { kind: 'ap'|'sp', title, text, levelMin?, levelMax?, sourceUrl }
Estado   { level, classe, expAbs, expPct, mapa, expPorHora, upou }
```

Persistência: `config.json` em `userData` (pasta do jogo, regiões por resolução, fontes, limiares, quests concluídas) + `cache/<hash>.json` por fonte + cache de ícones em disco. Sem banco.

## Parser de fontes

Detecta pelo conteúdo, não pela URL:

- tabela com `Map` + `EXP/hr` → `GrindMap`; faixa de level do H2 mais próximo acima;
- tabela com `Quest` + `Lv` + `EXP` → `Quest`; ID do link `/quest-tracker/{id}`;
- tabela com `Level` + `EXP to next` → `ExpRow`;
- seção H2 cujo título bate com `ability points|skill points|AP|SP|build` → `Tip` (texto como está, com fonte e link).

Não reconhecido é ignorado e contado em `counts`. Nada reconhecido → status `vazio`, listando as tabelas vistas. A classe vem do OCR e filtra guias de classe por título. AP/SP não é interpretado automaticamente: mostra-se o trecho do guia.

## UI

- Janela sem borda, transparente, always-on-top (nível acima de janelas normais), arrastável com posição salva, slider de opacidade, hotkey de mostrar/ocultar, hotkey de click-through.
- **Compacto** (~320x56): `Lv · Classe · barra de EXP · EXP/h · veredito`.
- **Expandido** (~320x420), abas:
  - **Agora:** level, EXP, EXP/h, veredito, mapa atual e melhor mapa sugerido. Veredito = EXP/h medido ÷ `Max EXP/hr` do melhor mapa do level; ≥70% verde, 40–70% amarelo, <40% vermelho (limiares configuráveis; a UI avisa que o valor da fonte é um teto).
  - **Quests:** quests do level com ícone de recompensa e EXP; marcar como feita (salvo localmente).
  - **Mapas:** grind da faixa de level com ícone/animação do mob dominante, EXP/h e "Why".
  - **Fontes:** colar link; status, data e tipo detectado; atualizar/remover.
- **Level up:** expande sozinho e pisca com cartão "Lv N → N+1": conselho AP/SP (trecho + fonte + link), e quests/mapas que passam a valer neste level. Fecha sozinho ou por clique.
- **Primeira execução (3 passos):** pasta do jogo; calibração arrastando retângulos sobre um screenshot (barra de EXP/level, minimapa); links das fontes (sugerindo grind, EXP table e classe).

## Erros e segurança

- Download falhou → usa cache e avisa na aba Fontes.
- OCR ilegível ou implausível → mantém último valor, mostra "sem leitura" em cinza.
- Captura preta → aviso de tela cheia exclusiva.
- Sem fontes → dicas vazias com botão "adicionar fonte".
- Só `http(s)` de allowlist de domínios (`meowdb.com`, `niadb`; ampliável em configurações).
- Texto de fonte é sempre renderizado como texto, nunca HTML.

## Testes (vitest, mínimo útil)

- Parser contra HTML salvo de 3 guias (grind, EXP table, beginner's): contagens e valores-chave.
- `tracker` e `advisor` (puros): veredito, level up, descarte de leitura ruim.
- Leitura de tela contra os screenshots reais da pasta do jogo (level, EXP, mapa esperados).
- Sem teste de UI no MVP.

## Spike antes da UI

Ler os 12 screenshots de `appdata\Maple_A_*.jpg` e conferir level, EXP e mapa. É o maior risco técnico; se falhar, ajusta-se a estratégia de OCR antes de investir na UI.

## Fora do MVP (YAGNI)

Sincronização na nuvem, contas, outros jogos, leitura de memória, parsing automático de prosa para AP/SP, auto-update do app, ícones extraídos dos `.wz` do jogo.
