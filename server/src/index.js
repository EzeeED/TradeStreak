import { createApp } from './app.js';
import { config } from './config.js';

createApp().listen(config.port, () => {
  console.log(`TradeStreak API escuchando en http://localhost:${config.port}`);
});
