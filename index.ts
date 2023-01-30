import express from 'express';
import { KiteConnect, KiteTicker } from 'kiteconnect';
import { readFileSync } from 'node:fs';
import env from './env.json';
import { EntryRequest } from './types/index.js';

const accessToken = readFileSync('./accessToken.txt', 'utf-8');
const kc = new KiteConnect({
  api_key: env.API_KEY,
  access_token: accessToken,
});

const ticker = new KiteTicker({
  api_key: env.API_KEY,
  access_token: accessToken,
});

const app = express();

let nspMinusOnePEBid = 0;
let nspPlusOneCEBid = 0;

app.post('/entry', async (req, res) => {
  // Get data from request body
  const { mainStock, options, target, quantity, exit, lpd } =
    req.body as EntryRequest;
  const { nspMinusOnePE, nspCE, nspPE, nspPlusOneCE } = options;

  ticker.setMode('ltp', [mainStock.token]);
  ticker.setMode('full', [nspMinusOnePE.token, nspPlusOneCE.token]);

  ticker.on('ticks', async (ticks: any[]) => {
    for (const t of ticks) {
      switch (t.instrument_token) {
        case mainStock.token:
          const ltp = t.last_price;

          // Check entry condition
          if (ltp >= target - lpd && ltp <= target + lpd) {
            await Promise.all([
              kc.placeOrder('regular', {
                exchange: 'NFO',
                order_type: 'LIMIT',
                product: 'NRML',
                quantity: quantity * 8,
                tradingsymbol: nspMinusOnePE.tradingsymbol,
                transaction_type: 'BUY',
                price: nspMinusOnePEBid,
              }),
              kc.placeOrder('regular', {
                exchange: 'NFO',
                order_type: 'LIMIT',
                product: 'NRML',
                quantity: quantity * 8,
                tradingsymbol: nspPlusOneCE.tradingsymbol,
                transaction_type: 'BUY',
                price: nspPlusOneCEBid,
              }),
            ]);
          }
          break;
        case nspMinusOnePE.token:
          if (t?.depth?.buy?.[0]?.price) {
            nspMinusOnePEBid = t.depth.buy[1].price;
          }
          break;
        case nspPlusOneCE.token:
          if (t?.depth?.buy?.[0]?.price) {
            nspPlusOneCEBid = t.depth.buy[1].price;
          }
          break;
        default:
          break;
      }
    }
  });
});
