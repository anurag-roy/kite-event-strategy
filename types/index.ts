type Stock = {
  tradingsymbol: string;
  token: number;
};

export type EntryRequest = {
  orderType: 'MIS' | 'CNC';
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
