'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'students',
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
          registration_number: { type: Sequelize.STRING(50), allowNull: false },
          full_name: { type: Sequelize.STRING(200), allowNull: false },
          email: { type: Sequelize.STRING(255), allowNull: false },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
        },
        { transaction },
      );

      // RN-02: número de registro único dentro del módulo
      await queryInterface.addIndex('students', ['module_id', 'registration_number'], {
        name: 'students_module_registration_unique',
        unique: true,
        transaction,
      });

      // RF-01: el correo también sirve para ingresar
      await queryInterface.sequelize.query(
        'CREATE UNIQUE INDEX students_module_email_unique ON students (module_id, lower(email));',
        { transaction },
      );

      // RF-06: búsqueda por nombre
      await queryInterface.sequelize.query(
        'CREATE INDEX students_full_name_trgm_idx ON students USING gin (full_name gin_trgm_ops);',
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('students');
  },
};
