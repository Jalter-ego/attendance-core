'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // pg_trgm: búsqueda de estudiantes por nombre (RF-06)
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS pg_trgm;');
  },
};
