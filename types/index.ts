type Stock = {
  tradingsymbol: string;
  token: number;
};

export type Instrument = {
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

export type EntryRequest = {
  stock: string;
  target: number;
  quantity: number;
  entryPriceDifference: number;
  limitPriceDifference: number;
  exit: number;
  exitPriceDifference: number;
};
