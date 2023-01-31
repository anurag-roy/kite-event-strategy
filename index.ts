import express from 'express';
import { KiteConnect, KiteTicker } from 'kiteconnect';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { setInterval } from 'node:timers';
import env from './env.json';
import { EntryRequest } from './types/index.js';
import { getStocks } from './util.js';

const accessToken = readFileSync('./accessToken.txt', 'utf-8');
const kc = new KiteConnect({
  api_key: env.API_KEY,
  access_token: accessToken,
});

const app = express();
app.use(express.static(path.join('ui', 'dist')));
app.use(express.json());

app.post('/entry', async (req, res) => {
  res.send('Entry Request received!');

  let nspMinusOnePEBid = 0;
  let nspPlusOneCEBid = 0;
  let nspCEAsk = 0;
  let nspPEAsk = 0;
  let leg1Complete = false;
  let leg2Complete = false;
  let leg3Complete = false;
  let leg4Complete = false;

  // Get data from request body
  const {
    stock,
    target,
    entryPriceDifference: epd,
    quantity,
    limitPriceDifference: lpd,
  } = req.body as EntryRequest;

  console.log('req.body', req.body);

  const { mainStock, nspMinusOnePE, nspCE, nspPE, nspPlusOneCE } = getStocks(
    stock,
    target
  );

  const ticker = new KiteTicker({
    api_key: env.API_KEY,
    access_token: accessToken,
  });

  ticker.connect();

  ticker.on('connect', () => {
    console.log('Connected to Zerodha Kite Ticker!');

    ticker.setMode('ltp', [mainStock.token]);
    ticker.setMode('full', [nspMinusOnePE.token, nspPlusOneCE.token]);

    ticker.on('ticks', async (ticks: any[]) => {
      for (const t of ticks) {
        switch (t.instrument_token) {
          case mainStock.token:
            const ltp = t.last_price;

            // Check entry condition
            if (ltp >= target - epd && ltp <= target + epd) {
              console.log('Entry condition satisfied for ltp', ltp);
              try {
                console.log(
                  `Placing BUY order for ${
                    nspMinusOnePE.tradingsymbol
                  } at price ${nspMinusOnePEBid - lpd} and quantity ${
                    quantity * 8
                  }`
                );
                console.log(
                  `Placing BUY order for ${
                    nspPlusOneCE.tradingsymbol
                  } at price ${nspPlusOneCEBid - lpd} and quantity ${
                    quantity * 8
                  }`
                );
                const orderResults = await Promise.all([
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
                console.log(
                  'Leg 1 and Leg 2 orders placed successfully!',
                  orderResults
                );
              } catch (error) {
                console.error(
                  'Error occured while placing Leg 1 and Leg 2 orders. Exiting...',
                  error
                );
                process.exit(1);
              }

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
                    console.log('Leg 1 order completed!');
                  } else if (
                    orderUpdate.instrument_token === nspPlusOneCE.token
                  ) {
                    leg2Complete = true;
                    console.log('Leg 2 order completed!');
                  }

                  if (leg1Complete && leg2Complete) {
                    console.log('Both Leg 1 and Leg 2 orders completed!');
                    try {
                      console.log(
                        `Placing SELL order for ${
                          nspCE.tradingsymbol
                        } at price ${nspCEAsk + lpd} and quantity ${quantity}`
                      );
                      console.log(
                        `Placing SELL order for ${
                          nspPE.tradingsymbol
                        } at price ${nspPEAsk + lpd} and quantity ${quantity}`
                      );
                      const orderResults = await Promise.all([
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
                      console.log(
                        'Leg 3 and Leg 4 orders placed successfully!',
                        orderResults
                      );
                    } catch (error) {
                      console.error(
                        'Error occured while placing Leg 3 and Leg 4 orders. Exiting...',
                        error
                      );
                      process.exit(1);
                    }
                    ticker.unsubscribe([nspCE.token, nspPE.token]);

                    ticker.on('order_update', async (orderUpdate: any) => {
                      if (orderUpdate.status === 'COMPLETE') {
                        if (orderUpdate.instrument_token === nspCE.token) {
                          leg3Complete = true;
                          console.log('Leg 3 order completed!');
                        } else if (
                          orderUpdate.instrument_token === nspPE.token
                        ) {
                          leg4Complete = true;
                          console.log('Leg 4 order completed!');
                        }

                        if (leg3Complete && leg4Complete) {
                          console.log(
                            'Both Leg 3 and Leg 4 orders completed! Entry completed!'
                          );
                          console.log(
                            'Please trigger exit strategy. Exiting...'
                          );
                          process.exit(0);
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
});

app.post('/exit', async (req, res) => {
  res.send('Exit Request received!');

  let nspMinusOnePEAsk = 0;
  let nspPlusOneCEAsk = 0;
  let nspCEBid = 0;
  let nspPEBid = 0;

  // Get data from request body
  const {
    stock,
    target,
    quantity,
    exit,
    exitPriceDifference: epd,
  } = req.body as EntryRequest;
  const { nspMinusOnePE, nspCE, nspPE, nspPlusOneCE } = getStocks(
    stock,
    target
  );
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

  ticker.connect();
  ticker.on('connect', () => {
    console.log('Connected to Zerodha Kite Ticker!');

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

    setInterval(async () => {
      console.time('getPositions');
      const { day: dayPositions } = await kc.getPositions();
      console.timeEnd('getPositions');
      const autosum = dayPositions.reduce((sum, currentPos) => {
        if (tokensToSubscribe.includes(currentPos.instrument_token)) {
          return sum + currentPos.pnl;
        }
        return sum;
      }, 0);

      if (autosum >= exit || autosum <= -1 * exit) {
        console.log('Exit condition satisfied for autosum', autosum);

        try {
          console.log(
            `Placing SELL order for ${nspMinusOnePE.tradingsymbol} at price ${
              nspMinusOnePEAsk + epd
            } and quantity ${quantity * 8}`
          );
          console.log(
            `Placing SELL order for ${nspPlusOneCE.tradingsymbol} at price ${
              nspPlusOneCEAsk + epd
            } and quantity ${quantity * 8}`
          );
          console.log(
            `Placing BUY order for ${nspCE.tradingsymbol} at price ${
              nspCEBid - epd
            } and quantity ${quantity}`
          );
          console.log(
            `Placing BUY order for ${nspPE.tradingsymbol} at price ${
              nspPEBid - epd
            } and quantity ${quantity}`
          );
          const orderResults = await Promise.all([
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
          console.log('Exit orders placed successfully!', orderResults);
        } catch (error) {
          console.error(
            'Error occured while placing exit orders. Exiting...',
            error
          );
          process.exit(1);
        }
        console.log('Exiting...');
        process.exit(0);
      }
    }, 100);
  });
});

app.listen(8000, () => {
  console.log(`Server started started on http://localhost:8000`);
});
