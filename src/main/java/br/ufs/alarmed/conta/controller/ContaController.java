package br.ufs.alarmed.conta.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.HttpStatus;

import br.ufs.alarmed.conta.dto.CadastroRequest;
import br.ufs.alarmed.conta.dto.ContaResponse;
import br.ufs.alarmed.conta.dto.LoginRequest;
import br.ufs.alarmed.conta.model.Paciente;
import br.ufs.alarmed.conta.service.ContaService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;

//Endpoints de conta e login (UC-05, UC-06). Abre a sessão com o id do paciente
@RestController
public class ContaController {

 private final ContaService contaService;
 public static final String CHAVE_SESSAO = "pacienteId";

 public ContaController(ContaService contaService) {
     this.contaService = contaService;
 }

 // UC-05: cadastro
 @PostMapping("/contas")
 @ResponseStatus(HttpStatus.CREATED)
 public ContaResponse cadastrar(@Valid @RequestBody CadastroRequest request, HttpSession sessao) {
	 Paciente paciente = contaService.cadastrar(request);
	 sessao.setAttribute(CHAVE_SESSAO, paciente.getId());
	 return ContaResponse.de(paciente);
 }

 // UC-06: login
 @PostMapping("/login")
 public ContaResponse entrar(@Valid @RequestBody LoginRequest request, HttpSession sessao) {
	 Paciente paciente = contaService.entrar(request);
	 sessao.setAttribute(CHAVE_SESSAO, paciente.getId());
	 return ContaResponse.de(paciente);
 }
}
