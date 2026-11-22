# Pendências após a implementação do Bloco D

Esta lista guarda o trabalho que será retomado após validar a implementação
na máquina da equipe. O arquivo P3 original não foi preenchido nem alterado.

## Responsabilidade de Artur

- [ ] P3 5.1: linhas de registrar consumo e receber lembrete; demonstração, requisitos e limites reais.
- [ ] P3 5.3: componentes de geração, consumo, agendador, inscrição e entrega; ADRs, dependências e caminhos.
- [ ] P3 8.1: níveis e ferramentas de teste, comandos e critérios de aprovação.
- [ ] P3 8.2: testes prioritários com IDs, requisitos, cenários e status realmente observado.
- [ ] P3 8.3: QS-01/02/03/06/08/10/12; resultados locais e impedimentos de validação real.
- [ ] P3 8.4: data, commit/build, totais, falhas e evidências; consolidar também os testes dos demais blocos.
- [ ] P2 seção 3: atualizar domínio de Dose, Lembrete, Inscrição e Entrega conforme o código.
- [ ] P2 seção 6.2: atualizar estados e correção explícita dentro da janela.
- [ ] P3 seção 15: participação individual com commits/PRs reais após subir ao GitHub.
- [ ] P3 seção 16: incluir somente fontes efetivamente consultadas.
- [ ] Registrar o apoio de IA quando pertinente e a validação/compreensão humana das alterações.

## Alinhamento com o grupo

- [ ] Bloco A: ajustar ADR-08/10, ATAM, C2 e evidências ao modelo de doses persistidas.
- [ ] Bloco A: tornar explícita a precisão por minuto da janela inclusiva; retirar trechos que ainda a tratam como indefinida.
- [ ] Bloco A: registrar fuso fixo do MVP, limite do push externo e risco de repetição após queda no commit.
- [ ] Bloco C: revisar os ajustes de confirmação/duração e os novos campos do plano.
- [ ] Bloco B: revisar sessão, logout, empacotamento da PWA, configuração e execução/demo.
- [ ] Bloco E: usar dados/IDs/evidências reais na rastreabilidade; confirmar responsabilidade pelo painel.
- [ ] Bloco E: registrar que o painel existente ainda calcula a taxa no cliente; ASR-05 pede cálculo no servidor.
- [ ] Corrigir no P3 os trechos antigos de autenticação sem hash: o código existente já usa BCrypt.
- [ ] Atualizar o contrato que antes propunha doses sem persistência e atribuía painel ao Bloco D.
- [ ] Preencher CI/qualidade/rastreabilidade com execução e commits reais após integração; não inventar IDs de PR/commit.
- [ ] Confirmar o prazo vigente: o plano recebido registra 15/11/2026.
- [ ] Obter a versão atual do P2 e eventuais correções da professora antes de editar suas seções.

## Validação humana antes de entregar

- [ ] Rodar a versão entregue no JDK 21 da equipe, sem as adaptações temporárias do ambiente de verificação.
- [ ] Revisar visualmente as telas no navegador do computador e no celular/tablet.
- [ ] Receber Web Push real com a PWA fechada; tocar no aviso e conferir a dose destacada.
- [ ] Ensaiar instalação, permissão negada e recuperação de uma inscrição inválida.
- [ ] Validar iPhone/iPad instalado em contexto HTTPS e registrar a versão do sistema/navegador.
- [ ] Medir QS-01 com uma amostra e ambiente declarados; 2xx do provedor não comprova recebimento.
- [ ] Fazer revisão cruzada dos arquivos compartilhados e executar a CI do repositório real.
- [ ] Explicar o fluxo e as escolhas da implementação sem depender deste roteiro.

UC-04, fotos, observações estruturadas da receita, exclusão de conta e implantação
final permanecem para P4. A carga maior do agendador precisa de medição;
processamento sequencial com rede externa não garante a meta de 60 s em qualquer escala.
