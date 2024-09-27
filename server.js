import db from './models/index.js';

(async () => {
  try {
   // console.log('dfxghjkjlk')
    await db.sequelize.authenticate();
   // console.log('Connection has been established successfully.');
  } catch (error) {
   // console.log('errrror', error)
    console.error('Unable to connect to the database:', error);
  }
})();
