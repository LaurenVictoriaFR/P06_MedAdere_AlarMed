package br.ufs.alarmed.plano.controller;

import br.ufs.alarmed.comum.config.ContextoPaciente;
import br.ufs.alarmed.comum.excecao.RecursoNaoEncontradoException;
import br.ufs.alarmed.plano.dto.PlanoResponse;
import br.ufs.alarmed.plano.model.SituacaoPlano;
import br.ufs.alarmed.plano.repository.PlanoMedicamentosoRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
public class RascunhoController {
    private final PlanoMedicamentosoRepository planos;
    private final ContextoPaciente contexto;
    public RascunhoController(PlanoMedicamentosoRepository planos, ContextoPaciente contexto) {
        this.planos = planos; this.contexto = contexto;
    }
    @GetMapping("/planos/rascunho") @Transactional(readOnly = true)
    public PlanoResponse buscar() {
        var paciente = contexto.pacienteAtual();
        for (var estado : new SituacaoPlano[]{SituacaoPlano.EM_REVISAO, SituacaoPlano.EM_EDICAO}) {
            var lista = planos.findByPacienteIdAndSituacao(paciente, estado);
            if (!lista.isEmpty()) return PlanoResponse.de(lista.get(0));
        }
        throw new RecursoNaoEncontradoException("Nenhum rascunho.");
    }
}
