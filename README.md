# Maple Widget

Overlay (widget) para Windows que acompanha o seu personagem no **MapleStory Classic** e diz, em tempo real, se o seu ritmo de EXP está bom. Ele não mexe no jogo: só olha a tela.

## Como funciona

1. **Captura de tela** apenas da janela do jogo (captura nativa do Windows, sem ler memória nem injetar nada).
2. **OCR do HUD** (Tesseract) lê nível, EXP e mapa a cada poucos segundos.
3. **Guias** do meowdb são sincronizados automaticamente pelo sitemap do site (todos os guias do MapleStory Classic do meowdb; hoje na casa de três dezenas, e o número aparece na aba Fontes) e as quests vêm do Quest Database. Você também pode adicionar links extras.
4. **Conselheiro**, com três frentes:
   - **Mapas de grind:** compara os mapas dos guias com a sua faixa de nível.
   - **Quests:** lista as quests úteis para o seu nível, com ícone do NPC e ✓ para marcar como feita.
   - **Cartão de level up:** ao subir de nível, mostra dicas de AP/SP (filtradas pela sua classe) e um botão "Abrir guia".
5. **Veredito** em cores, comparando o seu EXP/h com o "Max EXP/hr" do guia do melhor mapa:
   verde = seu EXP/h é ≥ 70 % do EXP/h máximo do melhor mapa do seu level no guia, amarelo = ≥ 40 %, vermelho = abaixo de 40 %, cinza = sem dados ou sem leitura. O tooltip da bolinha mostra o \"% do ideal\". O valor do guia é um teto, não uma média.

## Como rodar

```bash
npm install
npm start        # compila e abre o app
```

## Como gerar o executável

```bash
npm run dist     # gera release/Maple Widget <versão>.exe (portable, sem instalador)
```

O `.exe` não é assinado; o Windows SmartScreen pode avisar na primeira execução ("Mais informações" → "Executar mesmo assim").

## Primeira execução

1. O app baixa os dados de idioma do OCR (precisa de internet nessa hora, uma única vez). Sem internet, o widget mostra "Leitura da tela indisponível" e tenta de novo a cada 30 s.
2. O **assistente** ("Configuração inicial") tem 4 passos:
   1. **Pasta do jogo:** padrão `C:\Nexon\Library\maplestorycw`; o app confere se a pasta existe e você pode escolher outra.
   2. **Janela do jogo:** escolha a janela do MapleStory na lista ou "Detectar automaticamente".
   3. **Calibrar HUD:** sobre uma imagem do jogo (captura ao vivo se o jogo estiver aberto), arraste um retângulo sobre cada área, na ordem: LEVEL, CLASSE/nick, EXP e MAPA. "Desfazer último retângulo" corrige o último. Com captura ao vivo nativa aparece o botão **"Detectar escala"** (útil com escala de DPI do Windows). Também é possível "Pular calibração".
   4. **Guias:** explica a sincronização automática e tem "Sincronizar agora"; "Concluir" salva.
3. "Pular configuração" (passo 1) é lembrado: o assistente não reabre a cada execução. Para refazer, use a aba **Fontes → Recalibrar HUD**.

## Atalhos

| Atalho | Ação |
|---|---|
| `Ctrl+Alt+M` | mostrar / ocultar o widget |
| `Ctrl+Alt+C` | ligar / desligar o click-through (cliques atravessam o widget) |

Posição e opacidade do widget são lembradas entre execuções.

## Onde ficam os dados

Tudo na pasta `userData` do Electron (observado nas execuções de teste: `%APPDATA%\maple-widget`): `config.json` (janela, calibração, escala, fontes extras, posição, opacidade), `cache/` (guias e quests para uso offline) e `tessdata/` (dados do OCR). Apagar a pasta reinicia o assistente.

## Modos suportados e limites conhecidos

- **Janela** e **borderless (janela sem bordas)** funcionam. **Tela cheia exclusiva não pode ser capturada**: use modo janela ou borderless.
- O OCR foi validado com pixels nativos do HUD em **1366×768** e **1920×1080**. Outras resoluções podem exigir recalibração (a calibração é guardada por resolução).
- Jogo com escala de DPI do Windows pode ler errado: use "Detectar escala" no assistente ou a opção de compatibilidade de alto DPI do Windows no executável do jogo (sugestão, não testada com o jogo).
- A janela do jogo é detectada pelo título ou escolhida no assistente.
- Sem internet, o app usa o cache; a aba Fontes mostra o erro de sincronização.

## Privacidade e segurança

- Não lê memória do jogo, não injeta código, não automatiza entradas.
- Captura somente a janela escolhida, e a imagem fica só na memória (não é salva nem enviada).
- Só acessa os domínios meowdb e niadb (lista de permissão); outros links são rejeitados.
- Textos externos são exibidos como texto simples (nunca como HTML).

Checklist de teste manual: [docs/teste-com-o-jogo.md](docs/teste-com-o-jogo.md).
