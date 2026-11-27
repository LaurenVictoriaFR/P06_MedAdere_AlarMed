package br.ufs.alarmed.plano.controller;

import br.ufs.alarmed.plano.dto.ItemDoPlanoRequest;
import br.ufs.alarmed.plano.dto.PlanoResponse;
import br.ufs.alarmed.plano.service.PlanoMedicamentosoService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Endpoints do cadastro e da alteracao do plano medicamentoso (UC-01, UC-04, UC-08).
// Contrato em docs/CONTRATO_BLOCO_C.md.
// Quem e o paciente vem do ContextoPaciente, resolvido dentro do service.
@RestController
@RequestMapping("/planos")
public class PlanoMedicamentosoController {

    private final PlanoMedicamentosoService planoService;

    public PlanoMedicamentosoController(PlanoMedicamentosoService planoService) {
        this.planoService = planoService;
    }

    // UC-01 passo 1: comeca (ou retoma) o cadastro do plano
    @PostMapping
    public PlanoResponse iniciarCadastro() {
        return planoService.iniciarCadastro();
    }

    // plano confirmado do paciente logado; 404 se ele ainda nao tiver um.
    // o Spring da prioridade a rota fixa "/atual" sobre "/{planoId}", entao as duas convivem.
    @GetMapping("/atual")
    public PlanoResponse buscarPlanoAtual() {
        return planoService.buscarPlanoAtual();
    }

    // cadastro ou alteracao em andamento, pro front retomar (404 se nao tiver)
    @GetMapping("/rascunho")
    public PlanoResponse buscarRascunho() {
        return planoService.buscarRascunho();
    }

    // UC-04 (SD04 iniciarAlteracao): abre a versao em edicao do plano confirmado.
    // 201 quando cria a versao, 200 quando retoma uma que ja estava aberta.
    @PostMapping("/{planoId}/alteracao")
    public ResponseEntity<PlanoResponse> iniciarAlteracao(@PathVariable UUID planoId) {
        PlanoMedicamentosoService.AlteracaoIniciada resultado = planoService.iniciarAlteracao(planoId);
        HttpStatus status = resultado.criada() ? HttpStatus.CREATED : HttpStatus.OK;
        return ResponseEntity.status(status).body(resultado.plano());
    }

    // consulta o plano, usado pela tela de edicao e pela de revisao (P02)
    @GetMapping("/{planoId}")
    public PlanoResponse buscarPlano(@PathVariable UUID planoId) {
        return planoService.buscarPlano(planoId);
    }

    // UC-01 passos 2 a 4: adiciona um medicamento ao plano
    @PostMapping("/{planoId}/itens")
    public PlanoResponse adicionarItem(@PathVariable UUID planoId, @Valid @RequestBody ItemDoPlanoRequest request) {
        return planoService.adicionarItem(planoId, request);
    }

    // tira um medicamento do plano
    @DeleteMapping("/{planoId}/itens/{itemId}")
    public PlanoResponse removerItem(@PathVariable UUID planoId, @PathVariable UUID itemId) {
        return planoService.removerItem(planoId, itemId);
    }

    // UC-01 passo 6: manda o plano pra revisao
    @PostMapping("/{planoId}/revisar")
    public PlanoResponse revisarPlano(@PathVariable UUID planoId) {
        return planoService.revisarPlano(planoId);
    }

    // UC-08 A1: volta da revisao pra edicao, pra corrigir algo
    @PostMapping("/{planoId}/editar")
    public PlanoResponse editarPlano(@PathVariable UUID planoId) {
        return planoService.editarPlano(planoId);
    }

    // UC-01 passo 7 / UC-08 passo 3: confirma o plano revisado
    @PostMapping("/{planoId}/confirmar")
    public PlanoResponse confirmarPlano(@PathVariable UUID planoId) {
        return planoService.confirmarPlano(planoId);
    }

    // desiste do cadastro ou da alteracao (UC-04 A3), enquanto nao foi confirmado
    @DeleteMapping("/{planoId}")
    public ResponseEntity<Void> cancelarCadastro(@PathVariable UUID planoId) {
        planoService.cancelarCadastro(planoId);
        return ResponseEntity.noContent().build();
    }
}
