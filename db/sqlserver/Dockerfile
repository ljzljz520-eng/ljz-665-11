FROM mcr.microsoft.com/mssql/server:2022-latest

WORKDIR /work

USER root

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY db/sqlserver/entrypoint.sh ./entrypoint.sh
COPY db/sqlserver/convert_mysql_to_sqlserver.py ./convert_mysql_to_sqlserver.py
COPY backend/db/jeecgboot-mysql-5.7.sql ./jeecgboot-mysql-5.7.sql

RUN chmod +x /work/entrypoint.sh

USER mssql

ENTRYPOINT ["/work/entrypoint.sh"]
