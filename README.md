# AlarMed

PWA de adesao medicamentosa (Projeto Integrador P06, COMP0503 - UFS).

## Requisitos
- JDK 21
- Docker (para o PostgreSQL local)

Nao e preciso instalar o Maven: use o wrapper (`mvnw`).

## Executar
```
docker compose up -d
./mvnw spring-boot:run      # Windows: mvnw.cmd spring-boot:run
```
Aplicacao em http://localhost:8080 (health: /actuator/health).

## Testes
```
./mvnw verify
```
Os testes usam H2 em memoria, sem precisar do PostgreSQL.

## Variaveis de ambiente
| Variavel | Padrao (dev) |
|---|---|
| DB_URL | jdbc:postgresql://localhost:5432/alarmed |
| DB_USER / DB_PASSWORD | alarmed / alarmed |
| VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY | vazio (nao versionar) |
