import { readFileSync } from 'fs';
import { Instrument } from '../types/index.js';

const instruments = JSON.parse(
  readFileSync('my-instruments.json', 'utf-8')
) as Instrument[];

console.log(
  'FUT Instruments',
  instruments
    .filter((i) => i.instrument_type === 'FUT')
    .map((i) => i.tradingsymbol)
);
