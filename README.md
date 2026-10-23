# Maple Widget

Overlay (widget) para Windows que acompanha o seu personagem no **MapleStory Classic** e diz, em tempo real, se o seu ritmo de EXP está bom. Ele não mexe no jogo: só olha a tela.

## Como funciona

1. **Captura de tela** apenas da janela do jogo (captura nativa do Windows, sem ler memória nem injetar nada).
2. **OCR do HUD** (Tesseract) lê nível, EXP e mapa a cada poucos segundos.
3. **Guias** do meowdb são sincronizados automaticamente pelo sitemap do site (hoje cerca de 34 guias) e as quests vêm do Quest Database. Você também pode adicionar links extras.
4. **Conselheiro**, com três frentes:
   - **Mapas de grind:** compara os mapas dos guias com a sua faixa de nível.
   - **Quests:** lista as quests úteis para o seu nível, com ícone do NPC e ✓ para marcar como feita.
   - **Cartão de level up:** ao subir de nível, mostra dicas de AP/SP (filtradas pela sua classe) e um botão "Abrir guia".
5. **Veredito** em cores, comparando o seu EXP/h com o "Max EXP/hr" do guia do melhor mapa:
   verde = no ritmo ou acima, amarelo = abaixo do ideal, vermelho = muito abaixo.

## Como rodar

```bash
npm install
npm start        # compila e abre o app
```

## Como gerar o executável

```bash
npm run dist     # gera release/Maple Widget <versão>.exe (portable, sem instalador)
```

O `.exe` não é assinado; o Windows SmartScreen pode avisar na primeira execução ("Mais informações" → "Executar assim mesmo").

## Primeira execução

1. O app baixa os dados de idioma do OCR (precisa de internet nessa hora, uma única vez).
2. O **assistente** abre em 3 passos: escolher a janela do jogo (ou deixar a detecção automática pelo título), calibrar as regiões do HUD (nível, EXP, mapa) e conferir a leitura. Se o jogo estiver com escala do Windows diferente de 100%, use **"Detectar escala"**.
3. Pronto: o widget fica por cima do jogo.

## Atalhos

| Atalho | Ação |
|---|---|
| `Ctrl+Alt+M` | mostrar / ocultar o widget |
| `Ctrl+Alt+C` | ligar / desligar o click-through (cliques atravessam o widget) |

Posição e opacidade do widget são lembradas entre execuções.

## Onde ficam os dados

Tudo na pasta `userData` do Electron (normalmente `%APPDATA%\maple-widget` ou `%APPDATA%\Maple Widget`): `config.json` (janela, calibração, escala, fontes extras, posição, opacidade), `cache/` (guias e quests para uso offline) e `tessdata/` (dados do OCR). Apagar a pasta reinicia o assistente.

## Modos suportados e limites conhecidos

- **Janela** e **borderless (janela sem bordas)** funcionam. **Tela cheia exclusiva não pode ser capturada**: use modo janela ou borderless.
- O OCR foi validado com pixels nativos do HUD em **1366×768** e **1920×1080**. Outras resoluções podem exigir recalibração (a calibração é guardada por resolução).
- Jogo com escala de DPI do Windows pode ler errado: use "Detectar escala" no assistente ou a opção de compatibilidade de alto DPI do Windows no executável do jogo.
- A janela do jogo é detectada pelo título ou escolhida no assistente.
- Sem internet, o app usa o cache; a aba Fontes mostra o erro de sincronização.

## Privacidade e segurança

- Não lê memória do jogo, não injeta código, não automatiza entradas.
- Captura somente a janela escolhida, e a imagem fica só na memória (não é salva nem enviada).
- Só acessa os domínios meowdb e niadb (lista de permissão); outros links são rejeitados.
- Textos externos são exibidos como texto simples (nunca como HTML).

Checklist de teste manual: [docs/teste-com-o-jogo.md](docs/teste-com-o-jogo.md).
