package br.ufs.alarmed.dose;

import static org.assertj.core.api.Assertions.*;
import java.sql.*;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class MigracaoSemConfirmacaoTest {
    @Test void atualizaBancoExistenteSemAlterarDeclaracoes() throws Exception {
        String url = System.getProperty("migracao.url", "jdbc:h2:mem:migracao;MODE=PostgreSQL;DB_CLOSE_DELAY=-1");
        String user = System.getProperty("migracao.usuario", "sa");
        String senha = System.getProperty("migracao.senha", "");
        var fonte = new com.zaxxer.hikari.HikariDataSource();
        fonte.setJdbcUrl(url); fonte.setUsername(user); fonte.setPassword(senha); fonte.setMaximumPoolSize(4);
        try (fonte) {
        String schema = "qa_" + UUID.randomUUID().toString().replace("-", "");
        Flyway.configure().dataSource(fonte).schemas(schema).defaultSchema(schema)
                .target("2026.11.22.2").load().migrate();
        try (Connection c = fonte.getConnection(); Statement s = c.createStatement()) {
            s.execute("SET SCHEMA '" + schema + "'");
            String conta=UUID.randomUUID().toString(), paciente=UUID.randomUUID().toString();
            String plano=UUID.randomUUID().toString(), item=UUID.randomUUID().toString();
            s.execute("INSERT INTO conta_usuario (id,nome,email,senha,data_nascimento) VALUES ('"+conta+"','Fictício','qa@exemplo.test','hash','1990-01-01')");
            s.execute("INSERT INTO paciente VALUES ('"+paciente+"','"+conta+"','Fictício')");
            s.execute("INSERT INTO plano_medicamentoso (id,paciente_id,data_inicio,situacao) VALUES ('"+plano+"','"+paciente+"','2026-11-22','CONFIRMADO')");
            s.execute("INSERT INTO item_do_plano (id,plano_id,nome_medicamento,dosagem,frequencia,duracao_tratamento) VALUES ('"+item+"','"+plano+"','Fictício','1','diária','uso contínuo')");
            for (int i=0;i<3;i++) s.execute("INSERT INTO dose VALUES ('d"+i+"','"+plano+"','"+item+"','"+paciente+"','2026-11-22','"+String.format("%02d",8+i)+":00:00','2026-11-22 11:00:00+00','2026-11-22 13:01:00+00','"
                    +(i==2?"TOMADA":"NAO_TOMADA")+"',"+(i==0?"TRUE":"FALSE")+",'2026-11-22 12:00:00+00')");
        }
        Flyway.configure().dataSource(fonte).schemas(schema).defaultSchema(schema).load().migrate();
        try (Connection c = fonte.getConnection(); Statement s = c.createStatement()) {
            s.execute("SET SCHEMA '" + schema + "'");
            try (ResultSet rs=s.executeQuery("SELECT estado,automatica,registrado_em FROM dose ORDER BY id")) {
                assertThat(rs.next()).isTrue(); assertThat(rs.getString(1)).isEqualTo("SEM_CONFIRMACAO");
                assertThat(rs.getBoolean(2)).isTrue(); assertThat(rs.getObject(3)).isNull();
                assertThat(rs.next()).isTrue(); assertThat(rs.getString(1)).isEqualTo("NAO_TOMADA");
                assertThat(rs.getBoolean(2)).isFalse(); assertThat(rs.getObject(3)).isNotNull();
                assertThat(rs.next()).isTrue(); assertThat(rs.getString(1)).isEqualTo("TOMADA");
            }
            assertThatThrownBy(() -> s.execute("UPDATE dose SET estado='SEM_CONFIRMACAO' WHERE id='d1'"))
                    .isInstanceOf(SQLException.class);
            s.execute("DROP SCHEMA \""+schema+"\" CASCADE");
        }
        }
    }
}
