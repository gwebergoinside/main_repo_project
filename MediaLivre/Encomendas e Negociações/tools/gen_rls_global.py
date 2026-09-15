#!/usr/bin/env python3
"""Gera a role 'RLS Global' e o Script 5 do TMDL view.

O TMDL nao tem repeticao: o RLS exige uma expressao por tabela. Este script escreve
essas expressoes a partir das tabelas que existem no modelo, para nao serem mantidas
a mao — e, sobretudo, para que uma tabela nova nao fique sem protecao por esquecimento.

Uso:
    python tools/gen_rls_global.py            # regenera os ficheiros
    python tools/gen_rls_global.py --check    # nao escreve; sai != 0 se estiver dessincronizado

A role 'RLS Diretores' NAO e gerada — e mantida a mao no Power BI Desktop. O script
apenas a le para a incluir no Script 5.
"""

import argparse
import glob
import io
import os
import re
import sys

MODEL = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "GO NEXT 360 - MEDIA LIVRE - AD - NEGOCIAÇÕES E AUDIENCIAS.SemanticModel",
)

ROLE = "RLS Global"

# Condicao unica, replicada em todas as tabelas protegidas. Editar aqui e regenerar.
EXPR = (
    'NOT ISEMPTY ( FILTER ( ALL ( pbi_tb_rls_all ), '
    'pbi_tb_rls_all[ds_email] = USERPRINCIPALNAME () '
    '|| pbi_tb_rls_all[ds_email_2] = USERPRINCIPALNAME () ) )'
)

# Ficam sem regra de proposito: sao as tabelas de seguranca, e e delas que as condicoes
# de RLS leem — protege-las tornaria a regra auto-referente. Os grupos de calculo sao
# excluidos automaticamente (o Power BI nao aceita RLS em grupos de calculo).
EXCLUDE = {"pbi_tb_rls", "pbi_tb_rls_all"}

# Ordem das roles no Script 5.
SCRIPT_ROLES = ["RLS Diretores", ROLE]
SCRIPT = "Script 5"


def read(path):
    return io.open(path, encoding="utf-8", newline="").read()


def write(path, text):
    io.open(path, "w", encoding="utf-8", newline="\r\n").write(text.replace("\r\n", "\n"))


def discover_tables(model):
    """Devolve (todas_as_tabelas, grupos_de_calculo), pela ordem dos ficheiros."""
    tables, calc_groups = [], set()
    for path in sorted(glob.glob(os.path.join(model, "definition", "tables", "*.tmdl"))):
        src = read(path)
        m = re.match(r"table\s+('([^']+)'|\S+)", src)
        if not m:
            raise SystemExit("nao consegui ler o nome da tabela em %s" % path)
        name = m.group(2) or m.group(1)
        tables.append(name)
        if re.search(r"^\tcalculationGroup", src, re.M):
            calc_groups.add(name)
    return tables, calc_groups


def quote(name):
    """TMDL so exige aspas quando o nome tem espacos."""
    return "'%s'" % name if " " in name else name


def build_role(targets):
    lines = ["role '%s'" % ROLE, "\tmodelPermission: read", ""]
    for t in targets:
        lines += ["\ttablePermission %s = %s" % (quote(t), EXPR), ""]
    return "\n".join(lines).rstrip("\n") + "\n"


def ensure_ref_role(model, apply):
    """Garante o 'ref role' no model.tmdl.

    O Power BI Desktop reescreve o model.tmdl a partir do modelo em memoria; se a role
    ainda nao tiver sido aplicada la, a linha desaparece e a role deixa de ser carregada
    ao abrir o .pbip. Devolve True se ja estava presente.
    """
    path = os.path.join(model, "definition", "model.tmdl")
    src = read(path)
    line = "ref role '%s'" % ROLE
    if line in src:
        return True
    if apply:
        refs = list(re.finditer(r"^ref table [^\r\n]*\r?\n", src, re.M))
        if not refs:
            raise SystemExit("nao encontrei nenhum 'ref table' em model.tmdl")
        at = refs[-1].end()
        io.open(path, "w", encoding="utf-8", newline="").write(
            src[:at] + "\r\n" + line + "\r\n" + src[at:]
        )
    return False


def build_script(model, role_text):
    blocks = []
    for name in SCRIPT_ROLES:
        if name == ROLE:
            body = role_text
        else:
            body = read(os.path.join(model, "definition", "roles", name + ".tmdl"))
        body = body.replace("\r\n", "\n").rstrip("\n")
        indented = "\n".join(("\t" + ln) if ln.strip() else "" for ln in body.split("\n"))
        blocks.append("createOrReplace\n\n" + indented + "\n")
    return "\n".join(blocks)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=MODEL, help="pasta .SemanticModel")
    ap.add_argument("--check", action="store_true", help="nao escreve; so verifica")
    args = ap.parse_args()

    tables, calc_groups = discover_tables(args.model)
    targets = [t for t in tables if t not in calc_groups and t not in EXCLUDE]

    role_text = build_role(targets)
    script_text = build_script(args.model, role_text)

    role_path = os.path.join(args.model, "definition", "roles", ROLE + ".tmdl")
    script_path = os.path.join(args.model, "TMDLScripts", SCRIPT + ".tmdl")

    print("tabelas no modelo:      %d" % len(tables))
    print("grupos de calculo:      %s" % ", ".join(sorted(calc_groups)))
    print("sem regra (EXCLUDE):    %s" % ", ".join(sorted(EXCLUDE)))
    print("protegidas por %-8s %d" % (ROLE + ":", len(targets)))

    if args.check:
        stale = []
        for path, wanted in ((role_path, role_text), (script_path, script_text)):
            current = read(path).replace("\r\n", "\n") if os.path.exists(path) else None
            if current != wanted.replace("\r\n", "\n"):
                stale.append(os.path.relpath(path, args.model))
        if not ensure_ref_role(args.model, apply=False):
            stale.append("definition/model.tmdl (falta o ref role)")
        if stale:
            print("\nDESSINCRONIZADO: %s" % ", ".join(stale))
            print("corre 'python tools/gen_rls_global.py' para regenerar")
            return 1
        print("\nem dia")
        return 0

    write(role_path, role_text)
    write(script_path, script_text)
    had_ref = ensure_ref_role(args.model, apply=True)
    print("\nescrito: %s" % os.path.relpath(role_path, args.model))
    print("escrito: %s" % os.path.relpath(script_path, args.model))
    if not had_ref:
        print("reposto: definition/model.tmdl (ref role '%s')" % ROLE)
    return 0


if __name__ == "__main__":
    sys.exit(main())
