# Attendance Core

Backend del sistema web de registro y control de asistencia, desarrollado con [NestJS](https://nestjs.com/) y [Sequelize](https://sequelize.org/) sobre PostgreSQL.

Cada instalación atiende a **una sola institución** y tiene su propia base PostgreSQL, backend y frontend. La futura plataforma será responsable de crear y administrar esas instalaciones. Attendance no selecciona instituciones por subdominio ni contiene la administración de clientes de la plataforma.

Hay un solo **módulo académico activo** a la vez; al activar uno nuevo, el anterior se archiva sin borrar sus datos.

Las migraciones crean las tablas para una sola institución en el esquema predeterminado de PostgreSQL (`public`), sin crear esquemas adicionales ni comprobar el esquema al arrancar. Puedes reutilizar la base actual después de borrar las tablas anteriores. Al reiniciarla, elimina también `SequelizeMeta`, que guarda el historial de migraciones, y vuelve a ejecutar `pnpm db:migrate`.

---

## Índice

1. [Requisitos previos](#requisitos-previos)
2. [Instalación y configuración](#instalación-y-configuración)
3. [Cómo levantar el proyecto](#cómo-levantar-el-proyecto)
4. [Cómo funciona](#cómo-funciona)
5. [Endpoints](#endpoints)
6. [Cómo probar](#cómo-probar)
7. [Formato de los archivos Excel](#formato-de-los-archivos-excel)
8. [Base de datos, migraciones y seeders](#base-de-datos-migraciones-y-seeders)
9. [Estructura del proyecto](#estructura-del-proyecto)

---

## Requisitos previos

- **Node.js:** `v24.15.0` o superior
- **Gestor de paquetes:** `pnpm`, instalado en tu equipo.
- **Base de datos:** PostgreSQL 13 o superior

---

## Instalación y configuración

1. **Instalar dependencias:**

   ```bash
   pnpm install
   ```
2. **Variables de entorno.** Si no tienes `.env`, copia el ejemplo. Si ya existe, actualiza sus valores sin sobrescribirlo:

   ```bash
   cp .env.example .env
   ```
3. Configura una base sin las tablas anteriores (puedes reutilizar la actual después de borrarlas) y ajusta `DB_READ_*` y `DB_WRITE_*`. Por ahora ambos pueden apuntar al mismo PostgreSQL. Ajusta también:

   | Variable | Uso |
   | --- | --- |
   | `INSTITUTION_NAME` | Nombre mostrado en el frontend. |
   | `INSTITUTION_TIMEZONE` | Zona IANA para las fechas de asistencia, por ejemplo `America/La_Paz`. |
   | `CORS_ORIGIN` | URL del frontend; admite varias separadas por comas. |
   | `DB_SSL` | `false` para PostgreSQL local; según la conexión para producción. |
   | `JWT_SECRET` | Secreto largo y aleatorio **distinto en cada instalación**. Evita que un token de un cliente funcione en otro. |
   | `JWT_EXPIRES_IN` | Duración del token, por defecto `8h`. |

4. **Crear las tablas:**

   ```bash
   pnpm db:migrate
   ```

5. Elige una forma de inicialización:

   - **Instalación de cliente:** configura `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` (mínimo 12 caracteres y máximo 72 bytes), y ejecuta:

     ```bash
     pnpm instance:bootstrap
     ```

     Crea el primer `owner`. Puedes repetirlo: si ya hay un owner activo, no cambia credenciales ni crea duplicados. No carga estudiantes ni módulos de prueba. Retira la contraseña de bootstrap del entorno del servicio después de inicializarlo.

   - **Desarrollo con datos de ejemplo:** en una base descartable y sin usuarios ejecuta `pnpm db:seed`. No combines el demo con el bootstrap.

No subas `.env` ni secretos a Git. La futura automatización debe suministrarlos a cada backend por separado.

---

## Cómo levantar el proyecto

```bash
# Modo desarrollo (con recarga automática)
pnpm start:dev

# Compilar y ejecutar para producción
pnpm build
pnpm start:prod
```

El servidor queda disponible en:

```
http://localhost:5000/core/api/v1
```

---

## Cómo funciona

### Roles

| Rol                     | Cómo ingresa                                         | Qué puede hacer                                                                            |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Administrador** | Correo + contraseña                   | Crea e importa módulos, consulta y corrige asistencias, revisa el historial de actividades |
| **Estudiante**    | Correo **o** número de registro | Marca su asistencia el día de clase y consulta su historial                                |

Al iniciar sesión se recibe un **JWT** que se envía en cada petición:

```
Authorization: Bearer <accessToken>
```

El token indica quién es el usuario y, en el caso del estudiante, su módulo. El aislamiento entre clientes lo proporciona su instalación y base independiente. Los administradores tienen roles `owner` o `admin`; solo el `owner` administra cuentas mediante `/users`.

Las rutas de negocio exigen token. Son públicos los logins, la raíz, `GET /institution` (nombre y zona horaria) y `GET /health` (conexión a la base; devuelve 503 si falla). Cada ruta además está restringida a un rol: si un estudiante llama a una ruta de admin, o al revés, recibe `403`.

### Ciclo de vida de un módulo académico

```
draft (borrador) ──activar──▶ active (activo) ──al activar otro──▶ archived (archivado)
```

1. El admin crea un módulo en **borrador**.
2. Importa los estudiantes y las fechas de clase desde Excel. Puede volver a subir un archivo y reemplaza la carga anterior.
3. Revisa la vista previa y **activa** el módulo, con confirmación explícita.
4. Al activarlo, el módulo activo anterior pasa a **archivado** en la misma transacción. Sus datos se conservan en la base, pero dejan de verse en la operación diaria.
5. Las sesiones de los estudiantes del módulo anterior dejan de funcionar y tienen que volver a iniciar sesión.

### Asistencia

- El estudiante solo puede marcar **el día de una fecha de clase**. "Hoy" se calcula con la zona horaria de la institución (`America/La_Paz` por defecto), no con la del servidor.
- Solo se admite **una marca** por estudiante y fecha. La base de datos lo garantiza, incluso con peticiones simultáneas.
- Las horas de inicio y fin son informativas: se puede marcar en cualquier momento del día de clase.
- Las faltas **no se guardan, se calculan**: una fecha pasada sin marca cuenta como Falta.

Cada fecha se muestra con uno de estos estados:

| Estado       | Significado                                                   |
| ------------ | ------------------------------------------------------------- |
| `present`  | Presente                                                      |
| `absent`   | Falta: la fecha pasó sin marca, o el admin la registró así |
| `pending`  | La clase es hoy y el estudiante todavía puede marcar         |
| `upcoming` | La fecha aún no llega                                        |

- El admin puede cambiar Presente/Falta en **cualquier fecha** del módulo activo, incluso en fechas pasadas.
- `markedAt` es la hora real en que marcó el estudiante. Una corrección del admin no la inventa.

### Historial de actividades

Se registran en `activity_logs` el usuario, la acción, la fecha y hora, la IP, el registro afectado y, en las correcciones, el valor anterior y el nuevo:

| Acción                                       | Cuándo                                  |
| --------------------------------------------- | ---------------------------------------- |
| `LOGIN` / `LOGOUT`                        | Ingreso y salida de admins y estudiantes |
| `STUDENTS_IMPORTED` / `SESSIONS_IMPORTED` | Importación de un Excel                 |
| `MODULE_ACTIVATED`                          | Activación de un módulo                |
| `ATTENDANCE_MARKED`                         | El estudiante marcó su asistencia       |
| `ATTENDANCE_UPDATED`                        | El admin corrigió una asistencia        |

---

## Endpoints

Todas las rutas van bajo `http://localhost:5000/core/api/v1`.

### Formato de los errores

```json
{ "statusCode": 401, "message": "Correo o contraseña incorrectos", "error": "Unauthorized" }
```

- En los errores de validación (`400`), `message` es una lista: `["Ingresa un correo válido", "Ingresa tu contraseña"]`.
- En los errores de importación (`422`), la respuesta trae la lista de filas que hay que corregir:
  ```json
  {
    "message": "El archivo tiene 2 errores",
    "errors": [
      { "row": 4, "field": "Correo electrónico", "message": "Está vacío" },
      { "row": 7, "field": "Número de registro", "message": "1001 está repetido (fila 3)" }
    ]
  }
  ```

| Código | Significado                                                                           |
| ------- | ------------------------------------------------------------------------------------- |
| `400` | Datos mal enviados (validación)                                                      |
| `401` | Sin sesión, sesión vencida o credenciales incorrectas                               |
| `403` | El rol no tiene permiso para esa ruta                                                 |
| `404` | El recurso no existe o no pertenece al módulo activo                                 |
| `409` | Conflicto, por ejemplo una asistencia ya marcada o un módulo ya activo               |
| `422` | La operación no se puede hacer, por ejemplo un Excel con errores o un día sin clase |

---

### Autenticación

| Método | Ruta                    | Acceso             | Descripción                         |
| ------- | ----------------------- | ------------------ | ------------------------------------ |
| POST    | `/auth/admin/login`   | Público           | Login del administrador              |
| POST    | `/auth/student/login` | Público           | Login del estudiante                 |
| GET     | `/auth/me`            | Admin y estudiante | Datos del usuario de la sesión      |
| POST    | `/auth/logout`        | Admin y estudiante | Registra la salida. Responde `204` |

**POST `/auth/admin/login`**

```json
{ "email": "admin@core.com", "password": "demo!" }
```

Respuesta `200`:

```json
{
  "accessToken": "eyJhbGciOi...",
  "user": { "id": "…", "name": "Administrador Demo", "email": "admin@core.com", "role": "owner" },
  "institution": { "name": "Mi Institución", "timezone": "America/La_Paz" }
}
```

**POST `/auth/student/login`**. `identifier` acepta el correo o el número de registro:

```json
{ "identifier": "1001" }
```

Respuesta `200`:

```json
{
  "accessToken": "eyJhbGciOi...",
  "student": { "id": "…", "registrationNumber": "1001", "fullName": "Juan Pérez", "email": "juan@gmail.com" },
  "module": { "id": "…", "name": "Módulo de prueba" },
  "institution": { "name": "Mi Institución", "timezone": "America/La_Paz" }
}
```

Si el estudiante no está en el módulo activo, responde `401` con "Los datos no corresponden a un estudiante del módulo activo".

> El JWT no se puede invalidar en el servidor. Al cerrar sesión, el frontend debe borrar el token.

---

### Módulos académicos (admin)

| Método | Ruta                                   | Descripción                                              |
| ------- | -------------------------------------- | --------------------------------------------------------- |
| POST    | `/modules`                           | Crea un módulo en borrador                               |
| GET     | `/modules`                           | Lista el borrador y el módulo activo, con sus cantidades |
| GET     | `/modules/active`                    | Módulo activo                                            |
| GET     | `/modules/:id`                       | Vista previa con estudiantes y fechas                     |
| POST    | `/modules/:moduleId/students/import` | Importa estudiantes desde Excel                           |
| POST    | `/modules/:moduleId/sessions/import` | Importa fechas de clase desde Excel                       |
| POST    | `/modules/:id/activate`              | Activa el módulo y archiva el anterior                   |

**POST `/modules`**

```json
{ "name": "Módulo 3 - Backend" }
```

Respuesta `201`:

```json
{ "id": "…", "name": "Módulo 3 - Backend", "status": "draft", "activatedAt": null, "createdAt": "…", "studentsCount": 0, "sessionsCount": 0 }
```

**POST `/modules/:moduleId/students/import`** y **`/sessions/import`**

- Body de tipo `multipart/form-data`, con el campo **`file`** y un archivo `.xlsx` de hasta 5 MB.
- Respuesta `201`: `{ "imported": 5 }`.
- Si hay errores, responde `422` con la lista y **no guarda nada**.
- Solo funciona con módulos en borrador. Sobre el módulo activo responde `409`.

**GET `/modules/:id`**. Respuesta `200`:

```json
{
  "id": "…", "name": "Módulo 3 - Backend", "status": "draft", "studentsCount": 5, "sessionsCount": 6,
  "students": [{ "id": "…", "registrationNumber": "1004", "fullName": "Ana Quispe", "email": "ana.quispe@gmail.com" }],
  "sessions": [{ "id": "…", "classDate": "2026-10-05", "startTime": "18:00", "endTime": "21:00" }]
}
```

**POST `/modules/:id/activate`**. La confirmación es obligatoria:

```json
{ "confirm": true }
```

- Respuesta `200`: el módulo activado y `archivedModule`, el que se archivó.
- Responde `422` si el módulo no tiene estudiantes o fechas, y `409` si ya está activo.

---

### Asistencia del estudiante

| Método | Ruta                  | Descripción                                              |
| ------- | --------------------- | --------------------------------------------------------- |
| GET     | `/attendance/today` | Si hoy hay clase y si ya marcó, para habilitar el botón |
| POST    | `/attendance/mark`  | Marca la asistencia de hoy                                |
| GET     | `/attendance/me`    | Historial con el estado de cada fecha y un resumen        |

**GET `/attendance/today`**. Respuesta `200`:

```json
{
  "date": "2026-10-13",
  "session": { "id": "…", "classDate": "2026-10-13", "startTime": "18:00", "endTime": "21:00" },
  "canMark": true,
  "attendance": null
}
```

**POST `/attendance/mark`**. No lleva body.

- Respuesta `201`: `{ "id": "…", "status": "present", "markedAt": "2026-10-14T01:50:01.666Z", "session": { … } }`.
- Responde `409` si ya hay una asistencia para hoy, y `422` si hoy no hay clase.

**GET `/attendance/me`**. Respuesta `200`:

```json
{
  "module": { "id": "…", "name": "Módulo de prueba" },
  "today": "2026-10-13",
  "summary": { "total": 3, "present": 1, "absent": 1, "pending": 0, "upcoming": 1 },
  "sessions": [
    { "id": "…", "classDate": "2026-10-11", "startTime": "18:00", "endTime": "21:00", "status": "absent", "markedAt": null },
    { "id": "…", "classDate": "2026-10-13", "startTime": "18:00", "endTime": "21:00", "status": "present", "markedAt": "2026-10-14T01:50:01.666Z" },
    { "id": "…", "classDate": "2026-10-15", "startTime": "18:00", "endTime": "21:00", "status": "upcoming", "markedAt": null }
  ]
}
```

> `markedAt` va en UTC. El frontend debe mostrarlo en hora local: `2026-10-14T01:50Z` son las 21:50 del 13 en Bolivia.

---

### Administración de estudiantes y asistencias (admin)

| Método | Ruta                                               | Descripción                                        |
| ------- | -------------------------------------------------- | --------------------------------------------------- |
| GET     | `/students?search=`                              | Estudiantes del módulo activo                      |
| GET     | `/attendances?date=&studentId=`                  | Vista general de asistencias con totales            |
| PUT     | `/attendances`                                   | Cambia Presente/Falta de un estudiante en una fecha |
| GET     | `/activity-logs?studentId=&date=&limit=&offset=` | Historial de actividades del módulo activo         |

**GET `/students`**

- `search` es opcional. Busca por nombre (en cualquier parte, sin importar mayúsculas) o por número de registro (desde el inicio).
- Respuesta `200`: `{ "module": { … }, "total": 2, "students": [{ "id", "registrationNumber", "fullName", "email" }] }`.

**GET `/attendances`**

- Filtros opcionales y combinables: `date` (`AAAA-MM-DD`) y `studentId`.
- Respuesta `200`:
  ```json
  {
    "module": { "id": "…", "name": "Módulo de prueba" },
    "today": "2026-10-13",
    "filters": { "date": "2026-10-13", "studentId": null },
    "totals": { "total": 2, "present": 1, "absent": 0, "pending": 1, "upcoming": 0 },
    "records": [
      {
        "student": { "id": "…", "registrationNumber": "1001", "fullName": "Juan Pérez" },
        "session": { "id": "…", "classDate": "2026-10-13", "startTime": "18:00", "endTime": "21:00" },
        "status": "present", "markedAt": "2026-10-14T01:50:01.666Z", "source": "student"
      }
    ]
  }
  ```

**PUT `/attendances`**

```json
{ "studentId": "…", "classSessionId": "…", "status": "present" }
```

Respuesta `200`:

```json
{
  "changed": true, "previousStatus": "absent", "status": "present",
  "student": { … }, "session": { … }, "markedAt": null
}
```

- Si la fecha ya tiene ese estado, responde `changed: false` y no registra nada.
- Cada cambio queda auditado en el historial de actividades.

**GET `/activity-logs`**

- `studentId` incluye lo que hizo el estudiante y las correcciones de sus asistencias.
- `date` (`AAAA-MM-DD`) se interpreta en la zona horaria de la institución.
- `limit` va de 1 a 200 (por defecto 50) y `offset` por defecto es 0.
- Respuesta `200`:
  ```json
  {
    "total": 7, "limit": 50, "offset": 0,
    "items": [
      {
        "id": "…", "createdAt": "…", "action": "ATTENDANCE_UPDATED",
        "actor": { "type": "admin", "id": "…", "name": "Administrador Demo" },
        "entityType": "attendance", "entityId": "…",
        "oldValue": { "status": "absent" },
        "newValue": { "status": "present", "studentId": "…", "registrationNumber": "1002", "classDate": "2026-10-11" },
        "ip": "::1"
      }
    ]
  }
  ```

---

## Cómo probar

### Datos de prueba

`pnpm db:seed` carga los siguientes datos en la instalación configurada (solo desarrollo):

| Qué            | Datos                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Admin           | `admin@core.com` / `demo!`. La contraseña se cambia con la variable `SEED_ADMIN_PASSWORD` |
| Módulo activo  | "Módulo de prueba"                                                                                  |
| Estudiantes     | `1001` Juan Pérez (`juan@gmail.com`) y `1002` María López (`maria@gmail.com`)             |
| Fechas de clase | Hace 2 días, **hoy** y dentro de 2 días, de 18:00 a 21:00                                    |

Las fechas se calculan al ejecutar el seeder usando `INSTITUTION_TIMEZONE`. Para reiniciar el demo usa otra base descartable y vuelve a migrarla; el comando de deshacer el demo está deshabilitado para evitar borrar información añadida después.

### Pruebas automáticas de la instalación

```bash
pnpm test:instance
pnpm lint
pnpm build
```

Las pruebas de instalación levantan la aplicación Nest con modelos simulados y comprueban login, permisos, validación de sesiones, rechazo de tokens de otra instalación y generación del SQL de las migraciones. **No sustituyen una prueba de migraciones con PostgreSQL real.** No leen ni modifican Supabase.

### Con Postman

1. En Postman, pulsa **Import** y elige `docs/postman/attendance-core.postman_collection.json`.
2. Las requests guardan solas el token y los ids en variables de la colección, así que se ejecutan en orden:

| Carpeta                              | Requests                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **1. Auth**                    | *Login admin* guarda `adminToken`. *Login estudiante* guarda `studentToken`                    |
| **2. Módulos**                | *Crear borrador* guarda `moduleId`. Luego importar estudiantes y fechas, vista previa y activar    |
| **3. Asistencia (estudiante)** | Clase de hoy, marcar asistencia, mi historial                                                          |
| **4. Administración**         | *Vista general* guarda un `studentId` y un `classSessionId` para probar *Modificar asistencia* |

**Importar Excel en Postman.** En **Body** elige **form-data**, pon la clave `file`, cambia su tipo de *Text* a **File** y selecciona el archivo. La colección apunta a la carpeta `docs/excel-ejemplos/` con una ruta absoluta; si en tu equipo está en otra ubicación, vuelve a seleccionar el archivo.

### Con curl

```bash
curl -X POST http://localhost:5000/core/api/v1/auth/student/login \
  -H 'Content-Type: application/json' -d '{"identifier":"1001"}'
```

### Flujo completo sugerido

1. **Admin:** login y `GET /modules/active`.
2. **Estudiante:** login con `1001` y `GET /attendance/today`, que debe dar `canMark: true`. Luego `POST /attendance/mark`; si lo repites, recibes `409`.
3. **Estudiante:** `GET /attendance/me`. La fecha pasada aparece como `absent`, la de hoy como `present` y la futura como `upcoming`.
4. **Admin:** `GET /attendances` para ver los totales. Luego `PUT /attendances` para pasar a Presente a María en la fecha pasada.
5. **Admin:** `GET /activity-logs` para ver la marca, la corrección con su valor anterior y nuevo, y los logins.
6. **Admin:** crear un módulo nuevo, importar los Excel de ejemplo y activarlo. El token anterior del estudiante deja de funcionar (`401`) y ahora puede entrar con `carlos.mamani@gmail.com`.

---

## Formato de los archivos Excel

- Archivos `.xlsx`. Se lee la primera hoja y la fila 1 son los encabezados.
- Los encabezados se reconocen sin importar mayúsculas ni tildes, y las filas vacías se ignoran.
- Hay ejemplos en `docs/excel-ejemplos/`, incluidos dos con errores para ver las validaciones.

**Estudiantes**

| Número de registro | Nombre completo | Correo electrónico |
|---|---|---|
| 1001 | Juan Pérez | juan@gmail.com |
| 1002 | María López | maria@gmail.com |

Se valida que los tres campos estén completos, que el correo sea válido y que no haya números de registro ni correos repetidos.

**Fechas de clase**

| Fecha | Hora inicio | Hora fin |
|---|---|---|
| 05/10/2026 | 18:00 | 21:00 |
| 07/10/2026 | 18:00 | 21:00 |

- La fecha va en formato `dd/mm/aaaa`, como texto o como celda con formato de fecha. Las horas van en formato `HH:mm`, como texto o como celda con formato de hora.
- Se valida que la fecha exista (por ejemplo, rechaza `31/02/2026`), que no se repita y que la hora de fin sea posterior a la de inicio.
- Se aceptan fechas pasadas, por si el módulo se carga cuando ya empezó.

---

## Base de datos, migraciones y seeders

El proyecto usa **Sequelize CLI** con soporte para replicación de lectura y escritura. La configuración está en `.sequelizerc` y `src/database/sequelize-cli/`.

```bash
pnpm db:migrate             # Ejecuta las migraciones pendientes
pnpm db:migrate:status      # Estado de las migraciones
pnpm db:migrate:undo        # Revierte la última migración
pnpm db:migrate:undo:all    # Revierte todas las migraciones
pnpm db:seed                # Carga los datos de prueba
pnpm instance:bootstrap     # Crea el primer owner de una instalación de cliente

# Crear una migración o un seeder nuevo
pnpm sequelize-cli migration:generate --name nombre_de_la_migracion
pnpm sequelize-cli seed:generate --name nombre_del_seeder
```

### Tablas

| Tabla              | Contenido                                                         |
| ------------------ | ----------------------------------------------------------------- |
| `users`          | Administradores                                                   |
| `modules`        | Módulos académicos (`draft`, `active`, `archived`)        |
| `students`       | Estudiantes de cada módulo                                       |
| `class_sessions` | Fechas de clase de cada módulo                                   |
| `attendances`    | Asistencias registradas                                           |
| `activity_logs`  | Historial de acciones. Solo se insertan filas, nunca se modifican |

Las reglas de negocio también están protegidas en la base:

| Regla                                            | Restricción                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| Un solo módulo activo por institución (RN-01)  | Índice único parcial `modules (status) WHERE status = 'active'` |
| Número de registro único en el módulo (RN-02) | `UNIQUE (module_id, registration_number)`                            |
| Correo único en el módulo                      | `UNIQUE (module_id, lower(email))`                                   |
| Una marca por estudiante y fecha (RN-03)         | `UNIQUE (student_id, class_session_id)`                              |
| Una fecha de clase por día                      | `UNIQUE (module_id, class_date)`                                     |
| No se borra información histórica (RN-08)      | Claves foráneas con `ON DELETE RESTRICT`                            |

---

## Estructura del proyecto

```text
src/
├── common/                         # Utilidades compartidas
│   ├── dates/                      # Fecha de hoy según la zona horaria
│   ├── dto/                        # Transformaciones de query
│   └── excel/                      # Lectura y validación de archivos Excel
├── config/                         # Configuración global y variables de entorno
├── database/                       # Configuración de Sequelize y CLI
│   └── sequelize-cli/              # Migraciones, seeders y config del CLI
├── institution/                    # Nombre y zona horaria por instalación
├── health/                         # Comprobación de conexión a la base
├── modules/                        # Módulos del negocio
│   ├── auth/                       # Login, JWT, guard global y decoradores
│   ├── users/                      # Administradores
│   ├── academic-modules/           # Módulos académicos (tabla `modules`)
│   ├── students/                   # Estudiantes e importación
│   ├── class-sessions/             # Fechas de clase e importación
│   ├── attendances/                # Asistencia del estudiante y del admin
│   └── activity-logs/              # Registro y consulta de actividades
├── app.module.ts
└── main.ts
docs/
├── excel-ejemplos/                 # Archivos Excel de ejemplo
└── postman/                        # Colección de Postman
```

Cada módulo de negocio sigue esta estructura:

```text
<nombre-modulo>/
├── <nombre>.controller.ts          # Endpoints HTTP
├── <nombre>.module.ts              # Módulo de Nest
├── dto/                            # Validación de body y query
└── repo/
    ├── <nombre>.model.ts           # Modelo de Sequelize
    └── <nombre>.service.ts         # Lógica y consultas
```

### Decoradores de autenticación

```ts
@Public()                 // Ruta pública
@AllowOnly('admin')       // Restringe la ruta o el controller a un rol
@CurrentUser() user       // Datos del token: { type, sub, role o moduleId }
```

## Contrato para el futuro despliegue

1. Crear PostgreSQL y una base vacía por cliente (fuera de este repositorio).
2. Proporcionar las variables del backend, incluida la identidad de la institución y un `JWT_SECRET` propio.
3. Ejecutar `pnpm db:migrate` y `pnpm instance:bootstrap` una vez; arrancar con `pnpm start:prod` después de compilar.
4. Servir el frontend y enviar `/core/api/v1` al backend mediante el proxy del servidor web. También se admite una API externa configurada en el frontend.
5. Comprobar `GET /core/api/v1/health`.

El nombre del dominio identifica el despliegue desde la plataforma; Attendance no lo interpreta. No se han creado aquí instancias, imágenes ni la plataforma de administración. Bootstrap y Sequelize CLI necesitan los archivos `scripts/` y `src/database/sequelize-cli/` junto con sus dependencias en la fase de inicialización; `dist/` por sí solo no los incluye.
