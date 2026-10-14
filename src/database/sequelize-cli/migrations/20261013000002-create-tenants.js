'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'tenants',
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
          },
          name: { type: Sequelize.STRING(150), allowNull: false },
          slug: { type: Sequelize.STRING(60), allowNull: false, unique: true },
          timezone: { type: Sequelize.STRING(64), allowNull: false, defaultValue: 'America/La_Paz' },
          status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'active' },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
        },
        { transaction },
      );

      await queryInterface.addConstraint('tenants', {
        type: 'check',
        name: 'tenants_status_check',
        fields: ['status'],
        where: { status: ['active', 'suspended'] },
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tenants');
  },
};
