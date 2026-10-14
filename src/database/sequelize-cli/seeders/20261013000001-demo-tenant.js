'use strict';

const { randomUUID } = require('crypto');
const { hashSync } = require('bcryptjs');

// Datos de prueba para desarrollo: institución "demo", un admin y un módulo activo
const SLUG = 'demo';
const TIMEZONE = 'America/La_Paz';
const ADMIN_EMAIL = 'admin@demo.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';

// Fecha 'YYYY-MM-DD' en la zona horaria del tenant, desplazada `offsetDays` desde hoy
const dateInTimezone = (offsetDays) => {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(date);
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const tenantId = randomUUID();
    const adminId = randomUUID();
    const moduleId = randomUUID();

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkInsert(
        'tenants',
        [{ id: tenantId, name: 'Institución Demo', slug: SLUG, timezone: TIMEZONE }],
        { transaction },
      );

      await queryInterface.bulkInsert(
        'users',
        [
          {
            id: adminId,
            tenant_id: tenantId,
            name: 'Administrador Demo',
            email: ADMIN_EMAIL,
            password_hash: hashSync(ADMIN_PASSWORD, 10),
            role: 'owner',
          },
        ],
        { transaction },
      );

      await queryInterface.bulkInsert(
        'modules',
        [
          {
            id: moduleId,
            tenant_id: tenantId,
            name: 'Módulo de prueba',
            status: 'active',
            activated_at: new Date(),
            activated_by: adminId,
          },
        ],
        { transaction },
      );

      // Mismos datos que el ejemplo de la especificación
      await queryInterface.bulkInsert(
        'students',
        [
          { registration_number: '1001', full_name: 'Juan Pérez', email: 'juan@gmail.com' },
          { registration_number: '1002', full_name: 'María López', email: 'maria@gmail.com' },
        ].map((student) => ({ id: randomUUID(), tenant_id: tenantId, module_id: moduleId, ...student })),
        { transaction },
      );

      // Una clase pasada, una hoy (para poder marcar) y una futura
      await queryInterface.bulkInsert(
        'class_sessions',
        [-2, 0, 2].map((offset) => ({
          id: randomUUID(),
          tenant_id: tenantId,
          module_id: moduleId,
          class_date: dateInTimezone(offset),
          start_time: '18:00',
          end_time: '21:00',
        })),
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [tenants] = await queryInterface.sequelize.query('SELECT id FROM tenants WHERE slug = :slug', {
        replacements: { slug: SLUG },
        transaction,
      });
      if (tenants.length === 0) return;

      const tenantId = tenants[0].id;
      // Orden inverso a las claves foráneas
      for (const table of ['activity_logs', 'attendances', 'class_sessions', 'students', 'modules', 'users']) {
        await queryInterface.bulkDelete(table, { tenant_id: tenantId }, { transaction });
      }
      await queryInterface.bulkDelete('tenants', { id: tenantId }, { transaction });
    });
  },
};
