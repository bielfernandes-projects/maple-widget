# Maple Widget

Widget flutuante para **Windows** que acompanha o seu personagem no **MapleStory Classic World** e responde, sem você sair do jogo:

- **Meu ritmo de EXP está bom?** Um semáforo (verde / amarelo / vermelho) compara o seu EXP/h com o melhor mapa de grind para o seu level.
- **Subi de level, e agora?** Um cartão mostra o que fazer com os pontos de **AP e SP** da sua classe.
- **Onde eu treino e que quests faço?** Mapas e quests recomendados para o seu level, com ícones de mobs e NPCs.
- **Onde esse mob aparece?** Uma **busca** por monstros, mapas, NPCs e itens (atalho `Ctrl+Alt+F`).

Ele **só olha a tela**: não mexe no jogo, não lê a memória e não injeta nada. Os dados vêm dos guias e do banco de dados do [meowdb](https://meowdb.com/msclassic).

> Projeto pessoal e não oficial. Não tem relação com a Nexon, com o MapleStory nem com o meowdb. Leia a seção [Cuidados](#cuidados-leia-antes-de-usar).

---

## Baixar e usar

1. Abra a página de [**Releases**](../../releases/latest) e baixe o arquivo **`Maple-Widget-0.1.0-win-x64.zip`**.
2. Extraia o zip e abra **`Maple Widget 0.1.0.exe`**. É portátil: não instala nada.
3. **O Windows vai avisar** ("O Windows protegeu o computador"), porque o programa não tem assinatura digital paga. Clique em **Mais informações → Executar assim mesmo**. O código-fonte está neste repositório para você conferir.
4. Siga o assistente de configuração (abaixo).

**Requisitos:** Windows 10/11 (64 bits), MapleStory Classic em **modo janela ou borderless** e internet na primeira abertura.

### Assistente de configuração (4 passos)

1. **Pasta do jogo:** o padrão é `C:\Nexon\Library\maplestorycw`. Escolha outra se a sua for diferente.
2. **Janela do jogo:** escolha a janela do MapleStory na lista (ou "Detectar automaticamente"). Se ela não aparecer, o jogo está **minimizado** — restaure-o e clique em **Atualizar lista**.
3. **Calibrar HUD:** deixe o jogo **visível, na tela do personagem**, clique em **Capturar em 5 s** e clique na janela do jogo durante a contagem. Na imagem, arraste um retângulo sobre cada item, nesta ordem: **LEVEL**, **CLASSE/nick**, **EXP** e **MAPA**. Se a leitura sair errada, use **Detectar escala**.
4. **Guias:** sincroniza os guias do meowdb. **Concluir** salva.

O jogo minimiza quando perde o foco; por isso a captura é feita depois da contagem, e o widget fica sempre por cima (não some quando você clica nele).

### Atalhos

| Atalho | Ação |
|---|---|
| `Ctrl+Alt+F` | abrir a busca |
| `Ctrl+Alt+M` | mostrar / ocultar o widget |
| `Ctrl+Alt+C` | click-through (os cliques atravessam o widget) |
| `Ctrl+Alt+Q` | sair (o mesmo que o botão ✕) |

Dá para **arrastar** o widget pela barra de cima e **redimensionar** pelo canto inferior direito. Posição e opacidade são lembradas.

---

## O que ele mostra

- **Agora:** level, barra de EXP, EXP/h e o veredito. Verde: seu EXP/h é ≥ 70% do máximo do melhor mapa do seu level; amarelo: ≥ 40%; vermelho: abaixo; cinza: sem dados. O valor do guia é um **teto**, não uma média.
- **Quests / Mapas:** o que vale a pena no seu level, vindo dos guias e do Quest Database do meowdb (~340 quests). Dá para marcar quests como feitas.
- **Buscar:** monstros (level, EXP, HP e **em quais mapas aparecem**), mapas (que monstros têm), NPCs (quests deles) e itens (abre a página do item no meowdb, onde aparece quem dropa).
- **Fontes:** todos os guias do meowdb entram sozinhos e se mantêm atualizados. Você pode colar links extras (só `https://` do meowdb/niadb).
- **Level up:** cartão com dicas de **AP e SP** da sua classe e botão para abrir o guia.

---

## Cuidados (leia antes de usar)

- **Uso por sua conta e risco.** Programas que se conectam a jogos podem violar os termos de uso. Este **não** injeta código, não lê a memória do jogo, não automatiza teclas nem mouse: só captura a imagem da janela do jogo (como um gravador de tela) e faz OCR. Ainda assim, **não há garantia** de que a Nexon aceite; use sabendo disso.
- **Não é oficial.** Não há ligação com a Nexon nem com o meowdb. *MapleStory* e seus nomes, imagens e dados pertencem aos respectivos donos.
- **Os dados são do meowdb.** O widget baixa páginas públicas do site, com pouca frequência, em baixa concorrência e guardando cache local. Ícones dos mobs são carregados do próprio site, na hora. Respeite o site: se for mexer no código de sincronização, não aumente o ritmo das requisições.
- **Privacidade.** A imagem do jogo fica só na memória e nunca é salva nem enviada. A rede é usada apenas para meowdb/niadb (lista de permissão). Textos vindos da rede são exibidos como texto simples.
- **Windows SmartScreen.** O executável não é assinado, então o aviso é esperado. Baixe **somente** pela página de Releases deste repositório.
- **Tela cheia exclusiva não funciona** (a captura sai preta). Use **janela** ou **borderless**.
- **Resolução e DPI.** O OCR foi validado em **1366×768** e **1920×1080**. Outras resoluções ou escala de DPI do Windows podem exigir recalibração (**Detectar escala** ajuda). A calibração é guardada por resolução.
- **Leitura por OCR pode errar.** Confira os números na primeira vez; se algo estiver estranho, recalibre em **Fontes → Recalibrar HUD**.
- **Primeira abertura:** baixa a base do meowdb (cerca de 200 páginas de monstros e 3 índices). Pode levar alguns minutos; a busca já funciona com o que foi baixado.

---

## Onde ficam os dados

Em `%APPDATA%\maple-widget`: `config.json` (janela, calibração, fontes extras), `log.txt` (registro do app, sem imagens nem dados de conta), `guias\` e `gamedb.json` (cache dos dados do meowdb). Apagar a pasta reinicia o assistente. Se algo der errado, o `log.txt` ajuda a entender.

## Limitações conhecidas

- Os drops de itens não aparecem na busca: o meowdb os carrega só no navegador. O botão "Abrir no meowdb" leva à página do item.
- Só inglês (como os dados do meowdb usados).
- O exe tem ~440 MB descompactado (o OCR e o Chromium vêm junto).

---

## Para desenvolvedores

```bash
npm install
npm start          # compila e abre o app
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run dist       # gera release/Maple Widget <versão>.exe (portátil)
```

Stack: **Electron + TypeScript**, esbuild, vitest, cheerio, tesseract.js e *template matching* para os dígitos do EXP.

- `src/capture/` captura nativa (janela oculta com `getDisplayMedia`), leitura da HUD e OCR
- `src/sources/` guias (sitemap incremental) e a base do jogo (monstros, mapas, NPCs, itens)
- `src/advisor.ts`, `src/tracker.ts`, `src/search.ts` regras puras (sem Electron), todas testadas
- `src/main/` processo principal, validação de IPC e preload · `src/renderer/` interface
- `docs/superpowers/` especificação e plano de implementação · `docs/teste-com-o-jogo.md` roteiro de teste manual

**Fixtures:** screenshots do jogo e cópias de páginas do meowdb **não** estão no repositório (conteúdo de terceiros). Os testes que dependem deles são pulados; veja [tests/fixtures/README.md](tests/fixtures/README.md).

O modelo do OCR (`eng.traineddata`, Tesseract) vem em `resources/tessdata` sob a licença Apache-2.0 (arquivo de licença junto).

## Créditos

[meowdb / NiaDB](https://meowdb.com/msclassic) (dados e guias), [Tesseract](https://github.com/tesseract-ocr/tesseract), [Electron](https://www.electronjs.org/).
