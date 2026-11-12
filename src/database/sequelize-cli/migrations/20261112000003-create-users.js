'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'users',
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
          },
          name: { type: Sequelize.STRING(150), allowNull: false },
          email: { type: Sequelize.STRING(255), allowNull: false },
          password_hash: { type: Sequelize.STRING(255), allowNull: false },
          role: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'admin' },
          is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          last_login_at: { type: Sequelize.DATE, allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
        },
        { transaction },
      );

      await queryInterface.addConstraint('users', {
        type: 'check',
        name: 'users_role_check',
        fields: ['role'],
        where: { role: ['owner', 'admin'] },
        transaction,
      });

      // Correo único en toda la instalación, sin distinguir mayúsculas.
      await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX users_email_unique ON users (lower(email));',
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
