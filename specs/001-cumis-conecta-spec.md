# Feature Specification: CUMIS Conecta (Hospital & Student Omnichannel Agent Pivot)

**Feature Branch**: `main`
**Created**: 2026-06-29
**Status**: Approved

## Overview
CUMIS Conecta connects Venezuelan hospitals/health centers directly with students (verified field operators) and global donors. Hospitals request critical medical supplies (strictly from the 29 catalog items), students complete verification (KYC with Zelle or Meru wallets) to claim these missions, and international donors fund them directly. Communication is enabled via both the Web Portal and an omnichannel Chat Agent (simulating WhatsApp/Instagram).

---

## User Scenarios

### Scenario 1: Hospital Mission Request (Web & Chat Agent)
A hospital needs supplies (e.g. 50 solutions and 200 syringes) and registers a "Mission" on CUMIS Conecta.
- **Web Flow**: Hospital fills a form selecting supplies from the restricted catalog.
- **Agent Flow (WhatsApp/Instagram)**: Hospital messages the agent: *"Hola, quiero crear una misión para Hospital Vargas Mérida con 50 solución 0,9% y 100 jeringas."*
- **Acceptance Criteria**:
  - The system creates a new Mission record in state `created`.
  - Items requested are validated strictly against the 29 official humanitario items.

### Scenario 2: Student KYC & Claiming Missions
A student signs up to help and provides their wallet details (Zelle email or Meru wallet account).
- **KYC Requirement**: The student must enter wallet platform (`Zelle` or `Meru`) and their account identifier. The Admin must verify their profile (`verified`).
- **Claiming**: Once verified, the student browses missions in `created` state and clicks `Tomar Misión` (either on web or texting: *"Tomar misión <ID>"*).
- **Acceptance Criteria**:
  - Mission transitions to `claimed` status.
  - The student's Zelle/Meru information is linked to the mission.
  - Donors are notified.

### Scenario 3: Global Donor Funding
A donor from anywhere in the world sees that a student has claimed a mission and funds it.
- **Funding**: The donor views the student's KYC info (Zelle/Meru account), transfers the money externally, and marks the payment complete (Web or text: *"Donar a la misión <ID>"*).
- **Acceptance Criteria**:
  - Mission transitions immediately from `claimed` to `funded`.
  - The student receives a notification that funds are available.

### Scenario 4: Supply Legalisation & Delivery Verification
The student purchases the items, uploads the merchant invoice, delivers the supplies, and the hospital confirms receipt.
- **Purchase**: Student uploads the commercial invoice photo (Web or WhatsApp image upload). Status transitions to `purchased`.
- **Delivery**: The student delivers the supplies to the health center. The hospital reviews, takes a photo of the received boxes, and clicks "Confirmar Entrega" (Web or text: *"Confirmar entrega <ID>"*).
- **Acceptance Criteria**:
  - Mission transitions to `completed`.
  - Stats dashboard updates: donations total, funds in transit, and legalised expenses.
  - The delivery image is added to the public impact gallery.

---

## Chat Agent Command Schemas (WhatsApp / Instagram Webhook)
The omnichannel integration listens to incoming chats and performs database updates:
1. **Hospital Create**: *"crear mision para [Hospital] con [cantidad] [insumo], [cantidad] [insumo]"*
2. **Student Claim**: *"tomar mision [id]"*
3. **Donor Fund**: *"donar a la mision [id]"*
4. **Hospital Complete**: *"confirmar entrega [id]"*
