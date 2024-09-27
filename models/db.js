import { Sequelize } from 'sequelize';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import config from '../config/config.js'; // Update the path as needed

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

let sequelize;

if (env === 'production') {

  // For Heroku or other cloud platforms using DATABASE_URL
  const dbUrl = new URL(process.env.DATABASE_URL);
  sequelize = new Sequelize(dbUrl.pathname.substr(1), dbUrl.username, dbUrl.password, {
    host: dbUrl.hostname,
    port: dbUrl.port,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  });
} else {
 
  // For local development
  sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
    host: dbConfig.host,
    dialect: dbConfig.dialect,
    dialectOptions: dbConfig.dialectOptions // This includes the SSL options for local development if needed
  });
}

const db = {};

async function loadModels() {
  try {
    const files = await fs.readdir(__dirname);
    for (const file of files) {
      if (file !== basename && file.endsWith('.js') && file !== 'db.js') {
        const modelPath = path.join(__dirname, file);
        console.log(`Loading model from ${modelPath}`);
        const modelModule = await import(modelPath);
        const model = modelModule.default;
        if (model && model.name) {
          db[model.name] = model(sequelize, Sequelize.DataTypes);
        } else {
          console.error(`Model from ${file} does not have a valid export.`);
        }
      }
    }
  } catch (error) {
    console.error('Error loading models:', error);
  }
}

await loadModels();

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

export { db, sequelize, Sequelize };