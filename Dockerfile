# Etapa 1: compila e empacota o JAR (precisa de JDK e Maven).
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# Copiar primeiro só o que define as dependências permite reaproveitar o cache do Docker:
# se o pom.xml não mudou, as dependências não são baixadas de novo.
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN chmod +x mvnw && ./mvnw -B dependency:go-offline

# Depois o código. O Checkstyle roda na fase validate, então config/ vai junto.
COPY config config
COPY src src
COPY frontend frontend
# Os testes já rodam na CI; aqui só se gera o JAR.
RUN ./mvnw -B package -DskipTests

# Etapa 2: executa o JAR (precisa só do Java, sem Maven nem código-fonte).
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/alarmed-*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
