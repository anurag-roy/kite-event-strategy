import express from 'express';
import { KiteConnect, KiteTicker } from 'kiteconnect';
import { readFileSync } from 'node:fs';
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
app.use(express.static('dist'));
app.use(express.json());

app.post('/entry', async (req, res) => {
  res.send('Entry Request received!');

  // variables needed for strategy
  let ltp = 0;
  let nspMinusOnePEBid = 0;
  let nspPEAsk = 0;
  let nspPlusOneCEBid = 0;
  let nspCEAsk = 0;
  let entrySatisfied = false;
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

  // Get nsp - 1, nsp and nsp + 1 stocks
  const { mainStock, nspMinusOnePE, nspCE, nspPE, nspPlusOneCE } = getStocks(
    stock,
    target
  );

  // Get quotes and initialize variables with those values,
  // instead of 0 and wait for change
  const quoteParams = [mainStock, nspMinusOnePE, nspPE].map(
    (s) => `${s.exchange}:${s.tradingsymbol}`
  );
  const quotes = await kc.getQuote(quoteParams);

  for (const quote of Object.values(quotes)) {
    switch (quote.instrument_token) {
      case mainStock.token:
        ltp = quote.last_price;
        break;
      case nspMinusOnePE.token:
        if (quote?.depth?.buy?.[0]?.price) {
          nspMinusOnePEBid = quote.depth.buy[0].price;
        }
        break;
      case nspPE.token:
        if (quote?.depth?.sell?.[0]?.price) {
          nspPEAsk = quote.depth.sell[0].price;
        }
        break;
      default:
        break;
    }
  }

  // Setup ticker and connect
  const ticker = new KiteTicker({
    api_key: env.API_KEY,
    access_token: accessToken,
  });

  ticker.connect();

  ticker.on('connect', () => {
    console.log('Connected to Zerodha Kite Ticker!');

    ticker.setMode('ltp', [mainStock.token]);
    ticker.setMode('full', [nspMinusOnePE.token, nspPE.token]);

    ticker.on('ticks', async (ticks: any[]) => {
      for (const t of ticks) {
        switch (t.instrument_token) {
          case mainStock.token:
            ltp = t.last_price;
            console.log(
              `LTP: ${ltp}, Target: ${target}, Entry Price Diff: ${epd}`
            );
            // Check entry condition
            if (ltp >= target - epd && ltp <= target + epd && !entrySatisfied) {
              console.log(
                `Entry condition satisfied for LTP: ${ltp}, Target: ${target}, Entry Price Diff: ${epd}`
              );
              // If any of the bid is less than 0.05, skip this one
              if (nspMinusOnePEBid < 0.05 || nspPEAsk < 0.05) {
                console.log(
                  'One or more prices are below 0.05, not executing order'
                );
                continue;
              }
              // All is good, proceed to order
              entrySatisfied = true;
              try {
                console.log(
                  `Placing BUY order for ${
                    nspMinusOnePE.tradingsymbol
                  } at price ${nspMinusOnePEBid - lpd} and quantity ${
                    quantity * 6
                  }`
                );
                console.log(
                  `Placing SELL order for ${nspPE.tradingsymbol} at price ${
                    nspPEAsk + lpd
                  } and quantity ${quantity}`
                );
                console.log();
                const orderResults = await Promise.all([
                  kc.placeOrder('regular', {
                    exchange: 'NFO',
                    order_type: 'LIMIT',
                    product: 'NRML',
                    quantity: quantity * 6,
                    tradingsymbol: nspMinusOnePE.tradingsymbol,
                    transaction_type: 'BUY',
                    price: nspMinusOnePEBid - lpd,
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
                  'PUT Buy and PUT Sell orders placed successfully!',
                  orderResults
                );
              } catch (error) {
                console.error(
                  'Error occured while placing PUT Buy and PUT Sell orders. Exiting...',
                  error
                );
                process.exit(1);
              }

              ticker.unsubscribe([
                mainStock.token,
                nspMinusOnePE.token,
                nspPE.token,
              ]);

              const quoteParams = [nspPlusOneCE, nspCE].map(
                (s) => `${s.exchange}:${s.tradingsymbol}`
              );
              const quotes = await kc.getQuote(quoteParams);

              for (const quote of Object.values(quotes)) {
                switch (quote.instrument_token) {
                  case nspPlusOneCE.token:
                    if (quote?.depth?.buy?.[0]?.price) {
                      nspPlusOneCEBid = quote.depth.buy[0].price;
                    }
                    break;
                  case nspCE.token:
                    if (quote?.depth?.sell?.[0]?.price) {
                      nspCEAsk = quote.depth.sell[0].price;
                    }
                    break;
                  default:
                    break;
                }
              }

              ticker.setMode('full', [nspPlusOneCE.token, nspCE.token]);

              ticker.on('ticks', (ticks: any) => {
                for (const t of ticks) {
                  switch (t.instrument_token) {
                    case nspPlusOneCE.token:
                      if (t?.depth?.buy?.[0]?.price) {
                        nspPlusOneCEBid = t.depth.buy[0].price;
                      }
                      break;
                    case nspCE.token:
                      if (t?.depth?.sell?.[0]?.price) {
                        nspCEAsk = t.depth.sell[0].price;
                      }
                      break;
                  }
                }
              });

              ticker.on('order_update', async (orderUpdate: any) => {
                if (orderUpdate.status === 'COMPLETE') {
                  if (orderUpdate.instrument_token === nspMinusOnePE.token) {
                    leg1Complete = true;
                    console.log('PUT Buy order completed!');
                  } else if (orderUpdate.instrument_token === nspPE.token) {
                    leg2Complete = true;
                    console.log('PUT Sell order completed!');
                  }

                  if (leg1Complete && leg2Complete) {
                    console.log('Both PUT Buy and PUT Sell orders completed!');
                    try {
                      console.log(
                        `Placing BUY order for ${
                          nspPlusOneCE.tradingsymbol
                        } at price ${nspPlusOneCEBid - lpd} and quantity ${
                          quantity * 6
                        }`
                      );
                      console.log(
                        `Placing SELL order for ${
                          nspCE.tradingsymbol
                        } at price ${nspCEAsk + lpd} and quantity ${quantity}`
                      );
                      const orderResults = await Promise.all([
                        kc.placeOrder('regular', {
                          exchange: 'NFO',
                          order_type: 'LIMIT',
                          product: 'NRML',
                          quantity: quantity * 6,
                          tradingsymbol: nspPlusOneCE.tradingsymbol,
                          transaction_type: 'BUY',
                          price: nspPlusOneCEBid - lpd,
                        }),
                        kc.placeOrder('regular', {
                          exchange: 'NFO',
                          order_type: 'LIMIT',
                          product: 'NRML',
                          quantity: quantity,
                          tradingsymbol: nspCE.tradingsymbol,
                          transaction_type: 'SELL',
                          price: nspCEAsk + lpd,
                        }),
                      ]);
                      console.log(
                        'CALL Buy and CALL Sell orders placed successfully!',
                        orderResults
                      );
                    } catch (error) {
                      console.error(
                        'Error occured while placing CALL Buy and CALL Sell orders. Exiting...',
                        error
                      );
                      process.exit(1);
                    }
                    ticker.unsubscribe([nspPlusOneCE.token, nspCE.token]);

                    ticker.on('order_update', async (orderUpdate: any) => {
                      if (orderUpdate.status === 'COMPLETE') {
                        if (
                          orderUpdate.instrument_token === nspPlusOneCE.token
                        ) {
                          leg3Complete = true;
                          console.log('CALL Buy order completed!');
                        } else if (
                          orderUpdate.instrument_token === nspCE.token
                        ) {
                          leg4Complete = true;
                          console.log('CALL Sell order completed!');
                        }

                        if (leg3Complete && leg4Complete) {
                          console.log(
                            'Both CALL Buy and CALL Sell orders completed! Entry completed!'
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
          case nspPE.token:
            if (t?.depth?.sell?.[0]?.price) {
              nspPEAsk = t.depth.sell[0].price;
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

  // Get quotes and initialize variables with those values,
  // instead of 0 and wait for change
  const quoteParams = [nspMinusOnePE, nspCE, nspPE, nspPlusOneCE].map(
    (s) => `${s.exchange}:${s.tradingsymbol}`
  );
  const quotes = await kc.getQuote(quoteParams);

  for (const quote of Object.values(quotes)) {
    switch (quote.instrument_token) {
      case nspMinusOnePE.token:
        if (quote?.depth?.sell?.[0]?.price) {
          nspMinusOnePEAsk = quote.depth.sell[0].price;
        }
        break;
      case nspPE.token:
        if (quote?.depth?.buy?.[0]?.price) {
          nspPEBid = quote.depth.buy[0].price;
        }
        break;
      case nspPlusOneCE.token:
        if (quote?.depth?.sell?.[0]?.price) {
          nspPlusOneCEAsk = quote.depth.sell[0].price;
        }
        break;
      case nspCE.token:
        if (quote?.depth?.buy?.[0]?.price) {
          nspCEBid = quote.depth.buy[0].price;
        }
        break;
      default:
        break;
    }
  }

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
            } and quantity ${quantity * 6}`
          );
          console.log(
            `Placing SELL order for ${nspPlusOneCE.tradingsymbol} at price ${
              nspPlusOneCEAsk + epd
            } and quantity ${quantity * 6}`
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
              quantity: quantity * 6,
              tradingsymbol: nspMinusOnePE.tradingsymbol,
              transaction_type: 'SELL',
              price: nspMinusOnePEAsk + epd,
            }),
            kc.placeOrder('regular', {
              exchange: 'NFO',
              order_type: 'LIMIT',
              product: 'NRML',
              quantity: quantity * 6,
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
