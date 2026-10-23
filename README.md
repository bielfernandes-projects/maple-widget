# Maple Widget

🇬🇧 English · [🇧🇷 Português abaixo](#-português)

A floating overlay for **Windows** that tracks your character in **MapleStory Classic World** and answers, without leaving the game:

- **Is my EXP pace any good?** A traffic light (green / yellow / red) compares your EXP/h with the best grind map for your level.
- **I leveled up — now what?** A card shows what to do with your **AP and SP** for your class.
- **Where do I train and which quests do I do?** Maps and quests recommended for your level, with mob and NPC icons.
- **Where does this mob spawn?** A **search** across monsters, maps, NPCs and items (hotkey `Ctrl+Alt+F`).

It **only looks at the screen**: it doesn't touch the game, read its memory or inject anything. Data comes from the guides and database of [meowdb](https://meowdb.com/msclassic).

> Personal, unofficial project. Not affiliated with Nexon, MapleStory or meowdb. Read [Heads-up](#heads-up-read-before-using).

## Download & use

1. Open [**Releases**](../../releases/latest) and download **`Maple-Widget-0.1.2-win-x64.zip`**.
2. Extract it and run **`Maple Widget 0.1.2.exe`**. It's portable: nothing gets installed.
3. **Windows will warn you** ("Windows protected your PC") because the app isn't signed with a paid certificate. Click **More info → Run anyway**. The source code is in this repository so you can check it.
4. Follow the setup wizard (below).

**Requirements:** Windows 10/11 (64-bit), MapleStory Classic in **windowed or borderless mode**, and internet on first run.

### Setup wizard (4 steps)

1. **Game folder:** defaults to `C:\Nexon\Library\maplestorycw`. Pick another one if yours differs.
2. **Game window:** choose the MapleStory window from the list (or "Detect automatically"). If it doesn't show up, the game is **minimized** — restore it and click **Refresh list**.
3. **Calibrate HUD:** keep the game **visible, on the character screen**, click **Capture in 5 s** and click the game window during the countdown. On the image, drag a rectangle over each item in this order: **LEVEL**, **CLASS/nick**, **EXP** and **MAP**. If readings look wrong, use **Detect scale**.
4. **Guides:** syncs the meowdb guides. **Finish** saves.

The game minimizes when it loses focus, which is why the capture happens after a countdown. The widget always stays on top.

> The widget interface is currently in Portuguese (button labels such as *Capturar em 5 s* = "Capture in 5 s", *Atualizar lista* = "Refresh list", *Detectar escala* = "Detect scale").

### Hotkeys

| Hotkey | Action |
|---|---|
| `Ctrl+Alt+F` | open search |
| `Ctrl+Alt+M` | show / hide the widget |
| `Ctrl+Alt+C` | click-through (clicks pass through the widget) |
| `Ctrl+Alt+Q` | quit (same as the ✕ button) |

Drag the widget by its top bar and **resize** it from the bottom-right corner. Position and opacity are remembered.

## What it shows

- **Now:** level, EXP bar, EXP/h and the verdict. Green: your EXP/h is ≥ 70% of the best map's maximum for your level; yellow: ≥ 40%; red: below; gray: no data. The guide value is a **ceiling**, not an average.
- **Quests / Maps:** what's worth doing at your level, from the meowdb guides and Quest Database (~340 quests). You can tick quests as done.
- **Search:** monsters (level, EXP, HP and **which maps they spawn in**), maps (which monsters live there), NPCs (their quests) and items (opens the item page on meowdb, where the drops are listed).
- **Sources:** every meowdb guide is added automatically and kept up to date. You can paste extra links (`https://` meowdb/niadb only).
- **Level up:** a card with **AP and SP** tips for your class and a button to open the guide.

## Heads-up (read before using)

- **Use at your own risk.** Tools that interact with games may violate their terms of service. This one does **not** inject code, read game memory, or automate keys/mouse: it only captures the game window image (like a screen recorder) and runs OCR. Still, **there is no guarantee** Nexon is fine with it.
- **Unofficial.** No affiliation with Nexon or meowdb. *MapleStory* and its names, images and data belong to their owners.
- **The data belongs to meowdb.** The widget downloads public pages from the site infrequently, with low concurrency and a local cache. Mob icons are loaded from the site itself at runtime. Be kind to the site: if you change the sync code, don't increase the request rate.
- **Privacy.** The game image stays in memory only and is never saved or sent. Network access is limited to meowdb/niadb (allowlist). Text from the network is shown as plain text.
- **Windows SmartScreen.** The executable isn't signed, so the warning is expected. Download **only** from this repository's Releases page.
- **Exclusive fullscreen doesn't work** (the capture comes out black). Use **windowed** or **borderless**.
- **Resolution and DPI.** OCR was validated at **1366×768** and **1920×1080**. Other resolutions or Windows DPI scaling may need recalibration (**Detect scale** helps). Calibration is stored per resolution.
- **OCR can be wrong.** Check the numbers the first time; if something looks off, recalibrate in **Sources → Recalibrate HUD**.
- **First run** downloads the meowdb data (~200 monster pages and 3 indexes). It can take a few minutes; search already works with whatever has been downloaded.

## Where data lives

In `%APPDATA%\maple-widget`: `config.json` (window, calibration, extra sources), `log.txt` (app log, no images or account data), `guias\` and `gamedb.json` (cache of meowdb data). Deleting the folder restarts the wizard.

## Known limitations

- Item drops don't appear in search: meowdb only loads them in the browser. "Open on meowdb" takes you to the item page.
- English game data only (as used from meowdb); the interface is in Portuguese for now.
- The exe is ~440 MB unpacked (OCR and Chromium are bundled).

## For developers

```bash
npm install
npm start          # build and run
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run dist       # builds release/Maple Widget <version>.exe (portable)
```

Stack: **Electron + TypeScript**, esbuild, vitest, cheerio, tesseract.js and template matching for the EXP digits.

- `src/capture/` native capture (hidden window with `getDisplayMedia`), HUD reading and OCR
- `src/sources/` guides (incremental sitemap) and the game database (monsters, maps, NPCs, items)
- `src/advisor.ts`, `src/tracker.ts`, `src/search.ts` pure rules (no Electron), all tested
- `src/main/` main process, IPC validation and preload · `src/renderer/` UI
- `docs/superpowers/` spec and implementation plan · `docs/teste-com-o-jogo.md` manual test checklist (PT)

**Fixtures:** game screenshots and copies of meowdb pages are **not** in the repo (third-party content). Tests that need them are skipped; see [tests/fixtures/README.md](tests/fixtures/README.md).

The OCR model (`eng.traineddata`, Tesseract) lives in `resources/tessdata` under the Apache-2.0 license (license file included).

## Support the project ♥

Free and open to everyone. If it helped you and you'd like to chip in, you can donate (optional) by card or PayPal on **[Ko-fi](https://ko-fi.com/bielfernandesz)**. There is also an **Apoiar** button in the widget's *Fontes* tab. Thank you!

## Credits

[meowdb / NiaDB](https://meowdb.com/msclassic) (data and guides), [Tesseract](https://github.com/tesseract-ocr/tesseract), [Electron](https://www.electronjs.org/).

---

# 🇧🇷 Português

[🇬🇧 English above](#maple-widget)

Widget flutuante para **Windows** que acompanha o seu personagem no **MapleStory Classic World** e responde, sem você sair do jogo:

- **Meu ritmo de EXP está bom?** Um semáforo (verde / amarelo / vermelho) compara o seu EXP/h com o melhor mapa de grind para o seu level.
- **Subi de level, e agora?** Um cartão mostra o que fazer com os pontos de **AP e SP** da sua classe.
- **Onde eu treino e que quests faço?** Mapas e quests recomendados para o seu level, com ícones de mobs e NPCs.
- **Onde esse mob aparece?** Uma **busca** por monstros, mapas, NPCs e itens (atalho `Ctrl+Alt+F`).

Ele **só olha a tela**: não mexe no jogo, não lê a memória e não injeta nada. Os dados vêm dos guias e do banco de dados do [meowdb](https://meowdb.com/msclassic).

> Projeto pessoal e não oficial. Não tem relação com a Nexon, com o MapleStory nem com o meowdb. Leia os [Cuidados](#cuidados-leia-antes-de-usar).

## Baixar e usar

1. Abra a página de [**Releases**](../../releases/latest) e baixe o arquivo **`Maple-Widget-0.1.2-win-x64.zip`**.
2. Extraia o zip e abra **`Maple Widget 0.1.2.exe`**. É portátil: não instala nada.
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

## O que ele mostra

- **Agora:** level, barra de EXP, EXP/h e o veredito. Verde: seu EXP/h é ≥ 70% do máximo do melhor mapa do seu level; amarelo: ≥ 40%; vermelho: abaixo; cinza: sem dados. O valor do guia é um **teto**, não uma média.
- **Quests / Mapas:** o que vale a pena no seu level, vindo dos guias e do Quest Database do meowdb (~340 quests). Dá para marcar quests como feitas.
- **Buscar:** monstros (level, EXP, HP e **em quais mapas aparecem**), mapas (que monstros têm), NPCs (quests deles) e itens (abre a página do item no meowdb, onde aparece quem dropa).
- **Fontes:** todos os guias do meowdb entram sozinhos e se mantêm atualizados. Você pode colar links extras (só `https://` do meowdb/niadb).
- **Level up:** cartão com dicas de **AP e SP** da sua classe e botão para abrir o guia.

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

## Onde ficam os dados

Em `%APPDATA%\maple-widget`: `config.json` (janela, calibração, fontes extras), `log.txt` (registro do app, sem imagens nem dados de conta), `guias\` e `gamedb.json` (cache dos dados do meowdb). Apagar a pasta reinicia o assistente. Se algo der errado, o `log.txt` ajuda a entender.

## Limitações conhecidas

- Os drops de itens não aparecem na busca: o meowdb os carrega só no navegador. O botão "Abrir no meowdb" leva à página do item.
- Dados do jogo só em inglês (como os do meowdb usados).
- O exe tem ~440 MB descompactado (o OCR e o Chromium vêm junto).

## Apoiar o projeto ♥

Grátis e aberto para todos. Se ajudou e você quiser contribuir (opcional):

- **Pix** (Brasil): chave aleatória `03b41bfd-8f32-4c81-aa8c-23a0ac6bacf9`
- **[Ko-fi](https://ko-fi.com/bielfernandesz)** (cartão e PayPal, de qualquer país)

No widget, a aba **Fontes** tem os botões **Ko-fi** e **Pix** (este copia a chave). Obrigado!

## Para desenvolvedores

Os comandos (`npm install`, `npm start`, `npm test`, `npm run typecheck`, `npm run dist`), a estrutura de pastas, a observação sobre fixtures e os créditos estão na seção [For developers](#for-developers) acima.
