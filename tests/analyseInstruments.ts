import { readFileSync, writeFileSync } from 'fs';

type Instrument = {
  instrument_token: string;
  exchange_token: string;
  tradingsymbol: string;
  name: string;
  last_price: number;
  expiry: string;
  strike: number;
  tick_size: number;
  lot_size: number;
  instrument_type: string;
  segment: string;
  exchange: string;
};

const ALLOWED_STOCKS = [
  'NIFTY',
  'ACC',
  'BEL',
  'FEDERALBNK',
  'MANAPPURAM',
  'SAIL',
  'TATASTEEL',
  'TATAMOTORS',
  'MRF',
  'IOC',
];

const instruments = JSON.parse(
  readFileSync('mcx-instruments.json', 'utf-8')
) as Instrument[];

console.log('total instruments : ', instruments.length);

writeFileSync(
  'i.json',
  JSON.stringify(
    instruments.filter((i) => i.expiry && i.expiry.startsWith('2023-02-15')),
    null,
    4
  ),
  'utf-8'
);
