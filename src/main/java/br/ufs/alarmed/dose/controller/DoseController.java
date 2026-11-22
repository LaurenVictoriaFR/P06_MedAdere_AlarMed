package br.ufs.alarmed.dose.controller;

import br.ufs.alarmed.dose.dto.*;
import br.ufs.alarmed.dose.service.DoseService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
public class DoseController {
    private final DoseService doses;
    public DoseController(DoseService doses) { this.doses = doses; }

    public record RegistroRequest(@NotBlank @Pattern(regexp = "tomada|nao_tomada") String status) { }

    @GetMapping("/doses")
    public List<DoseResponse> listar(@RequestParam(required = false) LocalDate de,
                                     @RequestParam(required = false) LocalDate ate) {
        return doses.listar(de, ate);
    }

    @GetMapping("/registros")
    public Map<String, RegistroResponse> registros(@RequestParam(required = false) LocalDate de,
                                                  @RequestParam(required = false) LocalDate ate) {
        Map<String, RegistroResponse> resultado = new LinkedHashMap<>();
        for (var d : doses.listar(de, ate)) if (d.registro() != null) resultado.put(d.id(), d.registro());
        return resultado;
    }

    @PutMapping("/registros/{id}")
    public RegistroResponse registrar(@PathVariable String id, @Valid @RequestBody RegistroRequest request) {
        return doses.registrar(id, request.status());
    }

    @DeleteMapping("/registros/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desfazer(@PathVariable String id) { doses.desfazer(id); }
}
