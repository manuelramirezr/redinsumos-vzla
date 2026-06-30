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

### Scenario 3: Global Donor Funding & Transfer Capture
A donor from anywhere in the world funds a mission.
- **Transfer Proof**: The donor views the student's KYC info (Zelle/Meru account), transfers the money externally, uploads a capture/screenshot of the transfer (Web or texts: *"Donar a la misión <ID>"*).
- **Acceptance Criteria**:
  - Mission transitions from `claimed` to `funding_sent`.
  - The student is notified that the donor claims to have sent the funds and uploaded a receipt.

### Scenario 4: Student Receipt Verification
The student checks their Meru or Zelle wallet and verifies the funds.
- **Verification**: The student uploads a screenshot of their incoming wallet transaction (Web or texts: *"Confirmar fondos <ID>"*).
- **Acceptance Criteria**:
  - Mission transitions from `funding_sent` to `funded` (funds available).
  - Student is cleared to purchase supplies.

### Scenario 5: Supply Legalisation & Delivery Verification
The student purchases the items, uploads the merchant invoice, delivers the supplies, and the hospital confirms receipt.
- **Purchase**: Student uploads the commercial invoice photo (Web or WhatsApp image upload). Status transitions to `purchased`.
- **Delivery**: The student delivers the supplies to the health center. The hospital reviews, takes a photo of the received boxes, and clicks "Confirmar Entrega" (Web or text: *"Confirmar entrega <ID>"*).
- **Acceptance Criteria**:
  - Mission transitions to `completed`.
  - Stats dashboard updates: donations total, funds in transit, and legalised expenses.
  - The delivery image is added to the public impact gallery.

### Scenario 6: Medical Supply Provider Claims and Direct Logistics
A medical supply provider (corporate pharmacy, distributor) registers and claims a mission.
- **Provider Registration**: Providers complete registration (KYC details for payments) and must be verified by the Admin.
- **Claiming & Direct Delivery**: A provider claims a mission in `created` state. Once funded by the donor directly to the provider's wallet, the provider ships the supplies directly using their corporate logistics, bypassing students.
- **Acceptance Criteria**:
  - Mission status follows the same state machine: `created` -> `claimed` -> `funding_sent` -> `funded` -> `purchased` (provider invoice upload) -> `completed` (delivery validated by hospital).
  - The provider is marked as the operator of the mission.

### Scenario 7: Mutual Review & Rating System
At the completion of a mission, participants can leave ratings (1 to 5 stars) and review comments for each other:
- **Hospital Prioritization**: Missions displayed on the public dashboard are sorted dynamically. Missions requested by hospitals with a higher average rating are displayed at the top of the queue.
- **Rating Matching Constraints**: To ensure reliability, missions requiring high funds (e.g., total referential amount **> $100.00**) can only be claimed by Students or Providers who have a verified average rating of **>= 4.0 stars**.
- **Donor Rating**: The student or provider who receives the transfer rates the donor based on speed and communication.
- **Chatbot / Omnichannel Integration**: Participants can rate their counterpart via SMS/WhatsApp/Instagram.

---

### Scenario 8: Direct Supply Donation (Bypassing Funding)
An organization or person who already has the requested medical supplies can claim the mission as a "Direct Donation".
- **Bypassing Funding**: By claiming it as a direct donation, the mission bypasses the donor transaction and receipt validation phases (`claimed` -> `funding_sent` -> `funded`).
- **State Transition**: The mission transitions directly from `created` to `funded`. The claimant is designated as both the operator and the donor (e.g. `Carlos Mendoza (Directo)`).
- **Logistics**: The operator proceeds directly to buy/despach (or deliver if they already have them) the supplies to the hospital.
- **Acceptance Criteria**:
  - Mission status transitions: `created` -> `funded` (direct donation claimed) -> `purchased` / `completed`.
  - No donor transfer proof or student receipt proof is required.

---

### Scenario 9: Hospital Profile Registration & Human CAPTCHA Verification
Hospitals can register themselves directly on the CUMIS Conecta platform.
- **Registration details**: Name of hospital, Address/Location of hospital, Manager's first and last name, Manager's email, Manager's phone number, WhatsApp contact confirmation flag, optional logo/facility image, and optional tax ID (RIF).
- **Human Validation Check**: All public signup forms (Student, Provider, and Hospital registration) must validate that the registrant is a human by presenting a dynamic math verification puzzle (e.g. Sum math captcha).
- **Verification Status**: Hospital profiles are created in `pending` status. The CUMIS Administrator audits their KYC details on the Admin Console and updates their status to `verified`. Only verified hospitals can create medical supply missions on the portal or via the WhatsApp chatbot agent.

---

## Chat Agent Command Schemas (WhatsApp / Instagram Webhook)
The omnichannel integration listens to incoming chats and performs database updates:
1. **Hospital Create**: *"crear mision para [Hospital] con [cantidad] [insumo], [cantidad] [insumo]"*
2. **Student/Provider Claim**: *"tomar mision [id]"* (Standard) or *"tomar mision [id] como donacion"* (Direct Donation)
3. **Donor Fund**: *"donar a la mision [id]"*
4. **Student/Provider Confirm Funds**: *"confirmar fondos [id]"*
5. **Hospital Complete**: *"confirmar entrega [id]"*
6. **Rating Command**: *"valorar [id] con [1-5] estrellas"*
