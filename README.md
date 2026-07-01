# CUMIS Conecta 🩺

> Plataforma modular de alta velocidad e impacto humanitario para Mérida y Venezuela.

**CUMIS Conecta** es una plataforma cerrada (closed-loop marketplace) que vincula de manera directa a centros de salud (hospitales), misioneros logísticos de campo (estudiantes de medicina y sociedad civil), proveedores locales de insumos médicos y donantes internacionales para agilizar el suministro de medicamentos y materiales quirúrgicos esenciales.

---

## 🚀 Características Clave

1. **Gestión de Misiones Humanitarias**: Los hospitales cargan carritos de insumos médicos de primera necesidad.
2. **Operadores KYC (Misioneros y Proveedores)**:
   - **Misioneros**: Clasificados en *Estudiantes* (afiliación universitaria requerida) o *Sociedad Civil*.
   - **Proveedores**: Mayoristas comerciales que pueden reclamar misiones como **Donación Directa** (evitando la fase de recaudación).
3. **Donaciones Seguras y Anónimas**:
   - Soporte para marcar donaciones como anónimas (oculta el nombre en listados públicos).
   - **Aislamiento Seguro de Comprobantes**: Las capturas de pantalla de transferencias y billeteras digitales solo son visibles para el Administrador de auditoría o los operadores directamente vinculados a esa misión.
4. **Seguridad Anti-Bots**: CAPTCHA matemático dinámico en todos los registros para garantizar operaciones auténticas y humanas.
5. **Priorización Inteligente**: Listados de misiones ordenados por reputación (promedio de valoración de estrellas) de los hospitales solicitantes.

---

## 🗺️ Estructura del Repositorio

La solución sigue un diseño limpio y modular bajo las guías del skill **Ponytail**:

```text
├── CONVERSATION_CONTEXT.md          # Bitácora e historial de la conversación
├── README.md                       # Documentación principal del proyecto
├── server.js                        # Lanzador minimalista del servidor Express
├── package.json                     # Definición de dependencias
├── docs/                            # Archivos de diagramas en Mermaid
│   ├── uml.mermaid                  # Diagrama de Clases
│   ├── sequence.mermaid             # Diagrama de Secuencia E2E
│   └── architecture.mermaid         # Diagrama de Arquitectura
├── data/                            # Almacenamiento local
│   ├── database.sqlite              # Base de datos SQLite local
│   └── conversation_context.json    # Copia estructurada del contexto
├── public/                          # Archivos estáticos del frontend
│   ├── index.html                   # HTML del portal único
│   ├── uploads/                     # Carpeta de carga de captures (Multer)
│   └── js/                          # Módulos del Frontend (ES Modules)
│       ├── app.js                   # Orquestador y bindings globales a window
│       ├── state.js                 # Estado central reactivo
│       ├── api.js                   # Cliente HTTP REST
│       ├── ui.js                    # Utilidades DOM, Toasts y CAPTCHAs
│       └── views.js                 # Render de dashboards y modales
├── scripts/                         # Scripts de validación
│   └── e2e-verify.js                # Suite de pruebas de integración E2E
└── src/                             # Lógica del Servidor
    ├── db/
    │   └── database.js              # Adaptador CRUD (JSON/SQLite/MongoDB)
    ├── middleware/
    │   └── auth.js                  # Manejo de roles y autenticación
    └── routes/
        └── routes.js                # Endpoints REST y Webhooks de WhatsApp
```

---

## 🛠️ Configuración e Instalación

### Requisitos Previos
- **Node.js** v18 o superior.
- (Opcional) **MongoDB** si se desea utilizar base de datos documental.

### 1. Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto:
```env
PORT=3000
DB_TYPE=sqlite                     # Opciones: 'json', 'sqlite', 'mongodb'
MONGODB_URI=mongodb://localhost:27017/cumis_conecta  # Requerido si DB_TYPE = 'mongodb'
ADMIN_PASSCODE=manu2026             # Clave para ingresar a la consola de administración
```

### 2. Instalación de Dependencias
```bash
npm install
```

### 3. Iniciar el Servidor
```bash
npm start
```
El servidor se levantará en [http://localhost:3000](http://localhost:3000).

---

## 🧪 Pruebas de Integración E2E

Para ejecutar la suite automatizada que valida todos los flujos de creación, fondeo, KYC y validación de entregas:
```bash
node scripts/e2e-verify.js
```

---

## 📊 Diagramas de Sistema

### 1. Diagrama de Arquitectura Modular
```mermaid
graph TD
    %% Frontend Clients Layer
    subgraph Cliente [Frontend Web Client]
        PublicView[public/index.html]
        AppEntry[js/app.js - Orchestrator Entrypoint]
        State[js/state.js - Reactive State & Configs]
        APIClient[js/api.js - fetch REST Methods]
        UI[js/ui.js - Toasts, CAPTCHAs, navigation]
        ViewsCompiler[js/views.js - Dashboards & Modals UI renders]

        PublicView --> AppEntry
        AppEntry --> State
        AppEntry --> APIClient
        AppEntry --> UI
        AppEntry --> ViewsCompiler
    end

    %% Omnichannel Simulation
    subgraph Omnichannel [Omnichannel Clients]
        ChatbotSim[WhatsApp / Instagram Simulator console]
        ChatbotSim -- "POST /api/webhooks/agent" --> Router
    end

    %% Backend Router & APIs
    subgraph Servidor [Express API Server]
        ServerMain[server.js - Launcher]
        Router[src/routes/routes.js - Express Router]
        AuthMiddleware[src/middleware/auth.js - Token validator]
        Multer[Multer Upload Engine]

        APIClient -- "fetch /api/*" --> ServerMain
        ServerMain --> Router
        Router --> AuthMiddleware
        Router --> Multer
    end

    %% Database Abstraction layer
    subgraph Data [Data Persistence Adapter]
        DBWrapper[src/db/database.js - CRUD Abstract wrapper]
        DB_JSON[Local JSON files - data/*.json]
        DB_SQLite[SQLite3 Engine - data/database.sqlite]
        DB_Mongo[MongoDB Client - local/remote URI]

        Router --> DBWrapper
        DBWrapper --> DB_JSON
        DBWrapper --> DB_SQLite
        DBWrapper --> DB_Mongo
    end

    %% Data Directories
    Multer -- "saves captures to" --> Uploads[public/uploads/]
```

### 2. Modelo de Clases UML (Datos)
```mermaid
classDiagram
    class Hospital {
        +id: TEXT [PK]
        +name: TEXT
        +location: TEXT
        +phone: TEXT
        +manager_name: TEXT
        +manager_email: TEXT
        +is_whatsapp: INTEGER
        +rif: TEXT
        +image_path: TEXT
        +status: TEXT
        +createdAt: TEXT
        +updatedAt: TEXT
    }
    class Missionary {
        +id: TEXT [PK]
        +name: TEXT
        +phone: TEXT
        +email: TEXT
        +kyc_type: TEXT
        +kyc_details: TEXT
        +password: TEXT
        +status: TEXT
        +type: TEXT
        +university: TEXT
        +createdAt: TEXT
        +updatedAt: TEXT
    }
    class Provider {
        +id: TEXT [PK]
        +name: TEXT
        +phone: TEXT
        +email: TEXT
        +kyc_type: TEXT
        +kyc_details: TEXT
        +password: TEXT
        +status: TEXT
        +createdAt: TEXT
        +updatedAt: TEXT
    }
    class Donor {
        +id: TEXT [PK]
        +name: TEXT
        +email: TEXT
        +phone: TEXT
        +createdAt: TEXT
        +updatedAt: TEXT
    }
    class Mission {
        +id: TEXT [PK]
        +hospital_id: TEXT [FK]
        +hospital_name: TEXT
        +missionary_id: TEXT [FK]
        +missionary_name: TEXT
        +provider_id: TEXT [FK]
        +provider_name: TEXT
        +donor_id: TEXT [FK]
        +donor_name: TEXT
        +is_anonymous: INTEGER
        +total_amount: REAL
        +status: TEXT
        +createdAt: TEXT
        +updatedAt: TEXT
    }
    class MissionItem {
        +id: TEXT [PK]
        +mission_id: TEXT [FK]
        +product_name: TEXT
        +quantity: INTEGER
        +price: REAL
        +createdAt: TEXT
        +updatedAt: TEXT
    }
    class Evidence {
        +id: TEXT [PK]
        +mission_id: TEXT [FK]
        +donor_transfer_path: TEXT
        +missionary_receipt_path: TEXT
        +invoice_photo_path: TEXT
        +delivery_photo_path: TEXT
        +uploaded_at: TEXT
        +createdAt: TEXT
        +updatedAt: TEXT
    }
    class Chat {
        +id: TEXT [PK]
        +mission_id: TEXT [FK]
        +sender_role: TEXT
        +sender_name: TEXT
        +message: TEXT
        +timestamp: TEXT
        +createdAt: TEXT
        +updatedAt: TEXT
    }
    class Rating {
        +id: TEXT [PK]
        +mission_id: TEXT [FK]
        +reviewer_id: TEXT
        +reviewer_role: TEXT
        +reviewee_id: TEXT
        +reviewee_role: TEXT
        +stars: INTEGER
        +comment: TEXT
        +createdAt: TEXT
        +updatedAt: TEXT
    }

    Hospital "1" -- "0..*" Mission : requests
    Missionary "1" -- "0..*" Mission : claims
    Provider "1" -- "0..*" Mission : claims_dispatch
    Donor "1" -- "0..*" Mission : funds
    Mission "1" -- "1..*" MissionItem : contains
    Mission "1" -- "0..1" Evidence : validates
    Mission "1" -- "0..*" Chat : coordinates
    Mission "1" -- "0..*" Rating : reviews
```

### 3. Diagrama de Secuencias E2E (Mensajería y Logística)
```mermaid
sequenceDiagram
    autonumber
    actor Hospital as Hospital (WhatsApp)
    actor Bot as WhatsApp Bot Webhook
    actor Portal as Web Portal API
    actor Missionary as Misionero/Proveedor
    actor Donor as Donante
    actor Admin as Administrador

    %% Hospital Registration Flow
    Hospital->>Portal: Registrar perfil de Hospital (manager email, phone, RIF, fachada)
    Note over Portal: Estado del Hospital = 'pending'
    Admin->>Portal: Iniciar sesión y aprobar Hospital KYC
    Note over Portal: Estado del Hospital = 'verified'

    %% Mission Creation
    Hospital->>Bot: WhatsApp command: "Crear mision Vargas con 50 gasas, 20 alcohol"
    Bot->>Portal: POST /api/webhooks/agent (verificar phone y estado 'verified')
    Portal-->>Bot: Misión registrada con ID (ej: MIS-101, estado 'created')
    Bot-->>Hospital: WhatsApp: "🩺 Misión creada con éxito: MIS-101. Misioneros notificados."

    %% Claim Mission
    Missionary->>Portal: Tomar misión (MIS-101) con billetera KYC (Zelle/Meru)
    Portal-->>Missionary: Misión tomada con éxito (estado 'claimed')

    %% Donor Funding
    Donor->>Bot: WhatsApp: "Donar a la mision MIS-101"
    Bot->>Portal: Obtener billetera KYC del operador asignado
    Bot-->>Donor: WhatsApp: "💰 Envíe $230 a [MERU] @operador. Escriba 'confirmar fondos MIS-101' al terminar."
    Donor->>Portal: (Opcional Web) Subir comprobante y activar 'is_anonymous'
    Note over Portal: Estado de Misión = 'funding_sent'
    
    %% Confirm Receipt
    Missionary->>Bot: WhatsApp: "Confirmar fondos MIS-101" (o vía Web Portal subiendo capture de billetera)
    Portal->>Portal: Validar receptor
    Note over Portal: Estado de Misión = 'funded'
    Bot-->>Missionary: WhatsApp: "✅ Fondos confirmados y disponibles. Proceda a despachar."

    %% Invoice Upload & Dispatch
    Missionary->>Portal: Subir factura comercial (Capture)
    Note over Portal: Estado de Misión = 'purchased'

    %% Delivery Verification
    Hospital->>Bot: WhatsApp: "Confirmar entrega MIS-101" (o vía Web Portal subiendo foto de entrega firmada)
    Note over Portal: Estado de Misión = 'completed'
    Bot-->>Hospital: WhatsApp: "🏥 Entrega confirmada. ¡Muchas gracias!"

    %% Rating
    Donor->>Bot: WhatsApp: "Valorar MIS-101 con 5 estrellas: Excelente despacho"
    Bot->>Portal: Registrar valoración para Misionero/Proveedor
```
