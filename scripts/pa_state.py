import re
b=open('artifacts/p20_7a_pa_page1_callback.txt',encoding='utf8').read(); print('page1 has keys',re.search(r"'stateObject':\{'keys':\[([^]]*)",b).group(1)[:100]);
