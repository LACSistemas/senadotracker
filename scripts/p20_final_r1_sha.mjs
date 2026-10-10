import fs from 'node:fs';
import crypto from 'node:crypto';
const files = ['P20_FINAL_R1.json','P20_FINAL_R1.md','P20_FINAL_R1_product_contract.json','P20_FINAL_R1_query_validation.json','P20_FINAL_R1_route_validation.json','P20_FINAL_R1_query_plans.json','P20_FINAL_R1_regression_tests.json','P20_FINAL.json','P20_FINAL.md','P20.json','P20.md'];
const hashes = Object.fromEntries(files.map((file) => [file, crypto.createHash('sha256').update(fs.readFileSync(`artifacts/${file}`)).digest('hex')]));
fs.writeFileSync('artifacts/P20_FINAL_R1_sha256.json', JSON.stringify(hashes, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(hashes, null, 2));

