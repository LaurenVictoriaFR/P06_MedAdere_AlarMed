package br.ufs.alarmed.comum.excecao;

import java.util.HashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

// Pega os erros que os controllers lançam e devolve uma resposta HTTP padronizada,
// em vez de cada controller ter que tratar isso na mao.
@RestControllerAdvice
public class TratadorGlobalDeExcecoes {

    // regra de negocio quebrada -> 409
    @ExceptionHandler(RegraNegocioException.class)
    public ResponseEntity<ErroResposta> tratarRegraNegocio(RegraNegocioException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ErroResposta.de(ex.getMessage()));
    }

    // recurso nao encontrado -> 404
    @ExceptionHandler(RecursoNaoEncontradoException.class)
    public ResponseEntity<ErroResposta> tratarRecursoNaoEncontrado(RecursoNaoEncontradoException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErroResposta.de(ex.getMessage()));
    }

    // sem paciente identificado -> 401
    @ExceptionHandler(NaoAutenticadoException.class)
    public ResponseEntity<ErroResposta> tratarNaoAutenticado(NaoAutenticadoException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErroResposta.de(ex.getMessage()));
    }

    // dados invalidos no corpo da requisicao -> 400, com o nome do campo que esta errado
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErroResposta> tratarValidacao(MethodArgumentNotValidException ex) {
        Map<String, String> camposInvalidos = new HashMap<>();
        for (FieldError erro : ex.getBindingResult().getFieldErrors()) {
            camposInvalidos.put(erro.getField(), erro.getDefaultMessage());
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ErroResposta.de("Dados inválidos.", camposInvalidos));
    }
}
