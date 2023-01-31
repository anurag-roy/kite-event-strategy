type Stock = {
  tradingsymbol: string;
  token: number;
};

export type EntryRequest = {
  mainStock: Stock;
  options: {
    nspMinusOnePE: Stock;
    nspCE: Stock;
    nspPE: Stock;
    nspPlusOneCE: Stock;
  };
  target: number;
  quantity: number;
  lpd: number;
  exit: number;
  epd: number;
};
