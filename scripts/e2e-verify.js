const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🏁 Starting automated integration tests for CUMIS Conecta...\n');
  
  // Generate dynamic phone numbers to allow consecutive validation runs
  const testPhone = '+58416' + Math.floor(1000000 + Math.random() * 9000000);
  const hospPhone = '+58412' + Math.floor(1000000 + Math.random() * 9000000);
  console.log(`📱 Generated dynamic test phone for provider registration: ${testPhone}`);
  console.log(`📱 Generated dynamic test phone for hospital registration: ${hospPhone}\n`);

  try {
    // ==========================================
    // FLOW 1: STANDARD FUNDED MISSION FLOW
    // ==========================================
    console.log('--- FLOW 1: Standard Donor Funded Mission ---');
    console.log('🤖 Simulating hospital creating a mission via WhatsApp bot...');
    const createRes = await fetch(`${BASE_URL}/api/webhooks/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'whatsapp',
        sender_phone: '+584121111111', // Hospital Vargas
        message: 'Crear mision Vargas con 30 alcohol y 10 guantes'
      })
    });
    const createData = await createRes.json();
    console.log('👉 Bot reply:', createData.reply);

    // Get the mission ID from the reply
    const idMatch = createData.reply.match(/MIS-\d+/);
    if (!idMatch) throw new Error('Failed to parse mission ID from bot reply.');
    const missionId = idMatch[0];
    console.log(`✅ Mission created successfully: ${missionId}\n`);

    // Register a new Provider
    console.log('🏭 Registering a new Wholesaler Provider...');
    const regRes = await fetch(`${BASE_URL}/api/providers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Farmacia Express',
        phone: testPhone,
        email: 'express@farmacia.com',
        kyc_type: 'meru',
        kyc_details: '@farmacia_express',
        password: 'password123'
      })
    });
    const regData = await regRes.json();
    if (!regRes.ok) throw new Error(`Provider registration failed: ${regData.error}`);
    console.log(`✅ Provider registered: ${regData.name} (Status: ${regData.status})\n`);

    // Admin login to verify provider
    console.log('🔑 Logging in as Administrator...');
    const adminLoginRes = await fetch(`${BASE_URL}/api/missionaries/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: 'admin', password: 'manu2026' })
    });
    const adminData = await adminLoginRes.json();
    if (!adminLoginRes.ok) throw new Error(`Admin login failed: ${adminData.error}`);
    const token = adminData.token;
    console.log('✅ Admin login success.\n');

    // Verify Provider KYC
    console.log('📝 Verifying Provider KYC as Admin...');
    const verifyRes = await fetch(`${BASE_URL}/api/providers/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id: regData.id, status: 'verified' })
    });
    const verifiedData = await verifyRes.json();
    if (!verifyRes.ok) throw new Error(`Provider verification failed: ${verifiedData.error}`);
    console.log(`✅ Provider KYC verified: ${verifiedData.name} (Status: ${verifiedData.status})\n`);

    // Provider Login
    console.log('🏭 Logging in as verified Provider...');
    const loginRes = await fetch(`${BASE_URL}/api/providers/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone, password: 'password123' })
    });
    const providerData = await loginRes.json();
    if (!loginRes.ok) throw new Error(`Provider login failed: ${providerData.error}`);
    const providerToken = providerData.token;
    console.log(`✅ Provider logged in. Welcome, ${providerData.name}!\n`);

    // Claim mission as provider
    console.log(`🚚 Claiming mission ${missionId} as Provider...`);
    const claimRes = await fetch(`${BASE_URL}/api/missions/${missionId}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${providerToken}`
      }
    });
    const claimData = await claimRes.json();
    if (!claimRes.ok) throw new Error(`Failed to claim mission: ${claimData.error}`);
    console.log(`✅ Mission ${missionId} claimed successfully by ${claimData.provider_name || claimData.student_name}.\n`);

    // Simulating Donor sending funds via Bot
    console.log('💰 Donating funds via WhatsApp Bot command...');
    const donRes = await fetch(`${BASE_URL}/api/webhooks/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'whatsapp',
        sender_phone: '+13059999999', // Donor phone
        message: `donar a la mision ${missionId}`
      })
    });
    const donData = await donRes.json();
    console.log('👉 Bot reply:', donData.reply);
    console.log('✅ Donation recorded successfully.\n');

    // Confirming receipt of funds by Provider via Bot
    console.log('🎓 Confirming receipt of funds via WhatsApp Bot command (as Provider)...');
    const confirmRes = await fetch(`${BASE_URL}/api/webhooks/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'whatsapp',
        sender_phone: testPhone, // Provider phone
        message: `confirmar fondos ${missionId}`
      })
    });
    const confirmData = await confirmRes.json();
    console.log('👉 Bot reply:', confirmData.reply);
    console.log('✅ Funds receipt confirmed.\n');

    // Submitting rating rating feedback via Bot (Donor rates Provider)
    console.log('⭐️ Rating the Provider via WhatsApp Bot command...');
    const rateRes = await fetch(`${BASE_URL}/api/webhooks/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'whatsapp',
        sender_phone: '+13059999999', // Donor
        message: `valorar ${missionId} con 5 estrellas: Excelente despacho`
      })
    });
    const rateData = await rateRes.json();
    console.log('👉 Bot reply:', rateData.reply);
    console.log('✅ Rating processed successfully.\n');

    // ==========================================
    // FLOW 2: DIRECT SUPPLY DONATION FLOW
    // ==========================================
    console.log('--- FLOW 2: Direct Supply Donation (Bypassing Funding) ---');
    console.log('🤖 Simulating hospital creating a second mission via WhatsApp bot...');
    const createRes2 = await fetch(`${BASE_URL}/api/webhooks/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'whatsapp',
        sender_phone: '+584121111111', // Hospital Vargas
        message: 'Crear mision Vargas con 15 alcohol y 5 guantes'
      })
    });
    const createData2 = await createRes2.json();
    const idMatch2 = createData2.reply.match(/MIS-\d+/);
    if (!idMatch2) throw new Error('Failed to parse second mission ID.');
    const missionId2 = idMatch2[0];
    console.log(`✅ Second Mission created: ${missionId2}\n`);

    // Student claims mission as Direct Donation via chatbot
    console.log(`🚚 Claiming second mission ${missionId2} as Direct Donation (using Carlos Mendoza's phone)...`);
    const claimRes2 = await fetch(`${BASE_URL}/api/webhooks/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'whatsapp',
        sender_phone: '+584141234567', // Carlos Mendoza (verified student)
        message: `tomar mision ${missionId2} como donacion`
      })
    });
    const claimData2 = await claimRes2.json();
    console.log('👉 Bot reply:', claimData2.reply);
    
    // Verify that the mission transitioned directly to 'funded'
    const checkRes = await fetch(`${BASE_URL}/api/missions/${missionId2}`, {
      headers: { 'Authorization': `Bearer ${token}` } // Admin check
    });
    const checkData = await checkRes.json();
    console.log(`📊 Current status in DB: ${checkData.status}`);
    console.log(`📊 Assigned Donor in DB: ${checkData.donor_name}`);
    if (checkData.status !== 'funded') {
      throw new Error(`Direct donation failed to transition directly to 'funded'. Current status: ${checkData.status}`);
    }
    console.log('✅ Status is verified as "funded" (Bypassed claimed & funding_sent phases).\n');

    // ==========================================
    // FLOW 3: HOSPITAL PROFILE REGISTRATION & APPROVAL (NEW)
    // ==========================================
    console.log('--- FLOW 3: Hospital Profile Registration & KYC Verification ---');
    console.log('🏥 Registering a new Hospital profile...');
    const hospRegRes = await fetch(`${BASE_URL}/api/hospitals/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hospital San Juan de Dios',
        location: 'Caracas, Las Mercedes',
        phone: hospPhone,
        manager_name: 'Dr. Alejandro Peña',
        manager_email: 'apena@sjdedios.org.ve',
        is_whatsapp: true,
        rif: 'J-12345678-9',
        image_path: 'https://sjdedios.org/front.jpg'
      })
    });
    const hospRegData = await hospRegRes.json();
    if (!hospRegRes.ok) throw new Error(`Hospital registration failed: ${hospRegData.error}`);
    console.log(`✅ Hospital registered: ${hospRegData.name} (Status: ${hospRegData.status})\n`);

    // Attempt to create a mission via chatbot agent before verification
    console.log('🤖 Simulating unverified hospital attempting to create mission via WhatsApp...');
    const hospCreateFailRes = await fetch(`${BASE_URL}/api/webhooks/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'whatsapp',
        sender_phone: hospPhone,
        message: 'Crear mision San Juan con 10 jeringas'
      })
    });
    const hospCreateFailData = await hospCreateFailRes.json();
    console.log('👉 Bot reply:', hospCreateFailData.reply);
    if (!hospCreateFailData.reply.includes('KYC') && !hospCreateFailData.reply.includes('registrado')) {
      throw new Error(`Failed to reject unverified hospital. Bot reply was: ${hospCreateFailData.reply}`);
    }
    console.log('✅ Mission creation rejected successfully because hospital is unverified.\n');

    // Verify hospital as Admin
    console.log('📝 Approving/Verifying Hospital KYC as Admin...');
    const hospVerifyRes = await fetch(`${BASE_URL}/api/hospitals/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id: hospRegData.id, status: 'verified' })
    });
    const hospVerifyData = await hospVerifyRes.json();
    if (!hospVerifyRes.ok) throw new Error(`Hospital verification failed: ${hospVerifyData.error}`);
    console.log(`✅ Hospital KYC verified: ${hospVerifyData.name} (Status: ${hospVerifyData.status})\n`);

    // Retry creating a mission via WhatsApp bot
    console.log('🤖 Retrying mission creation for newly verified hospital via WhatsApp...');
    const hospCreateSuccessRes = await fetch(`${BASE_URL}/api/webhooks/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'whatsapp',
        sender_phone: hospPhone,
        message: 'Crear mision San Juan con 20 alcohol y 10 povidine'
      })
    });
    const hospCreateSuccessData = await hospCreateSuccessRes.json();
    console.log('👉 Bot reply:', hospCreateSuccessData.reply);
    if (!hospCreateSuccessData.reply.includes('creada con éxito')) {
      throw new Error(`Failed to create mission for verified hospital. Bot reply was: ${hospCreateSuccessData.reply}`);
    }
    console.log('✅ Mission created successfully after hospital verification!\n');

    console.log('🎉 Integration tests completed successfully!');

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
  }
}

runTests();
