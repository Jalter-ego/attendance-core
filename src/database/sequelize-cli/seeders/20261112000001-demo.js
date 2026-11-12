'use strict';

const { randomUUID } = require('crypto');
const { hashSync } = require('bcryptjs');

// Datos de prueba para desarrollo. No ejecutar en una instalación de cliente.
const TIMEZONE = process.env.INSTITUTION_TIMEZONE || 'America/La_Paz';
const ADMIN_EMAIL = 'admin@core.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'demo!';

// Fecha 'YYYY-MM-DD' en la zona horaria de la institución, desplazada `offsetDays` desde hoy
const dateInTimezone = (offsetDays) => {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(date);
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [[{ count }]] = await queryInterface.sequelize.query('SELECT count(*)::int AS count FROM users');
    if (count) throw new Error('El demo requiere una base nueva sin usuarios; no lo combines con bootstrap');
    const adminId = randomUUID();
    const moduleId = randomUUID();

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkInsert(
        'users',
        [
          {
            id: adminId,
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
        ].map((student) => ({ id: randomUUID(), module_id: moduleId, ...student })),
        { transaction },
      );

      // Una clase pasada, una hoy (para poder marcar) y una futura
      await queryInterface.bulkInsert(
        'class_sessions',
        [-2, 0, 2].map((offset) => ({
          id: randomUUID(),
          module_id: moduleId,
          class_date: dateInTimezone(offset),
          start_time: '18:00',
          end_time: '21:00',
        })),
        { transaction },
      );
    });
  },
  async down() {
    throw new Error('Los datos demo no se borran automáticamente. Usa una base descartable para pruebas.');
  },
};
