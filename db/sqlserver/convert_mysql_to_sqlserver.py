import re
import sys


TYPE_MAP = [
    (re.compile(r"\btinyint\(1\)", re.IGNORECASE), "bit"),
    (re.compile(r"\btinyint\(\d+\)", re.IGNORECASE), "tinyint"),
    (re.compile(r"\bsmallint\(\d+\)", re.IGNORECASE), "smallint"),
    (re.compile(r"\bint\(\d+\)", re.IGNORECASE), "int"),
    (re.compile(r"\bbigint\(\d+\)", re.IGNORECASE), "bigint"),
    (re.compile(r"\bdouble\((\d+)\s*,\s*(\d+)\)", re.IGNORECASE), r"decimal(\1, \2)"),
    (re.compile(r"\bfloat\((\d+)\s*,\s*(\d+)\)", re.IGNORECASE), r"decimal(\1, \2)"),
    (re.compile(r"\bdouble\b", re.IGNORECASE), "float"),
    (re.compile(r"\bdatetime\b", re.IGNORECASE), "datetime2"),
    (re.compile(r"\btimestamp\b", re.IGNORECASE), "datetime2"),
    (re.compile(r"\btext\b", re.IGNORECASE), "nvarchar(max)"),
    (re.compile(r"\blongtext\b", re.IGNORECASE), "nvarchar(max)"),
    (re.compile(r"\bmediumtext\b", re.IGNORECASE), "nvarchar(max)"),
    (re.compile(r"\bjson\b", re.IGNORECASE), "nvarchar(max)"),
    (re.compile(r"\bblob\b", re.IGNORECASE), "varbinary(max)"),
    (re.compile(r"\bmediumblob\b", re.IGNORECASE), "varbinary(max)"),
    (re.compile(r"\blongblob\b", re.IGNORECASE), "varbinary(max)"),
]


def strip_mysql_column_suffixes(line: str) -> str:
    line = re.sub(r"\s+CHARACTER\s+SET\s+\w+", "", line, flags=re.IGNORECASE)
    line = re.sub(r"\s+COLLATE\s+\w+", "", line, flags=re.IGNORECASE)
    line = re.sub(r"\s+COMMENT\s+'([^'\\]|\\.)*'", "", line, flags=re.IGNORECASE)
    line = re.sub(r"\s+DEFAULT\s+NULL", "", line, flags=re.IGNORECASE)
    line = re.sub(r"\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP\(\)", "", line, flags=re.IGNORECASE)
    line = re.sub(r"\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP", "", line, flags=re.IGNORECASE)
    line = re.sub(r"\bCURRENT_TIMESTAMP\(\)\b", "GETDATE()", line, flags=re.IGNORECASE)
    line = re.sub(r"\bCURRENT_TIMESTAMP\b", "GETDATE()", line, flags=re.IGNORECASE)
    line = re.sub(r"\bUNSIGNED\b", "", line, flags=re.IGNORECASE)
    line = re.sub(r"\bZEROFILL\b", "", line, flags=re.IGNORECASE)
    return line


def map_types(line: str) -> str:
    def _varchar_repl(m: re.Match) -> str:
        n = int(m.group(1))
        if n > 4000:
            return "nvarchar(max)"
        return f"nvarchar({n})"

    def _char_repl(m: re.Match) -> str:
        n = int(m.group(1))
        if n > 4000:
            return "nchar(4000)"
        return f"nchar({n})"

    line = re.sub(r"\bvarchar\((\d+)\)", _varchar_repl, line, flags=re.IGNORECASE)
    line = re.sub(r"\bchar\((\d+)\)", _char_repl, line, flags=re.IGNORECASE)
    for pattern, repl in TYPE_MAP:
        line = pattern.sub(repl, line)
    return line


def convert_drop_table(line: str) -> str | None:
    m = re.match(r"\s*DROP\s+TABLE\s+IF\s+EXISTS\s+`([^`]+)`\s*;\s*", line, flags=re.IGNORECASE)
    if not m:
        return None
    table = m.group(1)
    return f"IF OBJECT_ID(N'[{table}]', N'U') IS NOT NULL DROP TABLE [{table}];\n"


def parse_index_columns(cols: str) -> str:
    cols = cols.strip()
    parts = [p.strip() for p in cols.split(",") if p.strip()]
    cleaned: list[str] = []
    for p in parts:
        p = re.sub(r"`([^`]+)`", r"[\1]", p)
        p = re.sub(r"(\[[^\]]+\])\s*\(\d+\)", r"\1", p)
        cleaned.append(p)
    return ", ".join(cleaned)


def convert_create_table(lines: list[str], start_idx: int) -> tuple[list[str], int]:
    header = lines[start_idx]
    m = re.match(r"\s*CREATE\s+TABLE\s+`([^`]+)`\s*\(\s*", header, flags=re.IGNORECASE)
    if not m:
        return [header], start_idx + 1

    table = m.group(1)
    out: list[str] = [f"CREATE TABLE [{table}] (\n"]
    index_statements: list[str] = []

    i = start_idx + 1
    while i < len(lines):
        line = lines[i]
        if re.search(r"\)\s*ENGINE\s*=", line, flags=re.IGNORECASE) or re.match(r"\s*\)\s*;\s*$", line):
            break

        raw = line.rstrip()
        if not raw.strip():
            i += 1
            continue

        raw = re.sub(r"`([^`]+)`", r"[\1]", raw)
        raw = strip_mysql_column_suffixes(raw)
        raw = re.sub(r"\bRESTRICT\b", "NO ACTION", raw, flags=re.IGNORECASE)

        if re.search(r"\bFOREIGN\s+KEY\b", raw, flags=re.IGNORECASE) or re.search(
            r"\bREFERENCES\b", raw, flags=re.IGNORECASE
        ):
            i += 1
            continue

        key_m = re.match(
            r"\s*(UNIQUE\s+)?(KEY|INDEX)\s+(?:\[([^\]]+)\]|(\w+))\s*\((.+)\)\s*(USING\s+\w+)?\s*,?\s*$",
            raw,
            flags=re.IGNORECASE,
        )
        if key_m:
            unique = bool(key_m.group(1))
            idx_name = key_m.group(3) or key_m.group(4)
            cols = parse_index_columns(key_m.group(5))
            if unique:
                index_statements.append(f"CREATE INDEX [{idx_name}] ON [{table}] ({cols});\n")
            else:
                index_statements.append(f"CREATE INDEX [{idx_name}] ON [{table}] ({cols});\n")
            i += 1
            continue

        raw = re.sub(r"USING\s+BTREE", "", raw, flags=re.IGNORECASE)
        raw = map_types(raw)

        raw = re.sub(r"\bAUTO_INCREMENT\b", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\)\s*DEFAULT\s+GETDATE\(\)", ") DEFAULT GETDATE()", raw)

        out.append(raw + "\n")
        i += 1

    if out[-1].rstrip().endswith(","):
        out[-1] = out[-1].rstrip().rstrip(",") + "\n"

    out.append(");\n")
    out.extend(index_statements)
    out.append("\n")

    while i < len(lines) and "CREATE TABLE" not in lines[i] and "INSERT INTO" not in lines[i] and "DROP TABLE" not in lines[i]:
        if ");" in lines[i] or "ENGINE" in lines[i]:
            i += 1
            break
        i += 1
    return out, i


def convert_mysql_string_escapes_to_tsql(sql: str) -> str:
    out: list[str] = []
    in_str = False
    i = 0
    while i < len(sql):
        ch = sql[i]
        if not in_str:
            out.append(ch)
            if ch == "'":
                in_str = True
            i += 1
            continue

        if ch == "\\" and i + 1 < len(sql) and sql[i + 1] == "'":
            out.append("''")
            i += 2
            continue

        out.append(ch)
        if ch == "'":
            in_str = False
        i += 1
    return "".join(out)


def break_long_sql_line(sql: str, max_len: int = 4000) -> str:
    if len(sql) <= max_len:
        return sql

    parts: list[str] = []
    buf: list[str] = []
    in_str = False
    escape = False
    last_break_pos_in_buf: int | None = None
    i = 0
    while i < len(sql):
        ch = sql[i]
        buf.append(ch)

        if in_str:
            if escape:
                escape = False
            else:
                if ch == "\\":
                    escape = True
                elif ch == "'":
                    in_str = False
        else:
            if ch == "'":
                in_str = True
            elif ch == ",":
                last_break_pos_in_buf = len(buf)

        if len(buf) >= max_len and last_break_pos_in_buf is not None:
            chunk = "".join(buf[:last_break_pos_in_buf]).rstrip()
            parts.append(chunk)
            rest = buf[last_break_pos_in_buf:]
            buf = ["\n"] + rest
            last_break_pos_in_buf = None
            in_str = False
            escape = False

        i += 1

    if buf:
        parts.append("".join(buf))
    return "".join(parts)


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: convert_mysql_to_sqlserver.py <mysql_sql_file>", file=sys.stderr)
        return 2

    input_path = sys.argv[1]
    with open(input_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    content = re.sub(r"/\*[\s\S]*?\*/", "", content)
    lines = content.splitlines(keepends=True)

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped or stripped.startswith("--"):
            i += 1
            continue

        if re.match(r"\s*(SET\s+NAMES|SET\s+FOREIGN_KEY_CHECKS|USE\s+|CREATE\s+database)\b", line, flags=re.IGNORECASE):
            i += 1
            continue

        drop_sql = convert_drop_table(line)
        if drop_sql is not None:
            sys.stdout.write(drop_sql)
            i += 1
            continue

        if re.match(r"\s*CREATE\s+TABLE\s+`", line, flags=re.IGNORECASE):
            out, next_i = convert_create_table(lines, i)
            sys.stdout.write("".join(out))
            i = next_i
            continue

        if re.match(r"\s*INSERT\s+INTO\s+`", line, flags=re.IGNORECASE):
            line = re.sub(r"`([^`]+)`", r"[\1]", line)
            line = convert_mysql_string_escapes_to_tsql(line)
            line = break_long_sql_line(line, max_len=3500)
            if not line.endswith("\n"):
                line += "\n"
            sys.stdout.write(line)
            i += 1
            continue

        i += 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
