# Documento de Requerimientos de Software (PRD) - Plataforma "CUMIS Conecta" (V2.1 - Flujo Efectivo Adelantado)

## 1. Visión General del Proyecto
El objetivo de este proyecto es desarrollar una plataforma web de despliegue rápido (Marketplace cerrado) que conecte a proveedores de insumos médicos locales en Venezuela con organizaciones, donantes internacionales y equipos de logística. La plataforma facilitará la compra directa de suministros críticos a precios de mayorista, mitigando la crisis humanitaria y optimizando la cadena de suministro para iniciativas como CUMIS (Campamento Universitario Multidisciplinario de Investigación y Servicio).

### Objetivos Clave:
* **Velocidad de Despliegue:** Estructura optimizada para desarrollo ágil en Antigravity.
* **Catálogo Restringido:** Catálogo limitado estrictamente a los 29 requerimientos de máxima prioridad especificados.
* **Flujo Financiero Sin Bloqueos:** El dinero no se retiene ni se bloquea a nivel de pasarela en la app. Los fondos llegan a una cuenta centralizada (Administrador) y se desembolsan por adelantado vía Zelle/Transferencia manual a los "Compradores de Logística" registrados.
* **Asincronía y Comunicación Integrada:** Canalización de solicitudes de dinero a través de chat o logs de estado directo en la orden para coordinar las transferencias manuales de divisas rápidamente.

---

## 2. Catálogo Oficial de Productos (Restricción del Sistema)
La plataforma **solo** permitirá el registro, visualización y venta de los siguientes 29 insumos médicos extraídos del requerimiento oficial:

1. Gasas estériles
2. Povidine
3. Suturas
4. Vendas
5. Alcohol
6. Guantes estériles y no estériles
7. Sondas
8. Anestésicos locales
9. Jeringas de 5, 10 y 20 ml
10. Solución ringer lactato
11. Solución 0,9%
12. Bisturí
13. Macrogoteros
14. Analgésicos
15. SRO (Suero de Rehidratación Oral)
16. Antibióticos EV (Endovenosos)
17. Adhesivo
18. Gel de eco
19. Venda de yeso
20. Guata
21. Vendas elásticas
22. Adhesivos
23. Compresas
24. Guantes de trabajo
25. Lentes
26. Tapabocas
27. Antihipertensivos
28. Pastillas potabilizadoras de agua

---

## 3. Roles de Usuario y Permisos

### A. Proveedor de Salud / Insumos (Local en Venezuela)
* Publicación de inventario mayorista basado **únicamente** en la lista oficial de 29 productos.
* Registro de precios referenciales y stock disponible para consulta.

### B. Comprador de Logística / Operador de Campo (Debe Registrarse Obligatoriamente)
* Registro obligatorio en la plataforma con Nombre, Teléfono, Cédula de Identidad, y Correo de Zelle Personal (donde recibirá el dinero para comprar).
* Vista de órdenes/carritos requeridos para el operativo de salud.
* Acceso a la función **"Solicitar Adelanto de Fondos Zelle"** vinculada a una orden específica.
* Acceso a un chat de coordinación directo con el Administrador de la cuenta bancaria.
* Capacidad de subir la foto de la factura del proveedor una vez hecha la compra y fotos de la entrega.

### C. Administrador Central (Dueño de la Cuenta / "Manu")
* Recepción de donaciones en la cuenta bancaria externa.
* Consola unificada para ver qué Comprador de Logística está en camino a hacer qué compra.
* Chat/Logs integrados por orden para recibir la confirmación de la tasa o monto exacto.
* Botón para marcar: `[Fondos Zelle Enviados Manualmente]` adjuntando opcionalmente el capture de la banca externa.

### D. Donante (Portal de Transparencia)
* Visualización del dashboard de rendición de cuentas pública.

---

## 4. Nuevo Flujo de Trabajo: Financiamiento Manual Adelantado

Para evitar que los proveedores retengan la mercancía por falta de pago inmediato, el proceso se reestructura sin pasarelas automáticas:

1.  **Planificación de la Compra:** El Comprador de Logística registrado entra a la app y selecciona o acepta una "Misión de Compra" (Ej: Ir a comprar 100 jeringas y 20 soluciones a un proveedor X por un total de $150).
2.  **Solicitud de Adelanto:** El operador le da clic a **"Solicitar Fondos para Compra"**. La orden entra en estado `[Esperando Fondos]`.
3.  **Coordinación por Chat:** 
    * El operador de logística abre el chat integrado de la orden en la plataforma y le confirma al administrador: *"Estoy saliendo al sitio, por favor envíame los $150 exactos a mi Zelle registrado"*.
    * El Administrador (Manu) revisa la solicitud en la app, abre su aplicación de Zelle de forma externa, ejecuta la transferencia al correo del operador, y presiona el botón `[Marcar como Fondos Enviados]` en la plataforma.
4.  **Compra y Recogida:** Con el dinero líquido en su cuenta, el operador de logística paga al proveedor inmediatamente al llegar, retira los insumos y **le toma foto a la Factura Comercial Física en caliente**.
5.  **Carga de Evidencias e Impacto:** El operador traslada el material al Centro de Acopio (Mérida) y sube la foto de la entrega final. La orden cambia a `[Completada con Éxito]`.

---

## 5. Dashboard de Transparencia Adaptado
A pesar de que el flujo de dinero es manual e interpersonal entre el Administrador y los Compradores de Logística, el Dashboard de Transparencia mostrará la información de forma fidedigna para los donantes:

*   **Ingresos por Donación:** Cargados manualmente o por API de recepción en la cuenta central de la organización.
*   **Fondos en Campo (Efectivo/Zelle en Tránsito):** Dinero que ha sido transferido a los Compradores de Logística pero que aún no cuenta con factura física subida al sistema.
*   **Gastos Legalizados (Insumos Adquiridos):** Dinero respaldado con las **Fotos de Facturas Reales** cargadas por el equipo de logística.
*   **Galería de Impacto:** Las fotos de la entrega física en la Facultad de Medicina asociadas al gasto legalizado.

---

## 6. Requerimientos Técnicos para Antigravity

### Modelo de Datos Ampliado
*   `LogisticsOperators`: Colección de usuarios autenticados para logística. Campos: `name`, `phone`, `zelle_email`, `status_verificado` (booleano).
*   `OrderChat`: Mensajes en tiempo real vinculados a `order_id` para que el operador y el administrador se comuniquen sin salir de la plataforma.
*   `Disbursements`: Registro de transferencias manuales: `order_id`, `amount`, `logistics_user_id`, `status` (`[Solicitado]`, `[Enviado]`).

### Componentes UI Críticos
*   **Módulo de Chat Contextual:** En la vista detallada de la orden, un componente simple de mensajería para acordar detalles o notificar fallas de internet en el establecimiento del proveedor.
*   **Perfil de Seguridad de Logística:** Un panel administrativo privado donde el dueño de la cuenta valida la identidad del operador de campo antes de transferirle miles de dólares.
