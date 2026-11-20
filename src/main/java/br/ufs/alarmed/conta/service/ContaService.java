package br.ufs.alarmed.conta.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.ufs.alarmed.comum.excecao.NaoAutenticadoException;
import br.ufs.alarmed.comum.excecao.RegraNegocioException;
import br.ufs.alarmed.conta.dto.CadastroRequest;
import br.ufs.alarmed.conta.dto.LoginRequest;
import br.ufs.alarmed.conta.model.ContaUsuario;
import br.ufs.alarmed.conta.model.Paciente;
import br.ufs.alarmed.conta.repository.ContaUsuarioRepository;
import br.ufs.alarmed.conta.repository.PacienteRepository;

/*UC-05: cria a conta e o paciente juntos (DM01). Devolve o paciente porque é o id dele que fica na sessão.
 *UC-06: email inexistente e senha errada dão o mesmo 401, pra não revelar se o email existe */
@Service
public class ContaService {
	private static final String CREDENCIAIS_INVALIDAS = "Email ou senha inválidos.";
	private final ContaUsuarioRepository contaRepository;
	private final PacienteRepository pacienteRepository;

	public ContaService(ContaUsuarioRepository contaRepository, PacienteRepository pacienteRepository) {
		this.contaRepository = contaRepository;
		this.pacienteRepository = pacienteRepository;
	}

	@Transactional
	public Paciente cadastrar(CadastroRequest request) {
		if (!request.senha().equals(request.confirmacaoSenha())) {
			throw new RegraNegocioException("A confirmação da senha não confere");
		}

		String email = normalizar(request.email());
		if (contaRepository.existsByEmail(email)) {
			throw new RegraNegocioException("Email já cadastrado.");
		}

		ContaUsuario conta = contaRepository.save(
				new ContaUsuario(request.nome(), email, request.senha(), request.dataNascimento(), request.telefone()));

		return pacienteRepository.save(new Paciente(conta, request.nome()));
	}

	public Paciente entrar(LoginRequest request) {
	    String email = normalizar(request.email());
	    ContaUsuario conta = contaRepository.findByEmail(email)
	            .orElseThrow(() -> new NaoAutenticadoException(CREDENCIAIS_INVALIDAS));

	    if (!request.senha().equals(conta.getSenha())) {
	        throw new NaoAutenticadoException(CREDENCIAIS_INVALIDAS);
	    }
	    Paciente paciente = pacienteRepository.findByConta(conta)
	            .orElseThrow(() -> new IllegalStateException("Conta sem paciente associado."));
	    return paciente;
	}

	private String normalizar(String email) {
		return email.trim().toLowerCase();
	}
}