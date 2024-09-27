import { Sequelize } from 'sequelize';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/config.js';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const basename = path.basename(filename);
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

let sequelize;
if (env === 'production' && process.env.DATABASE_URL) {
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
} else if (dbConfig.use_env_variable) {
  sequelize = new Sequelize(process.env[dbConfig.use_env_variable], dbConfig);
} else {
  sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);
}

const db = {};

async function loadModels() {
  try {
    const files = await fs.readdir(dirname);
    console.log('Files in directory:', files);
    for (const file of files) {
      if (
        file.indexOf('.') !== 0 &&
        file !== basename &&
        file.slice(-3) === '.js' &&
        file.indexOf('.test.js') === -1 &&
        file !== 'db.js' // Skipping db.js if it's not a model file
      ) {
        const modelPath = path.join(dirname, file);
        console.log('Processing model file:', modelPath);
        try {
          const modelModule = await import(modelPath);
          const model = modelModule.default;
          if (!model) {
            console.log(`Model not found in ${modelPath}`);
            continue;
          }
          const initializedModel = model(sequelize, Sequelize.DataTypes);
          console.log(`Loading model ${initializedModel.name}`);
          db[initializedModel.name] = initializedModel;
        } catch (importError) {
          console.error(`Error importing model from ${modelPath}:`, importError);
        }
      }
    }
  } catch (error) {
    console.log('Error reading files:', error);
  }
}

await loadModels();

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;