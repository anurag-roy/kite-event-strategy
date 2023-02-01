import { KiteConnect } from 'kiteconnect';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import env from '../env.json';

const ALLOWED_STOCKS = [
  'CUB',
  'FEDERALBNK',
  'IBULHSGFIN',
  'IEX',
  'MOTHERSON',
  'MRF',
  'PFC',
  'OFSS',
  'RAIN',
  'SRF',
  'SAIL',
  'TATASTEEL',
];

const EXPIRY_DATES = ['2023-02-23'];

const kc = new KiteConnect({
  api_key: env.API_KEY,
});

const options = await kc.getInstruments(['NFO']);
const filteredOptions = options.filter(
  (i) =>
    ALLOWED_STOCKS.includes(i.name) &&
    EXPIRY_DATES.some((d) => i?.expiry?.toISOString().startsWith(d))
);

const nseInstruments = await kc.getInstruments(['NSE']);
const filteredEquities = nseInstruments.filter(
  (i) => i.instrument_type === 'EQ' && ALLOWED_STOCKS.includes(i.tradingsymbol)
);
const uiDropwdownOptions = filteredEquities.map((e) => e.tradingsymbol);

writeFileSync('options.json', JSON.stringify(filteredOptions), 'utf-8');
writeFileSync('equities.json', JSON.stringify(filteredEquities), 'utf-8');
writeFileSync(
  path.join('ui', 'dropdownOptions.json'),
  JSON.stringify(uiDropwdownOptions),
  'utf-8'
);
