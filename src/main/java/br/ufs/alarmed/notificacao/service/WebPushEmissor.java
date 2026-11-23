package br.ufs.alarmed.notificacao.service;

import br.ufs.alarmed.notificacao.model.InscricaoPush;
import java.security.Security;
import nl.martijndwars.webpush.*;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class WebPushEmissor implements EmissorPush {
    private final Preparador servico;
    private final HttpClient cliente = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER).build();
    private static class Preparador extends AbstractPushService<Preparador> {
        Preparador(String publica, String privada, String contato) throws Exception { super(publica, privada, contato); }
        nl.martijndwars.webpush.HttpRequest preparar(Notification n) throws Exception { return prepareRequest(n, Encoding.AES128GCM); }
    }
    private final String publica;
    public WebPushEmissor(@Value("${alarmed.push.vapid.public-key:}") String publica,
                          @Value("${alarmed.push.vapid.private-key:}") String privada,
                          @Value("${alarmed.push.vapid.subject:mailto:contato@example.com}") String contato) {
        this.publica = publica;
        if (publica.isBlank() && privada.isBlank()) { servico = null; return; }
        if (publica.isBlank() || privada.isBlank()) throw new IllegalArgumentException("Configure as duas chaves VAPID.");
        if (Security.getProvider("BC") == null) Security.addProvider(new BouncyCastleProvider());
        try {
            servico = new Preparador(publica, privada, contato);
            if (!Utils.verifyKeyPair(servico.getPrivateKey(), servico.getPublicKey()))
                throw new IllegalArgumentException("As chaves não formam um par.");
        }
        catch (Exception e) { throw new IllegalArgumentException("Chaves VAPID inválidas.", e); }
    }
    @jakarta.annotation.PreDestroy
    public void fechar() { cliente.close(); }
    public boolean configurado() { return servico != null; }
    public String chavePublica() { return publica; }

    public int enviar(InscricaoPush inscricao, byte[] payload, int ttlSegundos) {
        if (!configurado()) return 0;
        try {
            var notificacao = new Notification(inscricao.getEndpoint(), inscricao.getP256dh(),
                    inscricao.getAuth(), payload, Math.max(0, ttlSegundos));
            var preparada = servico.preparar(notificacao);
            var builder = HttpRequest.newBuilder(URI.create(preparada.getUrl())).timeout(Duration.ofSeconds(10))
                    .POST(HttpRequest.BodyPublishers.ofByteArray(preparada.getBody()));
            preparada.getHeaders().forEach(builder::header);
            return cliente.send(builder.build(), HttpResponse.BodyHandlers.discarding()).statusCode();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return 0;
        } catch (Exception e) {
            // Não registrar endpoint/chaves nem dados do medicamento em logs.
            return 0;
        }
    }
}
