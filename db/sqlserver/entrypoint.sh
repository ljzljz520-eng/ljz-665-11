#!/usr/bin/env bash
set -euo pipefail

MSSQL_HOST="${MSSQL_HOST:-db}"
MSSQL_PORT="${MSSQL_PORT:-1433}"
MSSQL_DB="${MSSQL_DB:-temp1218}"
MSSQL_USER="${MSSQL_USER:-sa}"
MSSQL_PASSWORD="${MSSQL_PASSWORD:-}"

SQLCMD_BIN="$(command -v sqlcmd || true)"
if [[ -z "${SQLCMD_BIN}" && -x /opt/mssql-tools18/bin/sqlcmd ]]; then
  SQLCMD_BIN="/opt/mssql-tools18/bin/sqlcmd"
fi
if [[ -z "${SQLCMD_BIN}" && -x /opt/mssql-tools/bin/sqlcmd ]]; then
  SQLCMD_BIN="/opt/mssql-tools/bin/sqlcmd"
fi
if [[ -z "${SQLCMD_BIN}" ]]; then
  echo "sqlcmd not found in container" >&2
  exit 1
fi

if [[ -z "${MSSQL_PASSWORD}" ]]; then
  echo "MSSQL_PASSWORD is required" >&2
  exit 1
fi

echo "Waiting for SQL Server at ${MSSQL_HOST}:${MSSQL_PORT}..."
for i in $(seq 1 120); do
  if "${SQLCMD_BIN}" -S "${MSSQL_HOST},${MSSQL_PORT}" -U "${MSSQL_USER}" -P "${MSSQL_PASSWORD}" -C -Q "SELECT 1" >/dev/null 2>&1; then
    break
  fi
  sleep 2
  if [[ $i -eq 120 ]]; then
    echo "SQL Server is not ready" >&2
    exit 1
  fi
done

echo "Ensuring database ${MSSQL_DB} exists..."
"${SQLCMD_BIN}" -S "${MSSQL_HOST},${MSSQL_PORT}" -U "${MSSQL_USER}" -P "${MSSQL_PASSWORD}" -C -Q "IF DB_ID(N'${MSSQL_DB}') IS NULL CREATE DATABASE [${MSSQL_DB}] COLLATE Chinese_PRC_CI_AS;"

echo "Converting JeecgBoot MySQL schema to SQL Server..."
python3 /work/convert_mysql_to_sqlserver.py /work/jeecgboot-mysql-5.7.sql > /tmp/jeecgboot-sqlserver.sql

echo "Applying schema to ${MSSQL_DB}... (this may take a few minutes)"
"${SQLCMD_BIN}" -S "${MSSQL_HOST},${MSSQL_PORT}" -U "${MSSQL_USER}" -P "${MSSQL_PASSWORD}" -C -d "${MSSQL_DB}" -b -f 65001 -i /tmp/jeecgboot-sqlserver.sql

echo "Database initialization finished."
