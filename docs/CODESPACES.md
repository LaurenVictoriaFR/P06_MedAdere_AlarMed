# Bloco D no Codespaces

Branch: feat/bloco-d-doses-lembretes
Título da PR: Implementa doses, lembretes e testes do bloco D

O pacote aplica somente caminhos novos ou alterados em relação ao ZIP original,
confere hashes da base e para antes de escrever qualquer arquivo se houver
conflito. Não substitui arquivos diferentes por força. Os arquivos aplicados são
adicionados ao stage, mas commit, push e PR são ações separadas do usuário.

Depois de aplicar, abra a paleta de comandos com Command+Shift+P no Mac e execute
Codespaces: Rebuild Container (ou Dev Containers: Rebuild Container, conforme a
interface). A configuração usa JDK 21 completo e Node 24. Não inicia a aplicação
nem instala suas dependências automaticamente. O rebuild ainda precisa ser
validado no Codespaces real.

Depois de reconstruir:

```bash
java -version
javac -version
node --version
./mvnw verify
(cd frontend && node --test)
```

Para demonstrar sem Docker:

```bash
node scripts/gerar-vapid.mjs
./mvnw spring-boot:run -Dspring-boot.run.profiles=demo
```

Abra a porta 8080 pela aba Ports. Mantenha a porta privada. O endereço HTTPS
encaminhado pelo Codespaces deve ser usado para testar notificações; localhost
no seu Mac é outro computador. O servidor precisa continuar ativo para enviar
lembretes. A geração de VAPID e o rebuild não comprovam recebimento no aparelho.

Se os testes passarem e o diff estiver correto:

```bash
git diff --cached --stat
git diff --cached --check
git commit -m "feat: implementa doses, lembretes e testes do bloco D"
git push -u origin feat/bloco-d-doses-lembretes
gh pr create --draft --base main --head feat/bloco-d-doses-lembretes --title "Implementa doses, lembretes e testes do bloco D" --body-file docs/PR_BLOCO_D.md
```

Se main não for a branch de integração da equipe, ajuste --base. Se a branch já
existir, use um Codespace limpo dessa branch e confira o conteúdo antes de aplicar.
Se gh informar falta de permissão, envie a mensagem para resolvermos o acesso;
não force push nem altere a branch de destino para contornar a revisão.
