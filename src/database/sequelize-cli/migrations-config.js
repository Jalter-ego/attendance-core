require('dotenv').config();

module.exports = {
  development: {
    dialect: 'postgres',
    host: process.env.DB_WRITE_HOST,
    port: parseInt(process.env.DB_WRITE_PORT, 10),
    username: process.env.DB_WRITE_USERNAME,
    password: process.env.DB_WRITE_PASSWORD,
    database: process.env.DB_WRITE_NAME,
    pool: {
      max: 1,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
};