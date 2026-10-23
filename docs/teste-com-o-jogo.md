# Teste com o jogo aberto

Rode o `Maple Widget` (portable) com o MapleStory Classic aberto. Em cada item, marque o resultado.
Na primeira execução é preciso internet (baixa os dados do OCR).

## 1. Assistente: janela e calibração do HUD
- **Fazer:** abrir o app pela primeira vez; escolher a janela do jogo no passo 1; calibrar as regiões do HUD; testar "Detectar escala".
- **Esperado:** a janela do jogo aparece na lista (ou é detectada pelo título); as regiões de nível, EXP e mapa ficam sobre o HUD; a leitura de teste mostra valores corretos; "Detectar escala" ajusta ou informa que não precisa.
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
- **Esperado:** cor coerente: verde no ritmo ou acima, amarelo abaixo, vermelho bem abaixo.
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
- **Esperado:** cerca de 34 guias automáticos e horário da última sincronização; ⟳ sincroniza na hora; o toggle liga/desliga a fonte; o link extra entra na lista; o link de outro site é rejeitado com mensagem.
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
- **Esperado:** sem engasgos no jogo; anotar CPU média (%) e memória (MB). Referência medida sem jogo: ~10% de um núcleo parado, ~650 MB no pico em captura contínua.
- **Resultado:** ☐ ok ☐ falhou — observações:

## 14. Coletar logs e prints para enviar
- **Fazer:** abrir o app pelo terminal: `& ".\Maple Widget 0.1.0.exe" *> log.txt`; tirar prints do widget e da tela do assistente; anexar `config.json` (pasta userData, sem dados sensíveis).
- **Esperado:** `log.txt` com linhas `[app] empacotado` e `[ocr] pronto`, mais os prints.
- **Resultado:** ☐ ok ☐ falhou — observações:
