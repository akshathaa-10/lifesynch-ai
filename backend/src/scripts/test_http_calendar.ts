import { signUserToken } from '../utils/jwt';

async function testHttpEndpoints() {
  const token = signUserToken({
    id: '58889ae0-090d-4d7c-a420-02cfa6e97da0',
    email: '2024ci_akshathal_a@nie.ac.in',
    name: 'Akshatha'
  });

  console.log('1. Testing GET http://localhost:5000/api/v1/sync/calendar-events ...');
  const getRes = await fetch('http://localhost:5000/api/v1/sync/calendar-events', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const getJson = await getRes.json() as any;
  console.log('GET Status:', getRes.status, 'success:', getJson.success);
  console.log('Stored calendar events count:', getJson.data?.length);
  if (getJson.data?.length > 0) {
    console.log('Event 1:', {
      title: getJson.data[0].summary,
      start: getJson.data[0].startTime,
      end: getJson.data[0].endTime,
      location: getJson.data[0].location,
      status: getJson.data[0].status
    });
  }

  console.log('\n2. Testing POST http://localhost:5000/api/v1/sync/calendar ...');
  const postRes = await fetch('http://localhost:5000/api/v1/sync/calendar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const postJson = await postRes.json() as any;
  console.log('POST Status:', postRes.status, 'success:', postJson.success);
  console.log('Sync summary returned by endpoint:', postJson.data);

  console.log('\n3. Testing GET http://localhost:5000/api/v1/sync/status ...');
  const statusRes = await fetch('http://localhost:5000/api/v1/sync/status', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const statusJson = await statusRes.json() as any;
  console.log('Status endpoint:', statusJson.data);
}

testHttpEndpoints().catch(err => {
  console.error('HTTP test error:', err);
  process.exit(1);
});
