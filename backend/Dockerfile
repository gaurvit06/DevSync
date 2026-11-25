FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src src
RUN mvn -B -Dmaven.test.skip=true package
FROM eclipse-temurin:21-jre
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/target/devsync-1.0.0.jar app.jar
USER 10001
EXPOSE 8086
ENTRYPOINT ["java","-jar","app.jar"]
