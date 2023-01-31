import { clearInterval, setInterval } from 'node:timers';

let currentTimer = 0;
const interval = setInterval(() => {
  currentTimer = currentTimer + 100;
  console.log(currentTimer);

  if (currentTimer === 1000) {
    console.log('Ok exiting');
    clearInterval(interval);
  }
}, 100);
