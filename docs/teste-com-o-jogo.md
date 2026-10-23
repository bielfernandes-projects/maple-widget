# Teste com o jogo aberto

Rode o `Maple Widget` (portable) com o MapleStory Classic aberto. Em cada item, marque o resultado.
O OCR não precisa de internet (o modelo vem no app); a internet só é usada para os guias do meowdb/niadb.

## Onde ficam os dados
Pasta `userData` do Electron. Nas execuções do build empacotado que fiz ela foi `%APPDATA%\maple-widget\` (minúsculas, com hífen), não "Maple Widget". Lá ficam o `config.json`, o `log.txt` (registro do app), `tessdata\` (cópia de trabalho do `eng.traineddata`, 5,2 MB, feita a partir do modelo embutido no app) e, depois da primeira sincronização, `guias\` com um `.json` por guia e o `auto-index.json`. (A pasta `Cache\` é do Chromium; versões anteriores punham os guias nela, e o app copia esses `.json` para `guias\` uma vez.) Para testar do zero, apague a pasta.

## 1. Assistente, passos 1 e 2: pasta e janela do jogo
- **Fazer:** abrir o app pela primeira vez. Passo 1: conferir a pasta (padrão `C:\Nexon\Library\maplestorycw`); tentar uma pasta inexistente. Passo 2: escolher a janela do jogo ou "Detectar automaticamente".
- **Esperado:** pasta inexistente mostra "Pasta não encontrada" e bloqueia o "Próximo"; a janela do jogo aparece na lista e a detecção automática a encontra.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 1b. Assistente, passos 3 e 4: calibrar o HUD e guias
- **Fazer:** no passo 3, com o jogo aberto, arrastar retângulos na ordem LEVEL, CLASSE/nick, EXP, MAPA; testar "Desfazer último retângulo" e "Detectar escala". No passo 4, clicar "Sincronizar agora" e "Concluir". Em outra execução limpa, testar "Pular configuração": o assistente não deve reabrir no próximo início (para refazer: Fontes → Recalibrar HUD).
- **Esperado:** a imagem é uma captura ao vivo; "Detectar escala" informa a escala (ou um erro claro); depois de concluir, a leitura mostra valores corretos.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 2. Modo janela, borderless e tela cheia
- **Fazer:** repetir a leitura em modo janela, depois borderless, depois tela cheia.
- **Esperado:** janela e borderless funcionam com o widget visível por cima. Tela cheia exclusiva: sem captura (aviso de jogo não encontrado ou captura preta), o que é esperado; registre o que aparece.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 3. Precisão da leitura
- **Fazer:** observar Lv, EXP e mapa por alguns minutos; matar mobs.
- **Esperado:** Lv, EXP e mapa corretos em até ~4 s; o EXP/h sobe enquanto você mata mobs.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 4. Level up
- **Fazer:** subir um nível.
- **Esperado:** cartão "Lv N → N+1" com dica de SP e de AP (da sua classe) e botão "Abrir guia" que abre o guia; fecha em ~15 s ou ao clicar.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 5. Veredito (verde / amarelo / vermelho)
- **Fazer:** comparar o EXP/h exibido com o "Max EXP/hr" do melhor mapa para o seu nível.
- **Esperado:** cor coerente com a regra: verde = seu EXP/h ≥ 70 % do EXP/h máximo do melhor mapa do seu level no guia; amarelo ≥ 40 %; vermelho abaixo de 40 %; cinza = sem dados ou sem leitura. O tooltip da bolinha mostra o "% do ideal". O valor do guia é um teto (máximo), não uma média, então não ficar no verde é normal.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 6. Aba Quests
- **Fazer:** abrir a aba Quests; marcar uma com ✓; olhar as quests com variantes.
- **Esperado:** quests do seu nível com ícone do NPC; ✓ marca como feita (e persiste); variantes aparecem recolhidas.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 7. Aba Mapas
- **Fazer:** abrir a aba Mapas.
- **Esperado:** mapas de grind para o seu nível com sprites dos mobs.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 8. Aba Fontes
- **Fazer:** abrir Fontes; clicar em ⟳; adicionar um link extra `https://` do meowdb e depois removê-lo com ✕; tentar um link de outro domínio e um `http://`; desligar e religar a sincronização automática.
- **Esperado:** a aba Fontes mostra N guias automáticos (N maior que 0) e a hora da última sincronização; ⟳ sincroniza na hora; o link extra entra na lista e o ✕ o remove; o link de outro site ou `http://` é rejeitado com mensagem. Com a sincronização desligada ficam só os links extras (os guias e o Quest Database deixam de ser carregados); ao religar, voltam. O EXP/h e a cor do veredito **não** zeram ao sincronizar.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 9. Offline (cache)
- **Fazer:** desligar a internet e reabrir o app.
- **Esperado:** aviso de erro/cache na aba Fontes, mas guias, mapas e quests continuam disponíveis.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 10. Atalhos
- **Fazer:** `Ctrl+Alt+M`, `Ctrl+Alt+C` e, por último, `Ctrl+Alt+Q`; abrir o app de novo e clicar no ✕ do topo do widget; com o widget aberto, dar dois cliques no `.exe` outra vez.
- **Esperado:** M esconde/mostra o widget; C liga/desliga o click-through (cliques passam para o jogo); Q e o ✕ fecham o app (posição e opacidade ficam salvas); o segundo clique no `.exe` não abre outro widget (só traz o atual para a frente).

| Atalho | Ação |
|---|---|
| `Ctrl+Alt+M` | mostrar / ocultar |
| `Ctrl+Alt+C` | click-through |
| `Ctrl+Alt+Q` | sair (igual ao botão ✕) |
- **Resultado:** ☐ ok ☐ falhou — observações:

## 11. Persistência de posição e opacidade
- **Fazer:** mover o widget, mudar a opacidade, fechar e abrir o app.
- **Esperado:** mesma posição e opacidade.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 12. Outra resolução ou tamanho de janela
- **Fazer:** mudar a resolução/tamanho da janela do jogo.
- **Esperado:** aparece o aviso "Sem calibração para LxA — usando posições padrão. Fontes → Recalibrar HUD." (com a resolução nova no lugar de LxA); recalibrar funciona, o aviso some e a calibração anterior é mantida para a resolução antiga.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 13. CPU e RAM
- **Fazer:** com o jogo rodando, abrir o Gerenciador de Tarefas e somar os processos "Maple Widget" por 2 minutos.
- **Esperado:** sem engasgos no jogo; anotar CPU média (%) e memória (MB). Para ler: Gerenciador de Tarefas → Detalhes → "Maple Widget" e seus processos filhos (são vários); some CPU e memória de todos. Referência (medição de desenvolvimento com `scripts\perf-probe.ps1`, soma de todos os processos, em % de um núcleo): capturando uma janela de teste por 60 s, 23,6 % antes da otimização e 4,7 % depois (pico de memória 688 → 618 MB); parado, sem a janela do jogo, por 30 s, 6,4 % → 1,1 % (pico 493 → 477 MB). São números do app em modo de desenvolvimento (`electron .`); o `.exe` empacotado roda o mesmo código, mas não foi medido com a sonda, e o jogo real (1920×1080, HUD mudando) pode custar mais que a janela de teste. Com o jogo de verdade o OCR pesado (level, classe e mapa) só roda quando esses trechos da HUD mudam e a cada 30 s, então picos curtos ao subir de level ou trocar de mapa são normais. Se o seu número for bem maior, anote.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 14. OCR sem internet
- **Fazer:** apagar a pasta `userData`, desligar a internet e abrir o app com o jogo aberto.
- **Esperado:** a leitura da HUD funciona normalmente (o modelo do OCR vem no app; o `log.txt` mostra `[ocr] pronto (modelo embutido)`); só os guias ficam indisponíveis até a internet voltar. Se o OCR falhar por outro motivo, o aviso é "Leitura da tela indisponível (falha ao preparar o OCR). Tentando de novo a cada 30 s…".
- **Resultado:** ☐ ok ☐ falhou — observações:

## 15. Coletar logs e prints para enviar
- **Fazer:** fechar o app e enviar o arquivo `%APPDATA%\maple-widget\log.txt` (o mesmo registro do stdout, com data e hora; serve também para o `.exe` portable). Método alternativo, para quem gera o build: o `.exe` portable NÃO entrega stdout a redirecionamentos, mas a versão desempacotada `release\win-unpacked\Maple Widget.exe` (gerada por `npx electron-builder --win --dir`) entrega:
  ```powershell
  $p = Start-Process -FilePath ".\release\win-unpacked\Maple Widget.exe" -ArgumentList "--user-data-dir=$env:TEMP\mw-teste" -RedirectStandardOutput "$env:TEMP\mw.out" -RedirectStandardError "$env:TEMP\mw.err" -PassThru
  # use o app; para encerrar:
  taskkill /PID $p.Id /T /F
  ```
  Se os arquivos saírem vazios ou você só tem o portable, envie: um print do widget, um print do assistente ou da aba Fontes e o conteúdo do `config.json` da pasta `userData`.
- **Esperado:** `log.txt` (ou `mw.out`) com `[app] empacotado v0.1.0` e `[ocr] pronto (modelo embutido)`; ou os prints e o `config.json`.
- **Resultado:** ☐ ok ☐ falhou — observações:
