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
          // NULL solo para el super-admin de la plataforma
          tenant_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'tenants', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
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
        where: { role: ['owner', 'admin', 'superadmin'] },
        transaction,
      });

      await queryInterface.sequelize.query(
        `ALTER TABLE users ADD CONSTRAINT users_superadmin_tenant_check
           CHECK ((role = 'superadmin') = (tenant_id IS NULL));`,
        { transaction },
      );

      // RF-02: correo único por tenant (y entre super-admins), sin distinguir mayúsculas
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX users_tenant_email_unique ON users (tenant_id, lower(email))
           WHERE tenant_id IS NOT NULL;`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX users_superadmin_email_unique ON users (lower(email))
           WHERE tenant_id IS NULL;`,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
