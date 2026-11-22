package br.ufs.alarmed.dose;

import static org.assertj.core.api.Assertions.*;
import br.ufs.alarmed.notificacao.model.InscricaoPush;
import br.ufs.alarmed.notificacao.service.WebPushEmissor;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.ECGenParameterSpec;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import nl.martijndwars.webpush.Utils;
import org.bouncycastle.jce.interfaces.*;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.junit.jupiter.api.Test;

class WebPushTransporteTest {
    static KeyPair chaves() throws Exception {
        if (Security.getProvider("BC") == null) Security.addProvider(new BouncyCastleProvider());
        var gerador = KeyPairGenerator.getInstance("ECDH", "BC");
        gerador.initialize(new ECGenParameterSpec("secp256r1")); return gerador.generateKeyPair();
    }
    static String publica(KeyPair par) { return Base64.getUrlEncoder().withoutPadding().encodeToString(Utils.encode((ECPublicKey)par.getPublic())); }
    static String privada(KeyPair par) { return Base64.getUrlEncoder().withoutPadding().encodeToString(Utils.encode((ECPrivateKey)par.getPrivate())); }
    @Test void emissorProduzPayloadCriptografadoVapidETtl() throws Exception {
        var vapid = chaves(); var aparelho = chaves();
        var corpo = new AtomicReference<byte[]>(); var autorizacao = new AtomicReference<String>();
        var ttl = new AtomicReference<String>(); var encoding = new AtomicReference<String>();
        HttpServer provedor = HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        provedor.createContext("/push", e -> {
            corpo.set(e.getRequestBody().readAllBytes()); autorizacao.set(e.getRequestHeaders().getFirst("Authorization"));
            ttl.set(e.getRequestHeaders().getFirst("TTL")); encoding.set(e.getRequestHeaders().getFirst("Content-Encoding"));
            e.sendResponseHeaders(201,-1); e.close();
        });
        provedor.start();
        var emissor = new WebPushEmissor(publica(vapid),privada(vapid),"mailto:teste@example.com");
        try {
            var inscricao = new InscricaoPush(UUID.randomUUID(),"http://127.0.0.1:"+provedor.getAddress().getPort()+"/push",
                    "hash",publica(aparelho),Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[16]));
            byte[] mensagem = "{\"titulo\":\"Teste sintético\"}".getBytes(StandardCharsets.UTF_8);
            assertThat(emissor.enviar(inscricao,mensagem,57)).isEqualTo(201);
            assertThat(corpo.get()).isNotEqualTo(mensagem);
            assertThat(new String(corpo.get(),StandardCharsets.UTF_8)).doesNotContain("Teste sintético");
            assertThat(autorizacao.get()).startsWith("vapid ");
            assertThat(ttl.get()).isEqualTo("57"); assertThat(encoding.get()).isEqualTo("aes128gcm");
        } finally { emissor.fechar(); provedor.stop(0); }
    }
}
