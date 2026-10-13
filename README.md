# Attendance Core

Backend del sistema de control de asistencias desarrollado con [NestJS](https://nestjs.com/) y [Sequelize](https://sequelize.org/) (PostgreSQL).

---

##  Requisitos Previos

- **Node.js:** `v24.15.0` (o superior)
- **Gestor de paquetes:** `pnpm`
- **Base de Datos:** PostgreSQL

---

##  Instalación y Configuración

1. **Instalar dependencias:**
   ```bash
   pnpm install
   ```

2. **Variables de entorno:**
   Copia el archivo de ejemplo `.env.example` a `.env` y ajusta los valores de conexión:
   ```bash
   cp .env.example .env
---

##  Cómo Levantar el Proyecto

```bash
# Modo desarrollo (con recarga automática)
pnpm run start:dev

# Compilar para producción
pnpm run build

# Ejecutar compilado en producción
pnpm run start:prod
```

El servidor estará disponible en:
```
http://localhost:5000/core/api/v1
```

---

##  Base de Datos, Migraciones y Seeders

El proyecto usa **Sequelize CLI** con soporte para replicación de lectura y escritura. La configuración se encuentra en `.sequelizerc` y `src/database/sequelize-cli/`.

### Migraciones

```bash
# Ejecutar migraciones pendientes
pnpm dlx sequelize-cli db:migrate

# Ver estado de las migraciones
pnpm dlx sequelize-cli db:migrate:status

# Revertir la última migración
pnpm dlx sequelize-cli db:migrate:undo

# Revertir todas las migraciones
pnpm dlx sequelize-cli db:migrate:undo:all

# Crear una nueva migración
pnpm dlx sequelize-cli migration:generate --name nombre_de_la_migracion
```
*Las migraciones se almacenan en:* `src/database/sequelize-cli/migrations/`

### Seeders (Datos iniciales)

```bash
# Ejecutar todos los seeders
pnpm dlx sequelize-cli db:seed:all

# Revertir todos los seeders
pnpm dlx sequelize-cli db:seed:undo:all

# Crear un nuevo seeder
pnpm dlx sequelize-cli seed:generate --name nombre_del_seeder
```
*Los seeders se almacenan en:* `src/database/sequelize-cli/seeders/`

---

##  Estructura del Proyecto y Creación de Módulos

```text
src/
├── config/                  # Configuración global y variables de entorno
├── database/                # Configuración de Sequelize y CLI
│   ├── database-config.service.ts
│   ├── database.module.ts
│   └── sequelize-cli/       # Migraciones, seeders y config CLI
├── modules/                 # Módulos del negocio
│   └── <nombre-modulo>/
│       ├── <nombre>.controller.ts
│       ├── <nombre>.module.ts
│       └── repo/
│           └── <nombre>.model.ts  # <-- Modelos de Sequelize
│           └── <nombre>.service.ts
├── app.module.ts
└── main.ts
```
