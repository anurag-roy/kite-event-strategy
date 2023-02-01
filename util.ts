import { readFileSync } from 'node:fs';
import { Instrument } from './types/index.js';

const NIFTY50 = {
  instrument_token: '256265',
  exchange_token: '1001',
  tradingsymbol: 'NIFTY 50',
  name: 'NIFTY',
  last_price: 0,
  expiry: '',
  strike: 0,
  tick_size: 0,
  lot_size: 0,
  instrument_type: 'EQ',
  segment: 'INDICES',
  exchange: 'NSE',
};

const trimmedInstrumentMapper = (i: Instrument) => {
  return {
    exchange: i.exchange,
    token: Number(i.instrument_token),
    tradingsymbol: i.tradingsymbol,
  };
};

export const getStocks = (futTradingsymbol: string, target: number) => {
  const instruments = JSON.parse(
    readFileSync('instruments.json', 'utf-8')
  ) as Instrument[];

  let mainStock: Instrument;

  if (futTradingsymbol.startsWith('NIFTY')) {
    mainStock = NIFTY50;
  } else {
    mainStock = instruments.find((i) => i.tradingsymbol === futTradingsymbol)!;
  }

  const options = instruments.filter(
    (i) => i.name === mainStock.name && ['CE', 'PE'].includes(i.instrument_type)
  );
  const strikePrices = Array.from(
    new Set<number>(options.map((i) => i.strike).sort((a, b) => a - b))
  );

  const nspIndex = strikePrices.reduce(
    (prevIndex, curr, index) =>
      Math.abs(curr - target) < Math.abs(strikePrices[prevIndex] - target)
        ? index
        : prevIndex,
    0
  );

  const nspMinusOnePE = trimmedInstrumentMapper(
    options.find(
      (i) =>
        i.strike === strikePrices[nspIndex - 1] && i.instrument_type === 'PE'
    )!
  );
  const nspCE = trimmedInstrumentMapper(
    options.find(
      (i) => i.strike === strikePrices[nspIndex] && i.instrument_type === 'CE'
    )!
  );
  const nspPE = trimmedInstrumentMapper(
    options.find(
      (i) => i.strike === strikePrices[nspIndex] && i.instrument_type === 'PE'
    )!
  );
  const nspPlusOneCE = trimmedInstrumentMapper(
    options.find(
      (i) =>
        i.strike === strikePrices[nspIndex + 1] && i.instrument_type === 'CE'
    )!
  );

  console.table({
    nspMinusOnePE: nspMinusOnePE.tradingsymbol,
    nspCE: nspCE.tradingsymbol,
    nspPE: nspPE.tradingsymbol,
    nspPlusOneCE: nspPlusOneCE.tradingsymbol,
  });

  return {
    mainStock: trimmedInstrumentMapper(mainStock),
    nspMinusOnePE,
    nspCE,
    nspPE,
    nspPlusOneCE,
  };
};
