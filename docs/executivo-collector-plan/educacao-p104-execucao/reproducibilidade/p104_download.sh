# baixa em sequência, retomável; destino por tipo
while IFS=$'\t' read -r kind u; do
  f=$(basename "$u")
  case $kind in ideb) d=/d/Civica/raw/inep/ideb/2025;; saeb) d=/d/Civica/raw/inep/saeb;; ind) d=/d/Civica/raw/inep/indicadores/arquivos;; esac
  [ -s "$d/$f" ] && continue
  ok=0; for t in 1 2 3 4 5 6; do curl -sS -f --retry 3 --retry-delay 4 -C - -o "$d/$f.part" "$u" && mv "$d/$f.part" "$d/$f" && ok=1 && break; sleep 5; done
  [ $ok = 1 ] || echo "FALHOU $kind $u"
done < /tmp/p104_urls.txt
echo FIM
