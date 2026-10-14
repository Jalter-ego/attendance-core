'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Solo inserción: no tiene updated_at
      await queryInterface.createTable(
        'activity_logs',
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
          },
          // NULL en acciones del super-admin de la plataforma
          tenant_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'tenants', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          // NULL en acciones sin módulo, como un login sin módulo activo
          module_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'modules', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
          },
          actor_type: { type: Sequelize.STRING(20), allowNull: false },
          // users.id o students.id según actor_type, por eso sin FK
          actor_id: { type: Sequelize.UUID, allowNull: true },
          action: { type: Sequelize.STRING(50), allowNull: false },
          entity_type: { type: Sequelize.STRING(50), allowNull: true },
          entity_id: { type: Sequelize.UUID, allowNull: true },
          old_value: { type: Sequelize.JSONB, allowNull: true },
          new_value: { type: Sequelize.JSONB, allowNull: true },
          ip: { type: Sequelize.INET, allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
        },
        { transaction },
      );

      await queryInterface.addConstraint('activity_logs', {
        type: 'check',
        name: 'activity_logs_actor_type_check',
        fields: ['actor_type'],
        where: { actor_type: ['admin', 'student', 'system'] },
        transaction,
      });

      // RF-10: historial del módulo filtrado por fecha
      await queryInterface.addIndex('activity_logs', ['tenant_id', 'module_id', 'created_at'], {
        name: 'activity_logs_tenant_module_created_idx',
        transaction,
      });

      // RF-10: historial filtrado por estudiante o registro afectado
      await queryInterface.addIndex('activity_logs', ['entity_type', 'entity_id'], {
        name: 'activity_logs_entity_idx',
        transaction,
      });

      await queryInterface.addIndex('activity_logs', ['actor_type', 'actor_id'], {
        name: 'activity_logs_actor_idx',
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('activity_logs');
  },
};
