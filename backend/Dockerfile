FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /app

COPY settings.xml /root/.m2/settings.xml
COPY . .

RUN mvn -s /root/.m2/settings.xml -pl jeecg-module-system/jeecg-system-start -am package -DskipTests

FROM eclipse-temurin:17-jre

WORKDIR /jeecg-boot

ENV TZ=Asia/Shanghai

COPY --from=build /app/jeecg-module-system/jeecg-system-start/target/*.jar /jeecg-boot/app.jar

EXPOSE 8080

ENTRYPOINT ["java","-Dfile.encoding=UTF-8","-Djava.security.egd=file:/dev/./urandom","-jar","/jeecg-boot/app.jar"]
