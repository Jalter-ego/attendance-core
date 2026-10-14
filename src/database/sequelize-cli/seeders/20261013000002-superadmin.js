'use strict';

const { randomUUID } = require('crypto');
const { hashSync } = require('bcryptjs');

const SUPERADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@core.com';
const SUPERADMIN_PASSWORD = process.env.SEED_SUPERADMIN_PASSWORD || 'demo';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT id FROM users WHERE lower(email) = lower(:email) AND tenant_id IS NULL',
        {
          replacements: { email: SUPERADMIN_EMAIL },
          transaction,
        },
      );

      if (existing.length > 0) return;

      const now = new Date();
      await queryInterface.bulkInsert(
        'users',
        [
          {
            id: randomUUID(),
            tenant_id: null,
            name: 'Super Administrador',
            email: SUPERADMIN_EMAIL.toLowerCase(),
            password_hash: hashSync(SUPERADMIN_PASSWORD, 10),
            role: 'superadmin',
            is_active: true,
            created_at: now,
            updated_at: now,
          },
        ],
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete(
        'users',
        {
          email: SUPERADMIN_EMAIL.toLowerCase(),
          tenant_id: null,
        },
        { transaction },
      );
    });
  },
};
