import { KiteConnect } from 'kiteconnect';
import { writeFileSync } from 'node:fs';
import env from '../env.json';

const kc = new KiteConnect({
  api_key: env.API_KEY,
});

const instruments = await kc.getInstruments(['MCX']);
writeFileSync('mcx-instruments.json', JSON.stringify(instruments));
