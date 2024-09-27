
import dotenv from 'dotenv';
dotenv.config();

export default {
  development: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: "postgres",
    sslmode: "require",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false 
      }
    }
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    sslmode: "require",
    dialect: "postgres"
  },
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false 
    }
  }
};