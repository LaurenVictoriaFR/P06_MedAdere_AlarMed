package br.ufs.alarmed.notificacao.service;

import br.ufs.alarmed.comum.config.ContextoPaciente;
import br.ufs.alarmed.comum.excecao.*;
import br.ufs.alarmed.notificacao.dto.InscricaoRequest;
import br.ufs.alarmed.notificacao.model.InscricaoPush;
import br.ufs.alarmed.notificacao.repository.InscricaoPushRepository;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import nl.martijndwars.webpush.Utils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InscricaoService {
    private final InscricaoPushRepository inscricoes;
    private final ContextoPaciente contexto;
    private final EmissorPush emissor;
    private final Set<String> hosts;
    public InscricaoService(InscricaoPushRepository inscricoes, ContextoPaciente contexto, EmissorPush emissor,
            @Value("${alarmed.push.hosts:fcm.googleapis.com,updates.push.services.mozilla.com,web.push.apple.com}") String hosts) {
        this.inscricoes = inscricoes; this.contexto = contexto; this.emissor = emissor;
        this.hosts = new HashSet<>(Arrays.asList(hosts.split(",")));
    }

    @Transactional
    public UUID inscrever(InscricaoRequest r) {
        UUID paciente = contexto.pacienteAtual();
        if (!emissor.configurado()) throw new RegraNegocioException("Lembretes indisponíveis: configure as chaves VAPID no servidor.");
        String hash;
        try {
            URI uri = URI.create(r.endpoint());
            if (!"https".equals(uri.getScheme()) || !hosts.contains(uri.getHost())
                    || (uri.getPort() != -1 && uri.getPort() != 443) || uri.getUserInfo() != null || uri.getFragment() != null)
                throw new IllegalArgumentException();
            byte[] chave = Base64.getUrlDecoder().decode(r.keys().p256dh());
            if (chave.length != 65 || chave[0] != 4 || Base64.getUrlDecoder().decode(r.keys().auth()).length != 16)
                throw new IllegalArgumentException();
            Utils.loadPublicKey(r.keys().p256dh());
            hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(r.endpoint().getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) { throw new RegraNegocioException("Inscrição de push inválida ou provedor não permitido."); }
        var existente = inscricoes.bloquearPorHash(hash);
        if (existente.isPresent()) {
            var i = existente.get();
            if (!i.isAtiva()) throw new RegraNegocioException("Inscrição expirada. Ative os lembretes novamente neste aparelho.");
            if (!i.getPacienteId().equals(paciente)
                    && (!i.getAuth().equals(r.keys().auth()) || !i.getP256dh().equals(r.keys().p256dh())))
                throw new RegraNegocioException("Inscrição já vinculada a outro aparelho.");
            i.atualizar(paciente, r.keys().p256dh(), r.keys().auth());
            return i.getId();
        }
        return inscricoes.save(new InscricaoPush(paciente, r.endpoint(), hash, r.keys().p256dh(), r.keys().auth())).getId();
    }

    @Transactional
    public void remover(UUID id) {
        inscricoes.findByIdAndPacienteId(id, contexto.pacienteAtual())
                .orElseThrow(() -> new RecursoNaoEncontradoException("Inscrição não encontrada.")).desativar();
    }

    @Transactional
    public void removerEndpoint(String endpoint) {
        UUID paciente = contexto.pacienteAtual();
        for (var i : inscricoes.bloquearAtivas(paciente)) {
            if (i.getEndpoint().equals(endpoint)) i.desativar();
        }
    }
}
