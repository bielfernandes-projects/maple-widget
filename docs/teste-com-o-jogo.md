# Teste com o jogo aberto

Rode o `Maple Widget` (portable) com o MapleStory Classic aberto. Em cada item, marque o resultado.
Na primeira execução é preciso internet (baixa os dados do OCR).

## Onde ficam os dados
Pasta `userData` do Electron. Nas execuções do build empacotado que fiz ela foi `%APPDATA%\maple-widget\` (minúsculas, com hífen), não "Maple Widget". Lá ficam o `config.json` e, depois da primeira sincronização, `cache\` (e `tessdata\` com os dados do OCR, se o app os gravar; não os vi nas execuções curtas). Para testar do zero, apague a pasta.

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
- **Esperado:** cor coerente com a regra: verde = seu EXP/h ≥ 70 % do EXP/h máximo do melhor mapa do seu level no guia; amarelo ≥ 40 %; vermelho abaixo de 40 %; cinza = sem dados ou sem leitura. O tooltip da bolinha mostra o \"% do ideal\". O valor do guia é um teto (máximo), não uma média, então não ficar no verde é normal.
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
- **Fazer:** abrir Fontes; clicar em ⟳; desligar/ligar uma fonte; adicionar um link extra do meowdb; tentar um link de outro domínio.
- **Esperado:** a aba Fontes mostra N guias automáticos (N maior que 0) e a hora da última sincronização; ⟳ sincroniza na hora; o toggle liga/desliga a fonte; o link extra entra na lista; o link de outro site é rejeitado com mensagem.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 9. Offline (cache)
- **Fazer:** desligar a internet e reabrir o app.
- **Esperado:** aviso de erro/cache na aba Fontes, mas guias, mapas e quests continuam disponíveis.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 10. Atalhos
- **Fazer:** `Ctrl+Alt+M` e `Ctrl+Alt+C`.
- **Esperado:** M esconde/mostra o widget; C liga/desliga o click-through (cliques passam para o jogo).
- **Resultado:** ☐ ok ☐ falhou — observações:

## 11. Persistência de posição e opacidade
- **Fazer:** mover o widget, mudar a opacidade, fechar e abrir o app.
- **Esperado:** mesma posição e opacidade.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 12. Outra resolução ou tamanho de janela
- **Fazer:** mudar a resolução/tamanho da janela do jogo.
- **Esperado:** aviso de calibração para a nova resolução; recalibrar funciona e a calibração anterior é mantida para a antiga.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 13. CPU e RAM
- **Fazer:** com o jogo rodando, abrir o Gerenciador de Tarefas e somar os processos "Maple Widget" por 2 minutos.
- **Esperado:** sem engasgos no jogo; anotar CPU média (%) e memória (MB). Para ler: Gerenciador de Tarefas → Detalhes → \"Maple Widget\" e seus processos filhos (são vários); some CPU e memória de todos. Referência (medição de desenvolvimento antes da otimização): ~9,7 % de um núcleo parado e ~40,8 % capturando uma janela de teste (pico de memória 673 MB parado / 824 MB capturando). Uma otimização está planejada; se o seu número for bem maior, anote.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 14. Falha do OCR sem internet
- **Fazer:** apagar a pasta `userData`, desligar a internet e abrir o app; depois religar a internet.
- **Esperado:** aparece "Leitura da tela indisponível (falha ao preparar o OCR — verifique a conexão). Tentando de novo…"; o app tenta de novo a cada 30 s e se recupera sozinho quando a conexão volta.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 15. Coletar logs e prints para enviar
- **Fazer:** os logs (`[app] empacotado`, `[ocr] pronto`) saem no stdout. O `.exe` portable NÃO entrega stdout a redirecionamentos (testei `Start-Process -RedirectStandardOutput`: arquivos vazios). Funciona com a versão desempacotada, `release\win-unpacked\Maple Widget.exe` (gerada por `npx electron-builder --win --dir`):
  ```powershell
  $p = Start-Process -FilePath ".\release\win-unpacked\Maple Widget.exe" -ArgumentList "--user-data-dir=$env:TEMP\mw-teste" -RedirectStandardOutput "$env:TEMP\mw.out" -RedirectStandardError "$env:TEMP\mw.err" -PassThru
  # use o app; para encerrar:
  taskkill /PID $p.Id /T /F
  ```
  Se os arquivos saírem vazios ou você só tem o portable, envie: um print do widget, um print do assistente ou da aba Fontes e o conteúdo do `config.json` da pasta `userData`.
- **Esperado:** `mw.out` com `[app] empacotado v0.1.0` e `[ocr] pronto`; ou os prints e o `config.json`.
- **Resultado:** ☐ ok ☐ falhou — observações:
