'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'modules',
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
          },
          name: { type: Sequelize.STRING(150), allowNull: false },
          status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'draft' },
          activated_at: { type: Sequelize.DATE, allowNull: true },
          activated_by: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          archived_at: { type: Sequelize.DATE, allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
        },
        { transaction },
      );

      await queryInterface.addConstraint('modules', {
        type: 'check',
        name: 'modules_status_check',
        fields: ['status'],
        where: { status: ['draft', 'active', 'archived'] },
        transaction,
      });

      // RN-01: un solo módulo activo en la instalación
      await queryInterface.addIndex('modules', ['status'], {
        name: 'modules_one_active',
        unique: true,
        where: { status: 'active' },
        transaction,
      });

      await queryInterface.addIndex('modules', ['status'], {
        name: 'modules_status_idx',
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('modules');
  },
};
