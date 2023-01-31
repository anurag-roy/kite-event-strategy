import express from 'express';
import { KiteConnect } from 'kiteconnect';
import { writeFileSync } from 'node:fs';
import env from './env.json';

const app = express();
app.use(express.json());

const kc = new KiteConnect({
  api_key: env.API_KEY,
});

const server = app.listen(8000, () => {
  console.log(`Please click on this URL to get logged in: ${kc.getLoginURL()}`);
});

app.use('/login', async (req, res) => {
  const requestToken = req.query.request_token as string;

  console.log('Generating session. Please wait.');
  const result = await kc.generateSession(requestToken, env.API_SECRET);

  writeFileSync('accessToken.txt', result.access_token);

  res.send('Login flow successful!');
  server.close();
});
