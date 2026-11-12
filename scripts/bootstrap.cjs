'use strict';

// Ejecutar después de las migraciones. No crea datos demo ni cambia contraseñas existentes.
const { randomUUID } = require('node:crypto');
const { hash } = require('bcryptjs');
const { isEmail } = require('class-validator');
const { Sequelize } = require('sequelize');
const config = require('../src/database/sequelize-cli/migrations-config.js');

async function bootstrap() {
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!name || name.length > 150 || !email || !isEmail(email) || email.length > 255
    || !password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Configura BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL y BOOTSTRAP_ADMIN_PASSWORD (mínimo 12 caracteres, máximo 72 bytes)');
  }

  const db = new Sequelize({ ...config.development, logging: false });
  try {
    await db.transaction(async (transaction) => {
      // Serializa dos ejecuciones del bootstrap sobre la misma base.
      await db.query("SELECT pg_advisory_xact_lock(hashtext('attendance:bootstrap'))", { transaction });
      const [owners] = await db.query("SELECT id FROM users WHERE role = 'owner' AND is_active = true LIMIT 1", { transaction });
      if (owners.length) {
        console.log('La instalación ya tiene un owner activo; no se modificaron sus credenciales.');
        return;
      }
      await db.getQueryInterface().bulkInsert('users', [{
        id: randomUUID(), name, email, role: 'owner', is_active: true,
        password_hash: await hash(password, 12),
        created_at: new Date(), updated_at: new Date(),
      }], { transaction });
      console.log('Administrador inicial creado.');
    });
  } finally {
    await db.close();
  }
}

bootstrap().catch((error) => {
  // No volcar SQL ni opciones de conexión que puedan contener secretos.
  console.error(error.message?.startsWith('Configura ') ? error.message : 'No se pudo inicializar el administrador. Revisa la conexión, las migraciones y el correo configurado.');
  process.exitCode = 1;
});
