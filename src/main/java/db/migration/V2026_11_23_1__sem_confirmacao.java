package db.migration;

import java.sql.*;
import java.util.*;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** Preserva declarações e converte apenas encerramentos automáticos antigos. */
public class V2026_11_23_1__sem_confirmacao extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        Connection c = context.getConnection();
        // O CHECK inline recebeu nomes diferentes no PostgreSQL e no H2.
        List<String> nomes = new ArrayList<>();
        String consulta = "SELECT t.constraint_name, k.check_clause FROM information_schema.table_constraints t "
                + "JOIN information_schema.check_constraints k ON k.constraint_schema=t.constraint_schema "
                + "AND k.constraint_name=t.constraint_name WHERE LOWER(t.table_name)='dose' "
                + "AND t.constraint_type='CHECK' AND t.constraint_schema=current_schema";
        try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery(consulta)) {
            while (rs.next()) {
                String regra = rs.getString(2).toLowerCase(Locale.ROOT);
                // Ignora os NOT NULL virtuais expostos como CHECK no PostgreSQL.
                if (regra.contains("nao_tomada"))
                    nomes.add(rs.getString(1));
            }
        }
        try (Statement s = c.createStatement()) {
            for (String nome : nomes) s.execute("ALTER TABLE dose DROP CONSTRAINT \"" + nome.replace("\"", "\"\"") + "\"");
            s.executeUpdate("UPDATE dose SET estado='SEM_CONFIRMACAO', registrado_em=NULL "
                    + "WHERE estado='NAO_TOMADA' AND automatica=TRUE");
            s.execute("ALTER TABLE dose ADD CONSTRAINT ck_dose_estado CHECK "
                    + "(estado IN ('PROGRAMADA','PENDENTE','TOMADA','NAO_TOMADA','SEM_CONFIRMACAO'))");
            s.execute("ALTER TABLE dose ADD CONSTRAINT ck_dose_registro CHECK "
                    + "((estado IN ('PROGRAMADA','PENDENTE') AND registrado_em IS NULL AND automatica=FALSE) "
                    + "OR (estado IN ('TOMADA','NAO_TOMADA') AND registrado_em IS NOT NULL AND automatica=FALSE) "
                    + "OR (estado='SEM_CONFIRMACAO' AND registrado_em IS NULL AND automatica=TRUE))");
            s.execute("ALTER TABLE dose ADD CONSTRAINT ck_dose_automatica CHECK "
                    + "(automatica=FALSE OR estado='SEM_CONFIRMACAO')");
        }
    }
}
