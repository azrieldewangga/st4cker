
import { NlpManager } from 'node-nlp';

async function debug() {
    const manager = new NlpManager({ languages: ['id'], forceNER: true, nlu: { useNoneFeature: true } });
    await manager.load('./corpus.json');

    console.log('--- Testing "halo" ---');
    const result1 = await manager.process('id', 'halo');
    console.log('Type of entities:', typeof result1.entities);
    console.log('Is Array?', Array.isArray(result1.entities));
    console.log('Entities value:', JSON.stringify(result1.entities, null, 2));

    console.log('\n--- Testing "20rb" (Entity) ---');
    const result2 = await manager.process('id', '20rb');
    console.log('Type of entities:', typeof result2.entities);
    console.log('Is Array?', Array.isArray(result2.entities));
    console.log('Entities value:', JSON.stringify(result2.entities, null, 2));
}

debug();
