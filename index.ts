import express from 'express';
import { KiteConnect, KiteTicker } from 'kiteconnect';
import { readFileSync } from 'node:fs';
import { clearInterval, setInterval } from 'node:timers';
import env from './env.json';
import { EntryRequest } from './types/index.js';

const accessToken = readFileSync('./accessToken.txt', 'utf-8');
const kc = new KiteConnect({
  api_key: env.API_KEY,
  access_token: accessToken,
});

const app = express();

app.post('/entry', async (req, res) => {
  let nspMinusOnePEBid = 0;
  let nspPlusOneCEBid = 0;
  let nspCEAsk = 0;
  let nspPEAsk = 0;
  let leg1Complete = false;
  let leg2Complete = false;
  let leg3Complete = false;
  let leg4Complete = false;

  // Get data from request body
  const { mainStock, options, target, quantity, lpd } =
    req.body as EntryRequest;
  const { nspMinusOnePE, nspCE, nspPE, nspPlusOneCE } = options;

  const ticker = new KiteTicker({
    api_key: env.API_KEY,
    access_token: accessToken,
  });

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
                price: nspMinusOnePEBid - lpd,
              }),
              kc.placeOrder('regular', {
                exchange: 'NFO',
                order_type: 'LIMIT',
                product: 'NRML',
                quantity: quantity * 8,
                tradingsymbol: nspPlusOneCE.tradingsymbol,
                transaction_type: 'BUY',
                price: nspPlusOneCEBid - lpd,
              }),
            ]);

            ticker.unsubscribe([
              mainStock.token,
              nspMinusOnePE.token,
              nspPlusOneCE.token,
            ]);
            ticker.setMode('full', [nspCE.token, nspPE.token]);

            ticker.on('ticks', (ticks: any) => {
              for (const t of ticks) {
                switch (t.instrument_token) {
                  case nspCE.token:
                    if (t?.depth?.sell?.[0]?.price) {
                      nspCEAsk = t.depth.sell[0].price;
                    }
                    break;
                  case nspPE.token:
                    if (t?.depth?.sell?.[0]?.price) {
                      nspPEAsk = t.depth.sell[0].price;
                    }
                    break;
                }
              }
            });

            ticker.on('order_update', async (orderUpdate: any) => {
              if (orderUpdate.status === 'COMPLETE') {
                if (orderUpdate.instrument_token === nspMinusOnePE.token) {
                  leg1Complete = true;
                } else if (
                  orderUpdate.instrument_token === nspPlusOneCE.token
                ) {
                  leg2Complete = true;
                }

                if (leg1Complete && leg2Complete) {
                  await Promise.all([
                    kc.placeOrder('regular', {
                      exchange: 'NFO',
                      order_type: 'LIMIT',
                      product: 'NRML',
                      quantity: quantity,
                      tradingsymbol: nspCE.tradingsymbol,
                      transaction_type: 'SELL',
                      price: nspCEAsk + lpd,
                    }),
                    kc.placeOrder('regular', {
                      exchange: 'NFO',
                      order_type: 'LIMIT',
                      product: 'NRML',
                      quantity: quantity,
                      tradingsymbol: nspPE.tradingsymbol,
                      transaction_type: 'SELL',
                      price: nspPEAsk + lpd,
                    }),
                  ]);
                  ticker.unsubscribe([nspCE.token, nspPE.token]);

                  ticker.on('order_update', async (orderUpdate: any) => {
                    if (orderUpdate.status === 'COMPLETE') {
                      if (orderUpdate.instrument_token === nspCE.token) {
                        leg3Complete = true;
                      } else if (orderUpdate.instrument_token === nspPE.token) {
                        leg4Complete = true;
                      }

                      if (leg3Complete && leg4Complete) {
                        console.log(
                          'Leg 3 and Leg 4 orders completed! Entry completed!'
                        );
                        ticker.disconnect();
                      }
                    }
                  });
                }
              }
            });
          }
          break;
        case nspMinusOnePE.token:
          if (t?.depth?.buy?.[0]?.price) {
            nspMinusOnePEBid = t.depth.buy[0].price;
          }
          break;
        case nspPlusOneCE.token:
          if (t?.depth?.buy?.[0]?.price) {
            nspPlusOneCEBid = t.depth.buy[0].price;
          }
          break;
        default:
          break;
      }
    }
  });
});

app.post('/exit', async (req, res) => {
  let nspMinusOnePEAsk = 0;
  let nspPlusOneCEAsk = 0;
  let nspCEBid = 0;
  let nspPEBid = 0;

  // Get data from request body
  const { options, quantity, exit, epd } = req.body as EntryRequest;
  const { nspMinusOnePE, nspCE, nspPE, nspPlusOneCE } = options;
  const tokensToSubscribe = [
    nspMinusOnePE.token,
    nspCE.token,
    nspPE.token,
    nspPlusOneCE.token,
  ];

  const ticker = new KiteTicker({
    api_key: env.API_KEY,
    access_token: accessToken,
  });

  ticker.setMode('full', tokensToSubscribe);

  ticker.on('ticks', (ticks: any[]) => {
    for (const t of ticks) {
      switch (t.instrument_token) {
        case nspMinusOnePE.token:
          if (t?.depth?.sell?.[0]?.price) {
            nspMinusOnePEAsk = t.depth.sell[0].price;
          }
          break;
        case nspPlusOneCE.token:
          if (t?.depth?.sell?.[0]?.price) {
            nspPlusOneCEAsk = t.depth.sell[0].price;
          }
          break;
        case nspCE.token:
          if (t?.depth?.buy?.[0]?.price) {
            nspCEBid = t.depth.buy[0].price;
          }
          break;
        case nspPE.token:
          if (t?.depth?.buy?.[0]?.price) {
            nspPEBid = t.depth.buy[0].price;
          }
          break;
        default:
          break;
      }
    }
  });

  const interval = setInterval(async () => {
    const { day: dayPositions } = await kc.getPositions();
    const autosum = dayPositions.reduce((sum, currentPos) => {
      if (tokensToSubscribe.includes(currentPos.instrument_token)) {
        return sum + currentPos.pnl;
      }
      return sum;
    }, 0);
    if (autosum >= exit || autosum <= -1 * exit) {
      await Promise.all([
        kc.placeOrder('regular', {
          exchange: 'NFO',
          order_type: 'LIMIT',
          product: 'NRML',
          quantity: quantity * 8,
          tradingsymbol: nspMinusOnePE.tradingsymbol,
          transaction_type: 'SELL',
          price: nspMinusOnePEAsk + epd,
        }),
        kc.placeOrder('regular', {
          exchange: 'NFO',
          order_type: 'LIMIT',
          product: 'NRML',
          quantity: quantity * 8,
          tradingsymbol: nspPlusOneCE.tradingsymbol,
          transaction_type: 'SELL',
          price: nspPlusOneCEAsk + epd,
        }),
        kc.placeOrder('regular', {
          exchange: 'NFO',
          order_type: 'LIMIT',
          product: 'NRML',
          quantity: quantity,
          tradingsymbol: nspCE.tradingsymbol,
          transaction_type: 'BUY',
          price: nspCEBid - epd,
        }),
        kc.placeOrder('regular', {
          exchange: 'NFO',
          order_type: 'LIMIT',
          product: 'NRML',
          quantity: quantity,
          tradingsymbol: nspPE.tradingsymbol,
          transaction_type: 'BUY',
          price: nspPEBid - epd,
        }),
      ]);
      ticker.disconnect();
      clearInterval(interval);
    }
  }, 100);
});
