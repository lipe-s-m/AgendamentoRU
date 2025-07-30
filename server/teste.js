const string1 = "felipe serejo";
const string2 = "monteiro";
const string = string1 + " "+ string2;

const crypto = require('crypto');

const hash = crypto.createHash('sha256').update(dados).digest('hex');

console.log(string);
console.log(hash);