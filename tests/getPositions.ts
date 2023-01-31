import { KiteConnect } from 'kiteconnect';
import { readFileSync } from 'node:fs';
import env from '../env.json';

const accessToken = readFileSync('./accessToken.txt', 'utf-8');
const kc = new KiteConnect({
  api_key: env.API_KEY,
  access_token: accessToken,
});

const positions = await kc.getPositions();
console.log('Positions are : ', positions);
