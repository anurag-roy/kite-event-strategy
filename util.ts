import { readFileSync } from 'node:fs';
import { Instrument } from './types/index.js';

const trimmedInstrumentMapper = (i: Instrument) => {
  return {
    token: Number(i.instrument_token),
    tradingsymbol: i.tradingsymbol,
  };
};

export const getStocks = (futTradingsymbol: string, target: number) => {
  const instruments = JSON.parse(
    readFileSync('instruments.json', 'utf-8')
  ) as Instrument[];

  const mainStock = instruments.find(
    (i) => i.tradingsymbol === futTradingsymbol
  )!;

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
