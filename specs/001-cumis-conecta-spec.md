# Feature Specification: CUMIS Conecta (Manual Pre-paid Supply Chain)

**Feature Branch**: `main`
**Created**: 2026-06-27
**Status**: Approved

## Overview

"CUMIS Conecta" is a rapid-deployment marketplace platform connecting local medical suppliers in Venezuela with field logistics operators and a central administrator. The project focuses on handling manual pre-paid workflows via Zelle to avoid gateway locks and ensure immediate supplier payouts, backed by a transparency dashboard for external donors.

---

## User Scenarios

### User Story 1: Operator Registration & Administrative Verification
An operator must register with full credentials (Name, Phone, Cédula ID, Zelle email) before they can pick up missions. The Administrator must manually verify the operator to secure the wallet flow.

**Acceptance Criteria:**
- Given a guest operator on the platform, when they fill out the registration form, then their account is created in a `pending` verification state.
- Given a pending operator, they cannot accept missions or request funds until the Administrator transitions their status to `verified`.
- Given the Admin Panel, the Admin can see all pending operators and click a `Verify Operator` button.

---

### User Story 2: Requesting Pre-paid Funds (Zelle Flow)
A verified operator selects a mission of medical supplies to buy, and requests the Zelle advance. The order changes to `[Esperando Fondos]`.

**Acceptance Criteria:**
- Given a verified operator, when they select a mission and click `Solicitar Fondos`, then the order status becomes `pending_funds` and a disbursement record is created in `requested` state.
- Given the Admin console, the Admin sees the active request.
- Given the order details, both the Admin and the Operator can chat in real-time or via structured message logs to coordinate.

---

### User Story 3: Dispatching Funds & Uploading Bank Capture
The Admin pays the operator externally via Zelle, then marks the transaction complete on the platform, uploading a proof screenshot.

**Acceptance Criteria:**
- Given a pending disbursement, when the Admin clicks `Marcar como Fondos Enviados` (optionally uploading a payment capture), then the disbursement status updates to `sent` and the order status becomes `funds_sent`.
- The Operator receives a system message in the order chat notifying them that funds are sent.

---

### User Story 4: Uploading Invoices & Delivery Evidences
The Operator buys the items, uploads a photo of the merchant invoice, delivers the supplies, and uploads a photo of the delivery at the medical center.

**Acceptance Criteria:**
- Given an order with `funds_sent`, when the Operator uploads the commercial invoice image, the order status updates to `received`.
- Given an order with `received`, when the Operator uploads the final delivery photo, the order status updates to `completed`.
- The transparency dashboard immediately updates to reflect the legalised funds (backed by the invoice) and shows the delivery photos in the impact gallery.

---

### User Story 5: Public Donor Transparency Dashboard
Donors can view financial flows (Total Donations, Funds in Transit, Legalised Expenses) and browse the visual impact gallery.

**Acceptance Criteria:**
- **Ingresos por Donación (Donation Income)**: Sum of all manually logged external donations.
- **Fondos en Tránsito (Funds in Transit)**: Total Zelle advances sent to operators for which an invoice has not yet been uploaded.
- **Gastos Legalizados (Legalised Expenses)**: Total cost of orders completed/received with uploaded invoices.
- **Galería de Impacto**: Image grid displaying all successfully uploaded delivery photos.

---

## Catalog Restrictions (The 29 Allowed Items)
The platform strictly limits registered inventory and order items to these 29 products:
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
29. Insumos médicos generales (fallback)
