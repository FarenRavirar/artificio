const { jsonrepair } = require('jsonrepair');
const fs = require('fs');

console.log('🔧 Testando jsonrepair com exemplo_mesa_1.json...\n');

try {
  // Ler arquivo original (corrompido)
  const raw = fs.readFileSync('exemplo_mesa_1.json', 'utf8');
  console.log(`📄 Arquivo original: ${(raw.length / 1024).toFixed(2)} KB`);
  
  // Tentar reparar
  console.log('🔧 Aplicando jsonrepair...');
  const repaired = jsonrepair(raw);
  console.log(`✅ JSON reparado: ${(repaired.length / 1024).toFixed(2)} KB`);
  
  // Validar
  const parsed = JSON.parse(repaired);
  console.log(`\n✅ JSON VÁLIDO!`);
  console.log(`   - Guild: ${parsed.guild?.name || 'N/A'}`);
  console.log(`   - Channel: ${parsed.channel?.name || 'N/A'}`);
  console.log(`   - Total de mensagens: ${parsed.messages?.length || 0}`);
  
  // Salvar arquivo reparado
  fs.writeFileSync('exemplo_mesa_1_jsonrepair.json', repaired, 'utf8');
  console.log(`\n💾 Arquivo salvo: exemplo_mesa_1_jsonrepair.json`);
  
} catch (error) {
  console.error(`\n❌ ERRO:`, error.message);
  process.exit(1);
}
