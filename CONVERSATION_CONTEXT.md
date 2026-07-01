# CUMIS Conecta - Contexto de la Conversación y Desarrollo

Este documento contiene todo el contexto, requerimientos e hitos de desarrollo acordados durante esta conversación para que otros desarrolladores puedan continuar trabajando de forma inmediata con este repositorio.

---

## 1. Visión General del Proyecto
**CUMIS Conecta** es una plataforma cerrada (closed-loop marketplace) que conecta a centros de salud (hospitales), misioneros de campo, distribuidores/proveedores de insumos médicos y donantes internacionales para agilizar el abastecimiento de suministros sanitarios en Venezuela.

---

## 2. Requerimientos Implementados

### Hito 1: Registro de Perfiles de Hospitales (KYC)
- Los hospitales pueden registrar su perfil desde el portal web ingresando:
  - Nombre del hospital y dirección física.
  - Nombre y apellido del encargado, correo electrónico y número de teléfono.
  - Bandera `is_whatsapp` que indica si el número es contacto directo de WhatsApp.
  - Capture de foto de la fachada y número de RIF (ambos opcionales).
- El estado inicial de registro es `pending`. Los administradores revisan y aprueban los perfiles.
- **Seguridad**: Los hospitales no verificados por el administrador tienen bloqueada la creación de misiones (tanto vía Web como vía WhatsApp).

### Hito 2: Misioneros Generales (Renombrado de Estudiantes)
- El rol anterior de "Estudiantes" fue migrado a **Misioneros**.
- Al registrarse, se definen dos tipos de misioneros:
  - **Estudiante**: Requiere ingresar obligatoriamente la universidad de procedencia.
  - **Sociedad Civil**: Requiere sus datos personales estándar.
- Las tablas en base de datos (`students` ➔ `missionaries`), rutas de API, consolas de administración y diálogos en WhatsApp fueron actualizados a la terminología de **Misionero**.

### Hito 3: Donantes Anónimos y Aislamiento Seguro de Captures
- Los donantes pueden marcar la casilla "Donar de forma anónima".
- Si se marca, el nombre real del donante se enmascara públicamente como `"Donante Anónimo"` en todas las rutas de API.
- **Aislamiento de Seguridad**: Las imágenes de captures de transferencias (`donor_transfer_photo`, `missionary_receipt_photo`) están protegidas en el backend. Son removidas de las respuestas JSON a menos que el usuario autenticado sea el Administrador (`manu2026`) o el operador (misionero o proveedor) asignado a esa misión en particular.

### Hito 4: Verificación Humana CAPTCHA
- Todos los formularios de registro de la plataforma (Hospitales, Misioneros y Proveedores) incluyen un CAPTCHA matemático dinámico (por ejemplo, `¿Cuánto es 4 + 7?`) autogenerado sin librerías externas que previene registros automatizados de bots.

### Hito 5: Priorización de Misiones por Calificación
- Al listar las misiones pendientes, el sistema ordena de mayor a menor según la calificación de estrellas del hospital solicitante.
- Las misiones con fondeo superior a **$100.00** requieren que el operador que las asuma tenga un promedio mínimo de **4.0 estrellas** de valoración.

---

## 3. Arquitectura de Código (Modular y Desacoplada)

El código monolítico inicial de `server.js` y `public/js/app.js` fue dividido en módulos con responsabilidades únicas:

### Backend Structure
- [database.js](file:///Users/manu/Documents/DEV/Wavelabs/redinsumos-vzla/src/db/database.js): Definición del esquema SQLite/MongoDB y métodos abstractos de base de datos.
- [auth.js](file:///Users/manu/Documents/DEV/Wavelabs/redinsumos-vzla/src/middleware/auth.js): Middleware de validación de tokens y roles de usuario.
- [routes.js](file:///Users/manu/Documents/DEV/Wavelabs/redinsumos-vzla/src/routes/routes.js): Agrupador de todas las rutas REST y webhooks de control omnicanal.
- [server.js](file:///Users/manu/Documents/DEV/Wavelabs/redinsumos-vzla/server.js): Lanzador minimalista del servidor Express.

### Frontend Structure
- [state.js](file:///Users/manu/Documents/DEV/Wavelabs/redinsumos-vzla/public/js/state.js): Almacén reactivo de estado de la aplicación.
- [api.js](file:///Users/manu/Documents/DEV/Wavelabs/redinsumos-vzla/public/js/api.js): Cliente fetch modular para peticiones de servidor.
- [ui.js](file:///Users/manu/Documents/DEV/Wavelabs/redinsumos-vzla/public/js/ui.js): Notificaciones toast, CAPTCHAs dinámicos e interruptores de navegación.
- [views.js](file:///Users/manu/Documents/DEV/Wavelabs/redinsumos-vzla/public/js/views.js): Compilador dinámico de vistas y paneles de control.
- [app.js](file:///Users/manu/Documents/DEV/Wavelabs/redinsumos-vzla/public/js/app.js): Orquestador de eventos del DOM y bindings de triggers a `window`.

---

## 4. Credenciales y Bases de Datos
- **Passcode Administrador**: `manu2026`
- **Tipos de Bases de Datos**: JSON local (por defecto), SQLite3 (`data/database.sqlite`) o MongoDB local. Configurable en el archivo `.env` mediante la variable `DB_TYPE`.
