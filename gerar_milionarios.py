#!/usr/bin/env python3
"""
Gerador de dataset FICTICIO de "milionarios" para fins educacionais.

IMPORTANTE: Todos os dados gerados por este script sao ARTIFICIAIS e
aleatorios. Nenhum e-mail, nome ou perfil aqui corresponde a uma pessoa
real. O objetivo e demonstrar geracao e manipulacao de grandes volumes
de dados (1 milhao de registros) de forma 100% legal.

Uso:
    python gerar_milionarios.py                 # gera 1.000.000 registros
    python gerar_milionarios.py --quantidade 5000
    python gerar_milionarios.py --saida meu_arquivo.csv
"""

import argparse
import csv
import random

# Componentes para montar nomes em ingles (perfil "gringo")
PRIMEIROS_NOMES = [
    "James", "John", "Robert", "Michael", "William", "David", "Richard",
    "Joseph", "Thomas", "Charles", "Mary", "Patricia", "Jennifer", "Linda",
    "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen", "Emma",
    "Olivia", "Ava", "Sophia", "Isabella", "Liam", "Noah", "Oliver",
    "Elijah", "Lucas", "Henry", "Alexander", "Benjamin", "Daniel", "Matthew",
]

SOBRENOMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Wilson", "Anderson", "Taylor",
    "Thomas", "Moore", "Jackson", "Martin", "Lee", "Thompson", "White",
    "Harris", "Clark", "Lewis", "Walker", "Hall", "Young", "King", "Wright",
    "Scott", "Green", "Baker", "Adams", "Nelson", "Carter", "Mitchell",
]

CARGOS = [
    "CEO", "Founder", "Managing Partner", "Investor", "Chairman",
    "Chief Investment Officer", "Venture Capitalist", "Real Estate Mogul",
    "Hedge Fund Manager", "Private Equity Partner", "Serial Entrepreneur",
    "Board Member", "President", "Owner", "Executive Director",
]

EMPRESAS = [
    "Apex Capital", "Summit Ventures", "Golden Gate Holdings", "Blue Ocean Group",
    "Pinnacle Partners", "Silverline Investments", "Northstar Equity",
    "Everest Holdings", "Vanguard Estates", "Titan Industries",
]

# Paises de lingua inglesa (perfil "gringo que fala ingles")
PAISES = [
    "United States", "United Kingdom", "Canada", "Australia",
    "New Zealand", "Ireland", "Singapore",
]

DOMINIOS = ["example.com", "example.net", "example.org", "test.invalid"]


def gerar_registro(indice: int) -> dict:
    """Cria um unico registro ficticio de milionario."""
    primeiro = random.choice(PRIMEIROS_NOMES)
    sobrenome = random.choice(SOBRENOMES)
    # indice garante e-mails unicos mesmo com nomes repetidos
    email = f"{primeiro.lower()}.{sobrenome.lower()}{indice}@{random.choice(DOMINIOS)}"
    patrimonio = random.randint(1, 5000) * 1_000_000  # de 1M a 5 bilhoes (ficticio)
    return {
        "id": indice,
        "nome_completo": f"{primeiro} {sobrenome}",
        "email": email,
        "cargo": random.choice(CARGOS),
        "empresa": random.choice(EMPRESAS),
        "pais": random.choice(PAISES),
        "idioma": "English",
        "patrimonio_usd": patrimonio,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Gera um dataset FICTICIO de milionarios (dados artificiais)."
    )
    parser.add_argument(
        "--quantidade", "-q", type=int, default=1_000_000,
        help="Quantos registros gerar (padrao: 1.000.000)",
    )
    parser.add_argument(
        "--saida", "-s", type=str, default="milionarios_ficticios.csv",
        help="Nome do arquivo CSV de saida",
    )
    args = parser.parse_args()

    campos = [
        "id", "nome_completo", "email", "cargo",
        "empresa", "pais", "idioma", "patrimonio_usd",
    ]

    print(f"Gerando {args.quantidade:,} registros ficticios em '{args.saida}'...")

    with open(args.saida, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=campos)
        writer.writeheader()
        for i in range(1, args.quantidade + 1):
            writer.writerow(gerar_registro(i))
            if i % 100_000 == 0:
                print(f"  {i:,} registros gerados...")

    print(f"Pronto! Arquivo '{args.saida}' criado com {args.quantidade:,} registros ficticios.")
    print("Lembrete: todos os dados sao artificiais e nao representam pessoas reais.")


if __name__ == "__main__":
    main()
