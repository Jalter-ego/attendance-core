# Attendance Core

Backend del sistema web de registro y control de asistencia, desarrollado con [NestJS](https://nestjs.com/) y [Sequelize](https://sequelize.org/) sobre PostgreSQL.

Es **multi-tenant** (SaaS): cada institución es un *tenant* con sus propios administradores, módulos, estudiantes y asistencias. En cada institución hay un solo **módulo académico activo** a la vez; al activar uno nuevo, el anterior se archiva sin borrar sus datos.

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
- **Gestor de paquetes:** `pnpm`. Viene con Node a través de Corepack: `corepack enable`
- **Base de datos:** PostgreSQL 13 o superior

---

## Instalación y configuración

1. **Instalar dependencias:**
   ```bash
   pnpm install
   ```

2. **Variables de entorno.** Copia el archivo de ejemplo y ajusta los valores:
   ```bash
   cp .env.example .env
   ```

   | Variable | Descripción |
   |---|---|
   | `PORT` | Puerto del servidor (por defecto `5000`) |
   | `CORS_ORIGIN` | Origen permitido para el frontend (`*` en desarrollo) |
   | `DB_SSL` | `false` para un Postgres local. Si se omite, la conexión usa SSL |
   | `DB_READ_*` / `DB_WRITE_*` | Conexión de lectura y de escritura. Con un solo Postgres, ambos llevan los mismos valores |
   | `JWT_SECRET` | Clave para firmar los tokens. Usa un valor largo y aleatorio |
   | `JWT_EXPIRES_IN` | Duración de la sesión, por ejemplo `8h` |

   Para generar un `JWT_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

3. **Crear la base de datos** en Postgres, por ejemplo `attendance_db`, con pgAdmin o con:
   ```sql
   CREATE DATABASE attendance_db;
   ```

4. **Crear las tablas y cargar los datos de prueba:**
   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

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

> Si cambias `tsconfig.json`, reinicia `start:dev`: el modo *watch* no relee ese archivo.

---

## Cómo funciona

### Roles

| Rol | Cómo ingresa | Qué puede hacer |
|---|---|---|
| **Administrador** | Institución + correo + contraseña | Crea e importa módulos, consulta y corrige asistencias, revisa el historial de actividades |
| **Estudiante** | Institución + correo **o** número de registro | Marca su asistencia el día de clase y consulta su historial |

Al iniciar sesión se recibe un **JWT** que se envía en cada petición:
```
Authorization: Bearer <accessToken>
```
El token indica quién es el usuario, su institución (`tenantId`) y, en el caso del estudiante, su módulo. Todas las consultas se filtran por esa institución, así que un tenant nunca ve los datos de otro.

Todas las rutas exigen token, salvo los logins. Cada ruta además está restringida a un rol: si un estudiante llama a una ruta de admin, o al revés, recibe `403`.

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

| Estado | Significado |
|---|---|
| `present` | Presente |
| `absent` | Falta: la fecha pasó sin marca, o el admin la registró así |
| `pending` | La clase es hoy y el estudiante todavía puede marcar |
| `upcoming` | La fecha aún no llega |

- El admin puede cambiar Presente/Falta en **cualquier fecha** del módulo activo, incluso en fechas pasadas.
- `markedAt` es la hora real en que marcó el estudiante. Una corrección del admin no la inventa.

### Historial de actividades

Se registran en `activity_logs` el usuario, la acción, la fecha y hora, la IP, el registro afectado y, en las correcciones, el valor anterior y el nuevo:

| Acción | Cuándo |
|---|---|
| `LOGIN` / `LOGOUT` | Ingreso y salida de admins y estudiantes |
| `STUDENTS_IMPORTED` / `SESSIONS_IMPORTED` | Importación de un Excel |
| `MODULE_ACTIVATED` | Activación de un módulo |
| `ATTENDANCE_MARKED` | El estudiante marcó su asistencia |
| `ATTENDANCE_UPDATED` | El admin corrigió una asistencia |

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

| Código | Significado |
|---|---|
| `400` | Datos mal enviados (validación) |
| `401` | Sin sesión, sesión vencida o credenciales incorrectas |
| `403` | El rol no tiene permiso para esa ruta |
| `404` | El recurso no existe o no pertenece al módulo activo |
| `409` | Conflicto, por ejemplo una asistencia ya marcada o un módulo ya activo |
| `422` | La operación no se puede hacer, por ejemplo un Excel con errores o un día sin clase |

---

### Autenticación

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/auth/admin/login` | Público | Login del administrador |
| POST | `/auth/student/login` | Público | Login del estudiante |
| GET | `/auth/me` | Admin y estudiante | Datos del usuario de la sesión |
| POST | `/auth/logout` | Admin y estudiante | Registra la salida. Responde `204` |

**POST `/auth/admin/login`**
```json
{ "tenant": "demo", "email": "admin@demo.com", "password": "Admin123!" }
```
Respuesta `200`:
```json
{
  "accessToken": "eyJhbGciOi...",
  "user": { "id": "…", "name": "Administrador Demo", "email": "admin@demo.com", "role": "owner" },
  "tenant": { "id": "…", "name": "Institución Demo", "slug": "demo" }
}
```

**POST `/auth/student/login`**. `identifier` acepta el correo o el número de registro:
```json
{ "tenant": "demo", "identifier": "1001" }
```
Respuesta `200`:
```json
{
  "accessToken": "eyJhbGciOi...",
  "student": { "id": "…", "registrationNumber": "1001", "fullName": "Juan Pérez", "email": "juan@gmail.com" },
  "module": { "id": "…", "name": "Módulo de prueba" },
  "tenant": { "id": "…", "name": "Institución Demo", "slug": "demo" }
}
```
Si el estudiante no está en el módulo activo, responde `401` con "Los datos no corresponden a un estudiante del módulo activo".

> El JWT no se puede invalidar en el servidor. Al cerrar sesión, el frontend debe borrar el token.

---

### Módulos académicos (admin)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/modules` | Crea un módulo en borrador |
| GET | `/modules` | Lista el borrador y el módulo activo, con sus cantidades |
| GET | `/modules/active` | Módulo activo |
| GET | `/modules/:id` | Vista previa con estudiantes y fechas |
| POST | `/modules/:moduleId/students/import` | Importa estudiantes desde Excel |
| POST | `/modules/:moduleId/sessions/import` | Importa fechas de clase desde Excel |
| POST | `/modules/:id/activate` | Activa el módulo y archiva el anterior |

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

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/attendance/today` | Si hoy hay clase y si ya marcó, para habilitar el botón |
| POST | `/attendance/mark` | Marca la asistencia de hoy |
| GET | `/attendance/me` | Historial con el estado de cada fecha y un resumen |

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

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/students?search=` | Estudiantes del módulo activo |
| GET | `/attendances?date=&studentId=` | Vista general de asistencias con totales |
| PUT | `/attendances` | Cambia Presente/Falta de un estudiante en una fecha |
| GET | `/activity-logs?studentId=&date=&limit=&offset=` | Historial de actividades del módulo activo |

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

`pnpm db:seed` crea la institución **`demo`** con:

| Qué | Datos |
|---|---|
| Admin | `admin@demo.com` / `Admin123!`. La contraseña se cambia con la variable `SEED_ADMIN_PASSWORD` |
| Módulo activo | "Módulo de prueba" |
| Estudiantes | `1001` Juan Pérez (`juan@gmail.com`) y `1002` María López (`maria@gmail.com`) |
| Fechas de clase | Hace 2 días, **hoy** y dentro de 2 días, de 18:00 a 21:00 |

Las fechas se calculan el día en que corres el seeder, así que siempre hay una clase hoy para probar la marca. Para volver al estado inicial:
```bash
pnpm db:seed:undo && pnpm db:seed
```

### Con Postman

1. En Postman, pulsa **Import** y elige `docs/postman/attendance-core.postman_collection.json`.
2. Las requests guardan solas el token y los ids en variables de la colección, así que se ejecutan en orden:

| Carpeta | Requests |
|---|---|
| **1. Auth** | *Login admin* guarda `adminToken`. *Login estudiante* guarda `studentToken` |
| **2. Módulos** | *Crear borrador* guarda `moduleId`. Luego importar estudiantes y fechas, vista previa y activar |
| **3. Asistencia (estudiante)** | Clase de hoy, marcar asistencia, mi historial |
| **4. Administración** | *Vista general* guarda un `studentId` y un `classSessionId` para probar *Modificar asistencia* |

**Importar Excel en Postman.** En **Body** elige **form-data**, pon la clave `file`, cambia su tipo de *Text* a **File** y selecciona el archivo. La colección apunta a la carpeta `docs/excel-ejemplos/` con una ruta absoluta; si en tu equipo está en otra ubicación, vuelve a seleccionar el archivo.

### Con curl

```bash
BASE=http://localhost:5000/core/api/v1

# Login del admin
TOKEN=$(curl -s -X POST $BASE/auth/admin/login -H "Content-Type: application/json" \
  -d '{"tenant":"demo","email":"admin@demo.com","password":"Admin123!"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")

# Crear un borrador e importar
MODULE=$(curl -s -X POST $BASE/modules -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Módulo 3"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).id")
curl -X POST $BASE/modules/$MODULE/students/import -H "Authorization: Bearer $TOKEN" -F "file=@docs/excel-ejemplos/estudiantes.xlsx"
curl -X POST $BASE/modules/$MODULE/sessions/import -H "Authorization: Bearer $TOKEN" -F "file=@docs/excel-ejemplos/fechas.xlsx"

# Activar
curl -X POST $BASE/modules/$MODULE/activate -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"confirm":true}'
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
pnpm db:seed:undo           # Borra los datos de prueba

# Crear una migración o un seeder nuevo
pnpm sequelize-cli migration:generate --name nombre_de_la_migracion
pnpm sequelize-cli seed:generate --name nombre_del_seeder
```

### Tablas

| Tabla | Contenido |
|---|---|
| `tenants` | Instituciones, con su `slug` y zona horaria |
| `users` | Administradores |
| `modules` | Módulos académicos (`draft`, `active`, `archived`) |
| `students` | Estudiantes de cada módulo |
| `class_sessions` | Fechas de clase de cada módulo |
| `attendances` | Asistencias registradas |
| `activity_logs` | Historial de acciones. Solo se insertan filas, nunca se modifican |

Las reglas de negocio también están protegidas en la base:

| Regla | Restricción |
|---|---|
| Un solo módulo activo por institución (RN-01) | Índice único parcial `modules (tenant_id) WHERE status = 'active'` |
| Número de registro único en el módulo (RN-02) | `UNIQUE (module_id, registration_number)` |
| Correo único en el módulo | `UNIQUE (module_id, lower(email))` |
| Una marca por estudiante y fecha (RN-03) | `UNIQUE (student_id, class_session_id)` |
| Una fecha de clase por día | `UNIQUE (module_id, class_date)` |
| No se borra información histórica (RN-08) | Claves foráneas con `ON DELETE RESTRICT` |

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
├── modules/                        # Módulos del negocio
│   ├── auth/                       # Login, JWT, guard global y decoradores
│   ├── tenants/                    # Instituciones
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
@Public()                 // Ruta sin token (solo los logins)
@AllowOnly('admin')       // Restringe la ruta o el controller a un rol
@CurrentUser() user       // Datos del token: { type, sub, tenantId, ... }
```
