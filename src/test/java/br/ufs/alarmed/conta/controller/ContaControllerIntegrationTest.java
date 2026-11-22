package br.ufs.alarmed.conta.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/* Testes de integração de POST /contas e POST /login (UC-05, UC-06), subindo o contexto completo (controller + service + repository + banco H2).
 * Cada teste roda numa transação que é desfeita no final, pra um não sujar o outro */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ContaControllerIntegrationTest {

    private static final String SENHA = "remedio123";
    private static final String CREDENCIAIS_INVALIDAS = "Email ou senha inválidos.";

    @Autowired
    private MockMvc mockMvc;


    @Test
    void cadastroValidoRetorna201SemDevolverASenha() throws Exception {
        cadastrar("lauren@exemplo.test", SENHA, SENHA, true)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.nome").value("Lauren"))
                .andExpect(jsonPath("$.email").value("lauren@exemplo.test"))
                .andExpect(jsonPath("$.senha").doesNotExist());
    }

    @Test
    void cadastroAbreASessaoComOIdDoPaciente() throws Exception {
        cadastrar("lauren@exemplo.test", SENHA, SENHA, true)
                .andExpect(result -> assertThat(
                        result.getRequest().getSession(false).getAttribute(ContaController.CHAVE_SESSAO))
                        .isNotNull());
    }

    @Test
    void sessaoDoCadastroIdentificaOPacienteNasDemaisRotas() throws Exception {
        MockHttpSession sessao = (MockHttpSession) cadastrar("lauren@exemplo.test", SENHA, SENHA, true)
                .andReturn().getRequest().getSession(false);

        mockMvc.perform(post("/planos").session(sessao))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.situacao").value("EM_EDICAO"));
    }

    @Test
    void cadastroComConfirmacaoDiferenteDaSenhaRetorna409() throws Exception {
        cadastrar("lauren@exemplo.test", SENHA, "outraSenha123", true)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.mensagem").value("A confirmação da senha não confere"));
    }

    @Test
    void cadastroComEmailRepetidoRetorna409() throws Exception {
        cadastrar("lauren@exemplo.test", SENHA, SENHA, true).andExpect(status().isCreated());

        cadastrar("lauren@exemplo.test", SENHA, SENHA, true)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.mensagem").value("Email já cadastrado."));
    }

    @Test
    void cadastroComEmailRepetidoSoNaCaixaRetorna409() throws Exception {
        cadastrar("lauren@exemplo.test", SENHA, SENHA, true).andExpect(status().isCreated());

        cadastrar("LAUREN@exemplo.test", SENHA, SENHA, true)
                .andExpect(status().isConflict());
    }

    @Test
    void cadastroComSenhaFracaRetorna400() throws Exception {
        cadastrar("lauren@exemplo.test", "abc", "abc", true)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.camposInvalidos.senha").exists());
    }

    @Test
    void cadastroSemAceitarOsTermosRetorna400() throws Exception {
        // UC-05 A4
        cadastrar("lauren@exemplo.test", SENHA, SENHA, false)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.camposInvalidos.aceiteTermos").exists());
    }
    @Test
    void loginCorretoRetorna200EAbreASessao() throws Exception {
        cadastrar("lauren@exemplo.test", SENHA, SENHA, true).andExpect(status().isCreated());

        login("lauren@exemplo.test", SENHA)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("lauren@exemplo.test"))
                .andExpect(jsonPath("$.senha").doesNotExist())
                .andExpect(result -> assertThat(
                        result.getRequest().getSession(false).getAttribute(ContaController.CHAVE_SESSAO))
                        .isNotNull());
    }

    @Test
    void loginComEmailEmOutraCaixaFunciona() throws Exception {
        cadastrar("lauren@exemplo.test", SENHA, SENHA, true).andExpect(status().isCreated());

        login("  LAUREN@Exemplo.test ", SENHA).andExpect(status().isOk());
    }

    @Test
    void loginComEmailInexistenteRetorna401() throws Exception {
        login("ninguem@exemplo.test", SENHA)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.mensagem").value(CREDENCIAIS_INVALIDAS));
    }

    @Test
    void loginComSenhaErradaRetorna401ComAMesmaMensagem() throws Exception {
        cadastrar("lauren@exemplo.test", SENHA, SENHA, true).andExpect(status().isCreated());

        login("lauren@exemplo.test", "senhaErrada1")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.mensagem").value(CREDENCIAIS_INVALIDAS));
    }

    @Test
    void loginSemPreencherOsCamposRetorna400() throws Exception {
        login("", "")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.camposInvalidos.email").exists())
                .andExpect(jsonPath("$.camposInvalidos.senha").exists());
    }

    private ResultActions cadastrar(String email, String senha, String confirmacao, boolean aceiteTermos)
            throws Exception {
        String corpo = """
                {
                  "nome": "Lauren",
                  "email": "%s",
                  "senha": "%s",
                  "confirmacaoSenha": "%s",
                  "dataNascimento": "1956-05-14",
                  "aceiteTermos": %s
                }
                """.formatted(email, senha, confirmacao, aceiteTermos);

        return mockMvc.perform(post("/contas")
                .contentType(MediaType.APPLICATION_JSON)
                .content(corpo));
    }

    private ResultActions login(String email, String senha) throws Exception {
        String corpo = """
                {
                  "email": "%s",
                  "senha": "%s"
                }
                """.formatted(email, senha);

        return mockMvc.perform(post("/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(corpo));
    }
}
