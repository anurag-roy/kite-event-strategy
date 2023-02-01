import { KiteConnect } from 'kiteconnect';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import env from '../env.json';

const ALLOWED_STOCKS = ['CRUDEOIL'];

const EXPIRY_DATES = ['2023-02'];

const kc = new KiteConnect({
  api_key: env.API_KEY,
});

const instruments = await kc.getInstruments(['MCX']);
const filteredInstruments = instruments.filter(
  (i) =>
    ALLOWED_STOCKS.includes(i.name) &&
    EXPIRY_DATES.some((d) => i?.expiry?.toISOString().startsWith(d))
);

const instrumentOptions = filteredInstruments
  .filter((i) => i.instrument_type === 'FUT')
  .map((i) => i.tradingsymbol);

writeFileSync('instruments.json', JSON.stringify(filteredInstruments), 'utf-8');
writeFileSync(
  path.join('ui', 'instrumentOptions.json'),
  JSON.stringify(instrumentOptions),
  'utf-8'
);
