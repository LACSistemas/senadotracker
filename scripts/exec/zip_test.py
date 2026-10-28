"""Confere a integridade de um ZIP (CRC-32 de todos os membros). Saída 0 = íntegro; 1 = corrompido/truncado. Uso: python -I scripts/exec/zip_test.py <arquivo.zip>"""
import sys, zipfile

try:
    bad = zipfile.ZipFile(sys.argv[1]).testzip()
    sys.exit(0 if bad is None else 1)
except Exception:
    sys.exit(1)
