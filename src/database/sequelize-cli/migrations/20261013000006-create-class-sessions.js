'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'class_sessions',
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
          },
          tenant_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'tenants', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          module_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'modules', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          class_date: { type: Sequelize.DATEONLY, allowNull: false },
          // Informativas: la marca se habilita por fecha, no por hora (RF-12)
          start_time: { type: Sequelize.TIME, allowNull: false },
          end_time: { type: Sequelize.TIME, allowNull: false },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
        },
        { transaction },
      );

      await queryInterface.sequelize.query(
        'ALTER TABLE class_sessions ADD CONSTRAINT class_sessions_time_range_check CHECK (end_time > start_time);',
        { transaction },
      );

      await queryInterface.addIndex('class_sessions', ['module_id', 'class_date'], {
        name: 'class_sessions_module_date_unique',
        unique: true,
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('class_sessions');
  },
};
