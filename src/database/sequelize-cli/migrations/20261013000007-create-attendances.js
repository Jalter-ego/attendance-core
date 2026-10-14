'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'attendances',
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
          student_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'students', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          class_session_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'class_sessions', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'present' },
          // Hora real de la marca del estudiante (RF-03)
          marked_at: { type: Sequelize.DATE, allowNull: true },
          source: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'student' },
          updated_by: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
        },
        { transaction },
      );

      await queryInterface.addConstraint('attendances', {
        type: 'check',
        name: 'attendances_status_check',
        fields: ['status'],
        where: { status: ['present', 'absent'] },
        transaction,
      });

      await queryInterface.addConstraint('attendances', {
        type: 'check',
        name: 'attendances_source_check',
        fields: ['source'],
        where: { source: ['student', 'admin'] },
        transaction,
      });

      // RN-03: una marca por estudiante y fecha de clase
      await queryInterface.addIndex('attendances', ['student_id', 'class_session_id'], {
        name: 'attendances_student_session_unique',
        unique: true,
        transaction,
      });

      // RF-08: vista general filtrada por fecha
      await queryInterface.addIndex('attendances', ['module_id', 'class_session_id'], {
        name: 'attendances_module_session_idx',
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('attendances');
  },
};
