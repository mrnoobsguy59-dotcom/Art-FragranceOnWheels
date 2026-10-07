const pricing = {
  sedan: {
    compact: { basic: 45, wax: 75, interior: 65, full: 125 },
    mid: { basic: 55, wax: 90, interior: 80, full: 145 },
    full: { basic: 65, wax: 105, interior: 95, full: 170 },
    large: { basic: 75, wax: 120, interior: 110, full: 195 }
  },
  suv: {
    compact: { basic: 55, wax: 85, interior: 75, full: 145 },
    mid: { basic: 65, wax: 100, interior: 90, full: 165 },
    full: { basic: 80, wax: 120, interior: 105, full: 190 },
    large: { basic: 90, wax: 140, interior: 120, full: 220 }
  },
  truck: {
    compact: { basic: 60, wax: 90, interior: 80, full: 150 },
    mid: { basic: 70, wax: 110, interior: 95, full: 175 },
    full: { basic: 85, wax: 130, interior: 110, full: 205 },
    large: { basic: 100, wax: 155, interior: 130, full: 240 }
  },
  van: {
    compact: { basic: 65, wax: 95, interior: 90, full: 160 },
    mid: { basic: 75, wax: 115, interior: 105, full: 180 },
    full: { basic: 90, wax: 140, interior: 120, full: 215 },
    large: { basic: 110, wax: 170, interior: 140, full: 255 }
  },
  luxury: {
    compact: { basic: 75, wax: 120, interior: 100, full: 190 },
    mid: { basic: 90, wax: 145, interior: 120, full: 220 },
    full: { basic: 110, wax: 175, interior: 145, full: 255 },
    large: { basic: 130, wax: 210, interior: 175, full: 295 }
  }
};

const conditionFees = {
  light: 0,
  normal: 15,
  heavy: 35
};

const PET_HAIR_FEE = 95;
const ODOR_REMOVAL_FEE = 75;

const smallCarSeatPricing = {
  leather: { 3: 135, 5: 175 },
  cloth: { 3: 175, 5: 220 }
};

function getSeatPrice(seatMaterial, seatCount) {
  const pricing = smallCarSeatPricing[seatMaterial];
  const count = Number(seatCount);
  if (!pricing || count < 3 || count > 20) return 0;
  if (count <= 5) {
    return Math.round(pricing[3] + ((pricing[5] - pricing[3]) * (count - 3)) / 2);
  }
  return Math.round(pricing[5] + (count - 5) * (seatMaterial === 'leather' ? 20 : 22.5));
}

const serviceLabel = {
  basic: 'Basic wash',
  wax: 'Wash + wax',
  interior: 'Interior detail',
  full: 'Full detail'
};

const pricingGuide = [
  { label: 'Basic wash', price: '$45-$65' },
  { label: 'Wash + wax', price: '$75-$120' },
  { label: 'Interior detail', price: '$60-$110' },
  { label: 'Full detail', price: '$120-$220' },
  { label: 'Leather 3 seats', price: '$135' },
  { label: 'Leather 5 seats', price: '$175' },
  { label: 'Cloth 3 seats', price: '$175' },
  { label: 'Cloth 5 seats', price: '$220' },
  { label: 'Van trunk', price: '$145' },
  { label: 'Mini van trunk', price: '$235' }
];

const SHOP_LOCATION = {
  latitude: 34.5668,
  longitude: -80.9045,
  city: 'Great Falls'
};

let addressLookupTimer;
let addressLookupController;
let travelOrigin = SHOP_LOCATION;

function useDeviceLocation() {
  if (!navigator.geolocation) {
    travelOrigin = SHOP_LOCATION;
    const distanceInput = document.getElementById('distanceMiles');
    if (distanceInput) distanceInput.value = '0';
    calculateQuote();
    setGpsStatus('This browser does not support device location. Distance estimates will use Great Falls.', 'error');
    return;
  }

  clearTimeout(addressLookupTimer);
  addressLookupController?.abort();
  const distanceInput = document.getElementById('distanceMiles');
  if (distanceInput) distanceInput.value = '0';
  calculateQuote();
  setGpsStatus('Requesting location permission…', 'loading');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        travelOrigin = SHOP_LOCATION;
        if (distanceInput) distanceInput.value = '0';
        calculateQuote();
        setGpsStatus('This device did not provide a valid location. Distance estimates will use Great Falls.', 'error');
        return;
      }

      travelOrigin = { latitude, longitude, city: SHOP_LOCATION.city };
      const address = document.getElementById('customerAddress')?.value.trim() || '';
      if (address) {
        calculateDrivingDistance(address);
      } else {
        setGpsStatus('Device location is ready for private distance calculations. Enter a service address to get a driving estimate.', 'success');
      }
    },
    (error) => {
      const reason = error.code === error.PERMISSION_DENIED
        ? 'Allow location access in your browser to use this device for distance calculations.'
        : error.code === error.POSITION_UNAVAILABLE
          ? 'This device could not determine its location.'
          : 'The location request timed out.';
      travelOrigin = SHOP_LOCATION;
      if (distanceInput) distanceInput.value = '0';
      calculateQuote();
      setGpsStatus(`${reason} Distance estimates will use Great Falls.`, 'error');
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
  );
}

function setGpsStatus(message, state = '') {
  const status = document.getElementById('gpsStatus');
  if (!status) return;
  status.textContent = message;
  status.classList.remove('loading', 'success', 'error');
  if (state) status.classList.add(state);
}

async function calculateDrivingDistance(address) {
  const normalizedAddress = address.trim();
  const distanceInput = document.getElementById('distanceMiles');
  if (!normalizedAddress || !distanceInput) return;

  addressLookupController?.abort();
  const controller = new AbortController();
  addressLookupController = controller;
  distanceInput.value = '0';

  if (/^\d+(?:\s*[-–]\s*\d+)?$/.test(normalizedAddress)) {
    setGpsStatus('Enter a full street address, including the street name and city, to calculate mobile distance.', 'error');
    calculateQuote();
    return;
  }

  setGpsStatus('Finding your address and calculating driving distance…', 'loading');
  calculateQuote();

  try {
    const geocodeUrl = new URL('https://nominatim.openstreetmap.org/search');
    geocodeUrl.search = new URLSearchParams({
      format: 'jsonv2',
      limit: '1',
      countrycodes: 'us',
      addressdetails: '1',
      q: normalizedAddress
    }).toString();
    const geocodeResponse = await fetch(geocodeUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!geocodeResponse.ok) {
      throw new Error(`Address lookup failed (${geocodeResponse.status}).`);
    }

    const locations = await geocodeResponse.json();
    if (!Array.isArray(locations) || locations.length === 0) {
      setGpsStatus('We could not find that address. Check the street, city, and state.', 'error');
      return;
    }

    const matchedAddress = locations[0].address;
    const hasStreet = matchedAddress && (
      matchedAddress.road ||
      matchedAddress.pedestrian ||
      matchedAddress.footway ||
      matchedAddress.residential ||
      matchedAddress.highway
    );
    if (!hasStreet) {
      setGpsStatus('We could not verify a street address. Enter the street name and city to calculate mobile distance.', 'error');
      return;
    }

    const latitude = Number(locations[0].lat);
    const longitude = Number(locations[0].lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('Address lookup returned invalid coordinates.');
    }

    const routeUrl = new URL(
      `https://router.project-osrm.org/route/v1/driving/${travelOrigin.longitude},${travelOrigin.latitude};${longitude},${latitude}`
    );
    routeUrl.search = new URLSearchParams({ overview: 'false' }).toString();
    const routeResponse = await fetch(routeUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!routeResponse.ok) {
      throw new Error(`Driving route lookup failed (${routeResponse.status}).`);
    }

    const routeData = await routeResponse.json();
    const routeMeters = routeData.routes?.[0]?.distance;
    if (routeData.code !== 'Ok' || !Number.isFinite(routeMeters)) {
      setGpsStatus('We could not calculate a driving route to that address. Check the address and try again.', 'error');
      return;
    }

    const distanceMiles = routeMeters / 1609.344;
    distanceInput.value = String(distanceMiles);
    setGpsStatus(`About ${distanceMiles.toFixed(1)} driving miles from ${SHOP_LOCATION.city}.`, 'success');
    calculateQuote();
  } catch (error) {
    if (error.name === 'AbortError') return;
    console.error('Unable to calculate driving distance:', error);
    setGpsStatus('Distance lookup is unavailable right now. Please try again or contact us for a mobile-service estimate.', 'error');
  }
}

function scheduleDrivingDistanceLookup() {
  const addressInput = document.getElementById('customerAddress');
  const distanceInput = document.getElementById('distanceMiles');
  if (!addressInput || !distanceInput) return;

  clearTimeout(addressLookupTimer);
  addressLookupController?.abort();
  distanceInput.value = '0';

  const address = addressInput.value.trim();
  if (!address) {
    setGpsStatus('Enter an address to calculate driving distance from Great Falls.');
    calculateQuote();
    return;
  }

  setGpsStatus('Address changed. Calculating driving distance…', 'loading');
  addressLookupTimer = setTimeout(() => calculateDrivingDistance(address), 700);
}

function setAppointmentDateMinimum() {
  const dateInput = document.getElementById('appointmentDate');
  if (!dateInput) return;

  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  dateInput.min = `${today.getFullYear()}-${month}-${day}`;
}

const appointmentTimeRangeError = 'Choose a time in 30-minute intervals from 8:00AM to 5:00PM.';

function isAppointmentTimeWithinHours(time) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const appointmentMinutes = hours * 60 + minutes;
  return appointmentMinutes >= 8 * 60 &&
    appointmentMinutes <= 17 * 60 &&
    minutes % 30 === 0;
}

function handleAppointmentTimeChange() {
  const timeInput = document.getElementById('appointmentTime');
  if (!timeInput?.value) return;

  if (isAppointmentTimeWithinHours(timeInput.value)) {
    hideWin95Error();
  } else {
    showWin95Error(appointmentTimeRangeError);
  }
}

function validateAppointmentRequest() {
  const dateInput = document.getElementById('appointmentDate');
  const timeInput = document.getElementById('appointmentTime');
  if (!dateInput || !timeInput) return false;

  const today = new Date();
  const earliestDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const appointmentDate = dateInput.value;
  const appointmentTime = timeInput.value;

  if (!appointmentDate) {
    showWin95Error('Please choose an appointment date. Appointments are available every day, Monday through Sunday.');
    return false;
  }

  if (appointmentDate < earliestDate) {
    showWin95Error('Please choose today or a future date for your appointment.');
    return false;
  }

  if (!appointmentTime) {
    showWin95Error('Please choose an appointment time between 8:00 AM and 5:00 PM.');
    return false;
  }

  if (!isAppointmentTimeWithinHours(appointmentTime)) {
    showWin95Error(appointmentTimeRangeError);
    return false;
  }

  return true;
}

const vehicleModelsByMake = {
  Acura: ['ILX', 'MDX', 'RDX', 'TLX', 'Other'],
  'Alfa Romeo': ['Giulia', 'Stelvio', 'Other'],
  'Aston Martin': ['DB11', 'Vantage', 'Other'],
  Audi: ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q3', 'Q4', 'Q5', 'Q7', 'Q8', 'R8', 'Other'],
  Bentley: ['Bentayga', 'Continental', 'Flying Spur', 'Other'],
  BMW: ['1 Series', '3 Series', '5 Series', '7 Series', 'X1', 'X3', 'X5', 'X6', 'X7', 'Z4', 'M3', 'M5', 'Other'],
  Buick: ['Encore', 'Encore GX', 'Enclave', 'Envista', 'LaCrosse', 'Other'],
  Cadillac: ['CT4', 'CT5', 'Escalade', 'XT4', 'XT5', 'XT6', 'Other'],
  Chevrolet: ['Camaro', 'Corvette', 'Cruze', 'Equinox', 'Impala', 'Malibu', 'Silverado', 'Sonic', 'Suburban', 'Tahoe', 'Traverse', 'Trax', 'Volt', 'Other'],
  Chrysler: ['300', 'Pacifica', 'Prowler', '200', 'Other'],
  Dodge: ['Charger', 'Challenger', 'Durango', 'Journey', 'Other'],
  Ferrari: ['488', 'F8', 'Roma', 'SF90', 'Other'],
  Fiat: ['500', '500L', '500X', 'Other'],
  Ford: ['Bronco', 'Escape', 'Expedition', 'Explorer', 'F-150', 'F-250', 'F-350', 'Fiesta', 'Focus', 'Fusion', 'Mustang', 'Maverick', 'Ranger', 'Transit', 'Other'],
  Genesis: ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80', 'Other'],
  GMC: ['Acadia', 'Canyon', 'Sierra', 'Terrain', 'Yukon', 'Other'],
  Honda: ['Accord', 'Civic', 'CR-V', 'Fit', 'HR-V', 'Insight', 'Odyssey', 'Pilot', 'Ridgeline', 'Passport', 'Other'],
  Hyundai: ['Accent', 'Elantra', 'Ioniq', 'Kona', 'Palisade', 'Santa Fe', 'Sonata', 'Sportage', 'Tucson', 'Veloster', 'Venue', 'Other'],
  Infiniti: ['Q50', 'Q60', 'QX50', 'QX55', 'QX60', 'QX80', 'Other'],
  Jaguar: ['E-PACE', 'F-PACE', 'F-TYPE', 'XE', 'XF', 'XJ', 'Other'],
  Jeep: ['Cherokee', 'Compass', 'Grand Cherokee', 'Renegade', 'Wrangler', 'Gladiator', 'Other'],
  Kia: ['Carnival', 'EV6', 'Forte', 'K5', 'Niro', 'Optima', 'Rio', 'Sorento', 'Soul', 'Sportage', 'Stinger', 'Telluride', 'Other'],
  Lamborghini: ['Aventador', 'Huracan', 'Urus', 'Other'],
  'Land Rover': ['Defender', 'Discovery', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar', 'Other'],
  Lexus: ['ES', 'GS', 'GX', 'IS', 'LX', 'NX', 'RX', 'TX', 'UX', 'Other'],
  Lincoln: ['Aviator', 'Corsair', 'Nautilus', 'Navigator', 'Other'],
  Lotus: ['Elise', 'Evora', 'Exige', 'Other'],
  Maserati: ['Ghibli', 'Levante', 'Quattroporte', 'Other'],
  Mazda: ['3', '6', 'CX-3', 'CX-5', 'CX-9', 'Miata', 'Mazda2', 'Mazda3', 'Mazda6', 'MX-5', 'Other'],
  McLaren: ['570S', '720S', 'Artura', 'Other'],
  'Mercedes-Benz': ['A-Class', 'C-Class', 'E-Class', 'G-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'S-Class', 'AMG GT', 'Other'],
  MINI: ['Clubman', 'Cooper', 'Countryman', 'Hardtop', 'Other'],
  Mitsubishi: ['Eclipse', 'Lancer', 'Mirage', 'Outlander', 'Outlander Sport', 'Other'],
  Nissan: ['370Z', 'Altima', 'Frontier', 'GT-R', 'Leaf', 'Maxima', 'Murano', 'Pathfinder', 'Quest', 'Rogue', 'Sentra', 'Titan', 'Versa', 'Xterra', 'Other'],
  Porsche: ['911', '718 Boxster', '718 Cayman', 'Cayenne', 'Macan', 'Panther', 'Taycan', 'Other'],
  RAM: ['1500', '2500', '3500', 'ProMaster', 'Other'],
  'Rolls-Royce': ['Ghost', 'Phantom', 'Wraith', 'Other'],
  Subaru: ['Ascent', 'BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Outback', 'WRX', 'Other'],
  Tesla: ['Model 3', 'Model S', 'Model X', 'Model Y', 'Roadster', 'Other'],
  Toyota: ['4Runner', 'Avalon', 'Camry', 'Corolla', 'Crown', 'Highlander', 'Land Cruiser', 'Prius', 'RAV4', 'Sequoia', 'Sienna', 'Supra', 'Tacoma', 'Tundra', 'Yaris', 'Other'],
  Volkswagen: ['Beetle', 'Golf', 'Jetta', 'Passat', 'Tiguan', 'Touareg', 'Atlas', 'ID.4', 'Other'],
  Volvo: ['S60', 'S80', 'V60', 'V70', 'XC40', 'XC60', 'XC90', 'Other'],
  Other: ['Other']
};

const vehicleModelFirstYear = {
  Acura: { ILX: 2013, MDX: 2001, RDX: 2007, TLX: 2015 },
  'Alfa Romeo': { Giulia: 2017, Stelvio: 2018 },
  'Aston Martin': { DB11: 2017, Vantage: 2006 },
  Audi: { A3: 1996, A4: 1996, A5: 2008, A6: 1995, A7: 2012, A8: 1997, Q3: 2015, Q4: 2022, Q5: 2009, Q7: 2007, Q8: 2019, R8: 2008 },
  Bentley: { Bentayga: 2017, Continental: 2004, 'Flying Spur': 2006 },
  BMW: { '1 Series': 2008, '3 Series': 1990, '5 Series': 1990, '7 Series': 1990, X1: 2013, X3: 2004, X5: 2000, X6: 2008, X7: 2019, Z4: 2003, M3: 1990, M5: 1990 },
  Buick: { Encore: 2013, 'Encore GX': 2020, Enclave: 2008, Envista: 2024, LaCrosse: 2005 },
  Cadillac: { CT4: 2020, CT5: 2020, Escalade: 1999, XT4: 2019, XT5: 2017, XT6: 2020 },
  Chevrolet: { Camaro: 1990, Corvette: 1990, Cruze: 2011, Equinox: 2005, Impala: 1990, Malibu: 1990, Silverado: 1999, Sonic: 2012, Suburban: 1990, Tahoe: 1995, Traverse: 2009, Trax: 2013, Volt: 2011 },
  Chrysler: { '200': 2011, Pacifica: 2004, Prowler: 1997, '300': 2005 },
  Dodge: { Charger: 1966, Challenger: 1970, Durango: 1998, Journey: 2009 },
  Ferrari: { '488': 2016, F8: 2020, Roma: 2021, SF90: 2021 },
  Fiat: { '500': 2012, '500L': 2014, '500X': 2016 },
  Ford: { Bronco: 1990, Escape: 2001, Expedition: 1997, Explorer: 1991, 'F-150': 1990, 'F-250': 1990, 'F-350': 1990, Fiesta: 2011, Focus: 2000, Fusion: 2006, Mustang: 1990, Maverick: 2022, Ranger: 1990, Transit: 2015 },
  Genesis: { G70: 2019, G80: 2017, G90: 2017, GV60: 2023, GV70: 2022, GV80: 2021 },
  GMC: { Acadia: 2007, Canyon: 2004, Sierra: 1990, Terrain: 2010, Yukon: 1992 },
  Honda: { Accord: 1990, Civic: 1990, 'CR-V': 1997, Fit: 2007, 'HR-V': 2016, Insight: 2000, Odyssey: 1995, Pilot: 2003, Ridgeline: 2006, Passport: 1994 },
  Hyundai: { Accent: 1995, Elantra: 1992, Ioniq: 2017, Kona: 2018, Palisade: 2020, 'Santa Fe': 2001, Sonata: 1990, Sportage: 1995, Tucson: 2005, Veloster: 2012, Venue: 2020 },
  Infiniti: { Q50: 2014, Q60: 2017, QX50: 2008, QX55: 2022, QX60: 2013, QX80: 2011 },
  Jaguar: { 'E-PACE': 2018, 'F-PACE': 2017, 'F-TYPE': 2014, XE: 2017, XF: 2009, XJ: 1990 },
  Jeep: { Cherokee: 1990, Compass: 2007, 'Grand Cherokee': 1993, Renegade: 2015, Wrangler: 1987, Gladiator: 2020 },
  Kia: { Carnival: 2022, EV6: 2022, Forte: 2010, K5: 2021, Niro: 2017, Optima: 2001, Rio: 2001, Sorento: 2003, Soul: 2010, Sportage: 1995, Stinger: 2018, Telluride: 2020 },
  Lamborghini: { Aventador: 2012, Huracan: 2015, Urus: 2019 },
  'Land Rover': { Defender: 1993, Discovery: 1994, 'Range Rover': 1990, 'Range Rover Evoque': 2012, 'Range Rover Sport': 2006, 'Range Rover Velar': 2018 },
  Lexus: { ES: 1990, GS: 1993, GX: 2003, IS: 2001, LX: 1996, NX: 2015, RX: 1999, TX: 2024, UX: 2019 },
  Lincoln: { Aviator: 2003, Corsair: 2020, Nautilus: 2019, Navigator: 1998 },
  Lotus: { Elise: 2005, Evora: 2010, Exige: 2006 },
  Maserati: { Ghibli: 2014, Levante: 2017, Quattroporte: 1990 },
  Mazda: { '3': 2004, '6': 2003, 'CX-3': 2016, 'CX-5': 2013, 'CX-9': 2007, Miata: 1990, Mazda2: 2011, Mazda3: 2004, Mazda6: 2003, 'MX-5': 1990 },
  McLaren: { '570S': 2016, '720S': 2018, Artura: 2023 },
  'Mercedes-Benz': { 'A-Class': 2019, 'C-Class': 1994, 'E-Class': 1994, 'G-Class': 2002, GLA: 2015, GLB: 2020, GLC: 2016, GLE: 1998, GLS: 2007, 'S-Class': 1990, 'AMG GT': 2016 },
  MINI: { Clubman: 2008, Cooper: 2002, Countryman: 2011, Hardtop: 2002 },
  Mitsubishi: { Eclipse: 1990, Lancer: 2002, Mirage: 1990, Outlander: 2003, 'Outlander Sport': 2011 },
  Nissan: { '370Z': 2009, Altima: 1993, Frontier: 1998, 'GT-R': 2009, Leaf: 2011, Maxima: 1990, Murano: 2003, Pathfinder: 1990, Quest: 1993, Rogue: 2008, Sentra: 1990, Titan: 2004, Versa: 2007, Xterra: 2000 },
  Porsche: { '911': 1990, '718 Boxster': 2017, '718 Cayman': 2017, Cayenne: 2003, Macan: 2015, Panther: 2010, Taycan: 2020 },
  RAM: { '1500': 1994, '2500': 1994, '3500': 1994, ProMaster: 2014 },
  'Rolls-Royce': { Ghost: 2010, Phantom: 2004, Wraith: 2014 },
  Subaru: { Ascent: 2019, BRZ: 2013, Crosstrek: 2013, Forester: 1998, Impreza: 1993, Legacy: 1990, Outback: 1995, WRX: 2002 },
  Tesla: { 'Model 3': 2017, 'Model S': 2012, 'Model X': 2015, 'Model Y': 2020, Roadster: 2008 },
  Toyota: { '4Runner': 1990, Avalon: 1995, Camry: 1990, Corolla: 1990, Crown: 2023, Highlander: 2001, 'Land Cruiser': 1990, Prius: 2001, RAV4: 1996, Sequoia: 2001, Sienna: 1998, Supra: 1990, Tacoma: 1995, Tundra: 2000, Yaris: 2007 },
  Volkswagen: { Beetle: 1998, Golf: 1990, Jetta: 1990, Passat: 1990, Tiguan: 2009, Touareg: 2004, Atlas: 2018, 'ID.4': 2021 },
  Volvo: { S60: 2001, S80: 1999, V60: 2015, V70: 1997, XC40: 2019, XC60: 2010, XC90: 2003 }
};

function getVehicleModelFirstYear(make, model) {
  const currentYear = new Date().getFullYear();
  return Math.min(vehicleModelFirstYear[make]?.[model] || 1990, currentYear);
}

function populateVehicleIdentityFields() {
  const container = document.getElementById('vehicleIdentityFields');
  if (!container) return;
  const vehicleCount = Number(document.getElementById('vehicleCount')?.value || 1);
  const previousValues = Array.from(document.querySelectorAll('.vehicle-identity-row')).map((row) => ({
    make: row.querySelector('.vehicle-make')?.value || '',
    model: row.querySelector('.vehicle-model')?.value || '',
    year: row.querySelector('.vehicle-year')?.value || '',
    customModel: row.querySelector('.custom-vehicle-model')?.value || ''
  }));
  container.replaceChildren();

  for (let index = 0; index < vehicleCount; index += 1) {
    const values = previousValues[index] || {};
    const row = document.createElement('div');
    row.className = 'vehicle-identity-row';

    const title = document.createElement('h3');
    title.textContent = `Vehicle ${index + 1}`;
    row.appendChild(title);

    const makeLabel = document.createElement('label');
    makeLabel.textContent = 'Vehicle brand';
    const makeSelect = document.createElement('select');
    makeSelect.className = 'vehicle-make';
    makeSelect.id = index === 0 ? 'vehicleMake' : `vehicleMake${index + 1}`;
    makeSelect.innerHTML = '<option value="">Select make</option>' + Object.keys(vehicleModelsByMake)
      .map((make) => `<option value="${make}">${make}</option>`).join('');
    makeSelect.value = values.make || '';
    makeLabel.appendChild(makeSelect);

    const modelLabel = document.createElement('label');
    modelLabel.textContent = 'Vehicle model';
    const modelSelect = document.createElement('select');
    modelSelect.className = 'vehicle-model';
    modelSelect.id = index === 0 ? 'vehicleModel' : `vehicleModel${index + 1}`;
    modelLabel.appendChild(modelSelect);

    const yearLabel = document.createElement('label');
    yearLabel.textContent = 'Model year';
    const yearSelect = document.createElement('select');
    yearSelect.className = 'vehicle-year';
    yearSelect.id = index === 0 ? 'vehicleYear' : `vehicleYear${index + 1}`;
    yearLabel.appendChild(yearSelect);

    const customLabel = document.createElement('label');
    customLabel.className = 'hidden custom-model-label';
    customLabel.textContent = 'Other vehicle model';
    const customInput = document.createElement('input');
    customInput.className = 'custom-vehicle-model';
    customInput.id = index === 0 ? 'customVehicleModel' : `customVehicleModel${index + 1}`;
    customInput.placeholder = 'Type the exact model';
    customInput.value = values.customModel || '';
    customLabel.appendChild(customInput);

    row.append(makeLabel, modelLabel, yearLabel, customLabel);
    container.appendChild(row);

    function updateModelOptions() {
      const models = vehicleModelsByMake[makeSelect.value || 'Other'] || ['Other'];
      modelSelect.innerHTML = '<option value="">Select model</option>' + models
        .map((model) => `<option value="${model}">${model}</option>`).join('');
      modelSelect.value = values.model && models.includes(values.model) ? values.model : '';
      customLabel.classList.toggle('hidden', modelSelect.value !== 'Other');
      updateYearOptions();
    }

    function updateYearOptions() {
      const firstYear = getVehicleModelFirstYear(makeSelect.value, modelSelect.value);
      const lastYear = new Date().getFullYear();
      const previousYear = Number(yearSelect.value || values.year);
      yearSelect.innerHTML = `<option value="">Select year (${firstYear} or newer)</option>` +
        Array.from({ length: Math.max(0, lastYear - firstYear + 1) }, (_, yearIndex) => {
          const year = firstYear + yearIndex;
          return `<option value="${year}">${year}</option>`;
        }).join('');
      yearSelect.value = previousYear >= firstYear && previousYear <= lastYear ? String(previousYear) : '';
    }

    updateModelOptions();
    makeSelect.addEventListener('change', () => {
      values.model = '';
      updateModelOptions();
      calculateQuote();
    });
    modelSelect.addEventListener('change', () => {
      values.model = modelSelect.value;
      customLabel.classList.toggle('hidden', modelSelect.value !== 'Other');
      updateYearOptions();
      calculateQuote();
    });
    yearSelect.addEventListener('change', calculateQuote);
    customInput.addEventListener('input', calculateQuote);
  }
}

function populateVehicleServiceFields() {
  const container = document.getElementById('vehicleServiceFields');
  if (!container) return;
  const vehicleCount = Number(document.getElementById('vehicleCount')?.value || 1);
  const identityRows = Array.from(document.querySelectorAll('.vehicle-identity-row'));
  const previousValues = Array.from(container.querySelectorAll('.vehicle-service-panel')).map((panel) => ({
    type: panel.querySelector('.vehicle-type')?.value || '',
    size: panel.querySelector('.vehicle-size')?.value || '',
    exterior: panel.querySelector('.exterior-service')?.value || '',
    interior: panel.querySelector('.interior-service')?.value || '',
    fullDetail: panel.querySelector('.full-detail')?.checked || false,
    seatMaterial: panel.querySelector('.seat-material')?.value || '',
    seatCount: panel.querySelector('.seat-count')?.value || '',
    condition: panel.querySelector('.condition')?.value || '',
    petHair: panel.querySelector('.pet-hair')?.checked || false,
    odor: panel.querySelector('.odor')?.checked || false
  }));
  container.replaceChildren();

  const options = {
    type: [['', 'Select vehicle type'], ['sedan', 'Sedan'], ['suv', 'SUV'], ['truck', 'Truck'], ['van', 'Van'], ['luxury', 'Luxury / Premium']],
    size: [['', 'Select vehicle size'], ['compact', 'Compact'], ['mid', 'Mid-size'], ['full', 'Full-size'], ['large', 'Large / Extra Large']],
    exterior: [['', 'No exterior service'], ['basic', 'Basic wash'], ['wax', 'Wash + wax']],
    interior: [['', 'No interior service'], ['interior', 'Interior detail']],
    seatMaterial: [['', 'Select seat material'], ['cloth', 'Fabric'], ['leather', 'Leather'], ['premium', 'Premium leather']],
    seatCount: [['', 'Select seat count'], ...Array.from({ length: 18 }, (_, index) => {
      const count = index + 3;
      return [String(count), `${count} seats`];
    })],
    condition: [['', 'Select condition'], ['light', 'Light dirt / regular clean'], ['normal', 'Normal use / medium dirt'], ['heavy', 'Heavy dirt / deep clean needed']]
  };

  for (let index = 0; index < vehicleCount; index += 1) {
    const values = previousValues[index] || {};
    const panel = document.createElement('section');
    panel.className = 'vehicle-service-panel';
    const title = document.createElement('h3');
    title.textContent = `Vehicle ${index + 1} — Details & Services`;
    panel.appendChild(title);
    const description = document.createElement('p');
    description.className = 'vehicle-service-description';
    description.textContent = `Selections in this section apply only to Vehicle ${index + 1}.`;
    panel.appendChild(description);

    const identityRow = identityRows[index];
    if (identityRow) {
      identityRow.querySelector('h3')?.remove();
      identityRow.classList.add('vehicle-identity-inline');
      panel.appendChild(identityRow);
    }

    const addGroupTitle = (text) => {
      const heading = document.createElement('h4');
      heading.className = 'service-group-title';
      heading.textContent = text;
      panel.appendChild(heading);
    };

    const addSelect = (key, labelText, className) => {
      const label = document.createElement('label');
      label.textContent = labelText;
      const select = document.createElement('select');
      select.className = className;
      select.id = `${className}${index === 0 ? '' : index + 1}`;
      select.innerHTML = options[key].map(([value, text]) => `<option value="${value}">${text}</option>`).join('');
      select.value = values[key] || '';
      if (values.fullDetail && (key === 'exterior' || key === 'interior')) {
        select.value = '';
        select.disabled = true;
      }
      label.appendChild(select);
      panel.appendChild(label);
      select.addEventListener('change', calculateQuote);
    };

    addGroupTitle('Vehicle details');
    addSelect('type', 'Vehicle type', 'vehicle-type');
    addSelect('size', 'Vehicle size', 'vehicle-size');
    addGroupTitle('Exterior services');
    addSelect('exterior', 'Choose an exterior service', 'exterior-service');
    addGroupTitle('Interior services');
    addSelect('interior', 'Choose an interior service', 'interior-service');

    const fullDetailLabel = document.createElement('label');
    fullDetailLabel.className = 'checkbox-row full-detail-option';
    const fullDetailCheckbox = document.createElement('input');
    fullDetailCheckbox.type = 'checkbox';
    fullDetailCheckbox.className = 'full-detail';
    fullDetailCheckbox.id = `fullDetail${index === 0 ? '' : index + 1}`;
    fullDetailCheckbox.checked = values.fullDetail || false;
    fullDetailLabel.append(fullDetailCheckbox, document.createTextNode('Full detail package (interior + exterior)'));
    panel.appendChild(fullDetailLabel);
    fullDetailCheckbox.addEventListener('change', () => {
      const exteriorSelect = panel.querySelector('.exterior-service');
      const interiorSelect = panel.querySelector('.interior-service');
      if (fullDetailCheckbox.checked) {
        if (exteriorSelect) exteriorSelect.value = '';
        if (interiorSelect) interiorSelect.value = '';
      }
      if (exteriorSelect) exteriorSelect.disabled = fullDetailCheckbox.checked;
      if (interiorSelect) interiorSelect.disabled = fullDetailCheckbox.checked;
      calculateQuote();
    });

    addGroupTitle('Leather & fabric seat cleaning');
    addSelect('seatMaterial', 'Seat type', 'seat-material');
    addSelect('seatCount', 'Number of seats to clean', 'seat-count');

    addGroupTitle('Extra services');
    addSelect('condition', 'Condition', 'condition');

    [['petHair', 'Pet hair / heavy debris', 'pet-hair'], ['odor', 'Odor removal / smoke smell', 'odor']].forEach(([key, text, className]) => {
      const label = document.createElement('label');
      label.className = 'checkbox-row';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = className;
      checkbox.id = `${className}${index === 0 ? '' : index + 1}`;
      checkbox.checked = values[key] || false;
      label.append(checkbox, document.createTextNode(text));
      panel.appendChild(label);
      checkbox.addEventListener('change', calculateQuote);
    });
    container.appendChild(panel);
  }
}

function populateVehicleModels() {
  const makeSelect = document.getElementById('vehicleMake');
  const modelSelect = document.getElementById('vehicleModel');
  if (!makeSelect || !modelSelect) return;
  const selectedMake = makeSelect.value || 'Other';
  const models = vehicleModelsByMake[selectedMake] || ['Other'];
  const previousValue = modelSelect.dataset.previousValue || '';

  modelSelect.innerHTML = '<option value="">Select model</option>' +
    models.map((model) => `<option value="${model}">${model}</option>`).join('');

  if (!models.includes(previousValue)) {
    modelSelect.value = '';
  } else {
    modelSelect.value = previousValue;
  }

  modelSelect.dataset.previousValue = modelSelect.value;
  updateCustomModelField();
}

function updateCustomModelField() {
  const modelSelect = document.getElementById('vehicleModel');
  const customModelWrapper = document.getElementById('customModelWrapper');
  if (!modelSelect || !customModelWrapper) return;
  const showCustom = modelSelect.value === 'Other';

  customModelWrapper.classList.toggle('hidden', !showCustom);

  if (!showCustom) {
    const customInput = document.getElementById('customVehicleModel');
    if (customInput) customInput.value = '';
  }
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function calculateDistanceMiles(lat1, lon1, lat2, lon2) {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

function renderPricingGuide() {
  const guideList = document.getElementById('pricingGuideList');
  if (!guideList) return;
  guideList.replaceChildren();

  pricingGuide.forEach((item) => {
    const listItem = document.createElement('li');
    const label = document.createElement('span');
    const price = document.createElement('strong');

    label.textContent = item.label;
    price.textContent = item.price;

    listItem.appendChild(label);
    listItem.appendChild(price);
    guideList.appendChild(listItem);
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
}

function showWin95Error(message) {
  const errorMsg = document.getElementById('win95ErrorMessage');
  const errorBox = document.getElementById('win95Error');
  const okBtn = document.getElementById('okWin95Error');
  if (errorMsg) errorMsg.textContent = message;
  if (errorBox) errorBox.classList.remove('hidden');
  if (okBtn) okBtn.focus();
  playErrorSound();
}

function hideWin95Error() {
  const errorBox = document.getElementById('win95Error');
  if (errorBox) errorBox.classList.add('hidden');
}

const savedVehicleQuotes = [];
let latestVehicleQuote = null;

function renderVehicleQuotes() {
  const list = document.getElementById('vehicleQuoteList');
  const quoteAmount = document.getElementById('quoteAmount');
  const quoteTotalLabel = document.getElementById('quoteTotalLabel');
  if (!list || !quoteAmount || !quoteTotalLabel) return;
  const savedTotal = savedVehicleQuotes.reduce((sum, quote) => sum + quote.total, 0);

  list.replaceChildren();
  savedVehicleQuotes.forEach((quote, index) => {
    const item = document.createElement('div');
    item.className = 'vehicle-quote-item';

    const details = document.createElement('div');
    const name = document.createElement('p');
    name.className = 'vehicle-quote-name';
    name.textContent = `${index + 1}. ${quote.vehicleName}`;
    const description = document.createElement('p');
    description.className = 'vehicle-quote-details';
    description.textContent = `${quote.serviceName} · ${formatCurrency(quote.total)}`;
    details.append(name, description);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'remove-vehicle-btn';
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => {
      savedVehicleQuotes.splice(index, 1);
      renderVehicleQuotes();
      calculateQuote();
    });

    item.append(details, removeButton);
    list.appendChild(item);
  });

  if (savedVehicleQuotes.length > 0) {
    quoteAmount.textContent = formatCurrency(savedTotal);
    quoteTotalLabel.textContent = `${savedVehicleQuotes.length} vehicle${savedVehicleQuotes.length === 1 ? '' : 's'} in this quote`;
  } else {
    quoteTotalLabel.textContent = 'Complete a vehicle to begin your quote.';
  }
}

function clearVehicleFields() {
  ['vehicleMake', 'vehicleModel', 'vehicleYear', 'vehicleType', 'vehicleSize', 'serviceLevel', 'seatMaterial', 'seatCount', 'condition']
    .forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  const customInput = document.getElementById('customVehicleModel');
  if (customInput) customInput.value = '';
  const petInput = document.getElementById('petHair');
  if (petInput) petInput.checked = false;
  const odorInput = document.getElementById('odor');
  if (odorInput) odorInput.checked = false;
  const modelSelect = document.getElementById('vehicleModel');
  if (modelSelect) modelSelect.dataset.previousValue = '';
  populateVehicleModels();
  updateCustomModelField();
}

function addCurrentVehicle() {
  calculateQuote();
  if (!latestVehicleQuote || savedVehicleQuotes.length >= 15) return;

  savedVehicleQuotes.push(latestVehicleQuote);
  latestVehicleQuote = null;
  clearVehicleFields();
  renderVehicleQuotes();
  const quoteAmount = document.getElementById('quoteAmount');
  const quoteTotalLabel = document.getElementById('quoteTotalLabel');
  const customerMessage = document.getElementById('customerMessage');
  const customerName = document.getElementById('customerName')?.value.trim() || 'there';
  const combinedTotal = savedVehicleQuotes.reduce((sum, quote) => sum + quote.total, 0);
  const vehicleWord = savedVehicleQuotes.length === 1 ? 'vehicle' : 'vehicles';

  if (quoteAmount) quoteAmount.textContent = formatCurrency(combinedTotal);
  if (quoteTotalLabel) quoteTotalLabel.textContent = `${savedVehicleQuotes.length} vehicle${savedVehicleQuotes.length === 1 ? '' : 's'} in this quote`;
  if (customerMessage) customerMessage.textContent = `Thanks ${customerName}! Your estimate for ${savedVehicleQuotes.length} selected ${vehicleWord} is ${formatCurrency(combinedTotal)}. Add another vehicle or let us know if you would like to book these services.`;
}

function calculateQuote(showEmptyFormError = false) {
  showEmptyFormError = showEmptyFormError === true;

  if (!showEmptyFormError) {
    hideWin95Error();
  }

  const customerName = document.getElementById('customerName')?.value?.trim() || '';
  const customerAddress = document.getElementById('customerAddress')?.value?.trim() || '';
  const customerPhone = document.getElementById('customerPhone')?.value?.trim() || '';
  const serviceLocation = document.getElementById('serviceLocation')?.value || 'shop';
  const appointmentDate = document.getElementById('appointmentDate')?.value || '';
  const appointmentTime = document.getElementById('appointmentTime')?.value || '';
  const distanceInput = document.getElementById('distanceMiles');
  const distanceMiles = Number(distanceInput?.value || 0);

  const vehicleDetails = Array.from(document.querySelectorAll('.vehicle-identity-row')).map((row, index) => {
    const make = row.querySelector('.vehicle-make')?.value.trim() || '';
    const selectedModel = row.querySelector('.vehicle-model')?.value.trim() || '';
    const customModel = row.querySelector('.custom-vehicle-model')?.value?.trim() || '';
    return {
      number: index + 1,
      make,
      model: selectedModel === 'Other' ? customModel : selectedModel,
      year: row.querySelector('.vehicle-year')?.value.trim() || '',
      hasCustomModel: selectedModel === 'Other'
    };
  });

  const serviceDetails = Array.from(document.querySelectorAll('.vehicle-service-panel')).map((panel, index) => ({
    number: index + 1,
    vehicleType: panel.querySelector('.vehicle-type')?.value || '',
    vehicleSize: panel.querySelector('.vehicle-size')?.value || '',
    exteriorService: panel.querySelector('.exterior-service')?.value || '',
    interiorService: panel.querySelector('.interior-service')?.value || '',
    fullDetail: panel.querySelector('.full-detail')?.checked || false,
    seatMaterial: panel.querySelector('.seat-material')?.value || '',
    seatCount: panel.querySelector('.seat-count')?.value || '',
    condition: panel.querySelector('.condition')?.value || '',
    petHair: panel.querySelector('.pet-hair')?.checked || false,
    odor: panel.querySelector('.odor')?.checked || false
  }));

  const quoteWarning = document.getElementById('quoteWarning');
  const quoteAmount = document.getElementById('quoteAmount');
  const messageEl = document.getElementById('customerMessage');

  const missingFields = [];
  const invalidModelYears = [];
  vehicleDetails.forEach((vehicle) => {
    if (!vehicle.make) missingFields.push(`Vehicle ${vehicle.number} make`);
    if (!vehicle.model) missingFields.push(`Vehicle ${vehicle.number} model`);
    if (!vehicle.year) missingFields.push(`Vehicle ${vehicle.number} year`);
    if (vehicle.make && vehicle.model && vehicle.year && !vehicle.hasCustomModel) {
      const firstYear = getVehicleModelFirstYear(vehicle.make, vehicle.model);
      if (Number(vehicle.year) < firstYear) {
        invalidModelYears.push(`Vehicle ${vehicle.number} (${vehicle.make} ${vehicle.model}) must be model year ${firstYear} or newer`);
      }
    }
  });
  serviceDetails.forEach((detail) => {
    const hasCleaningSelection = detail.exteriorService || detail.interiorService || detail.fullDetail ||
      detail.seatMaterial || detail.seatCount || detail.condition || detail.petHair || detail.odor;
    if (!hasCleaningSelection) missingFields.push(`Vehicle ${detail.number} cleaning option`);
  });

  if (missingFields.length > 0) {
    if (showEmptyFormError) {
      if (missingFields.length > 0) {
        showWin95Error(`Please fill in: ${missingFields.join(', ')}.`);
      } else {
        showWin95Error(invalidModelYears.join('. '));
      }
    }
    if (quoteWarning) quoteWarning.classList.remove('hidden');
    if (quoteAmount) quoteAmount.textContent = '$0';
    if (messageEl) messageEl.textContent = 'Please complete the required customer and vehicle details before getting a quote.';
    return false;
  }

  if (invalidModelYears.length > 0) {
    if (showEmptyFormError) {
      showWin95Error(`${invalidModelYears.join('. ')}.`);
    }
    if (quoteWarning) quoteWarning.classList.remove('hidden');
    if (quoteAmount) quoteAmount.textContent = '$0';
    if (messageEl) messageEl.textContent = 'Please select a model year from the year this vehicle model was first released.';
    return false;
  }

  if (quoteWarning) quoteWarning.classList.add('hidden');

  let total = 0;
  const selectedItems = [];

  const travelFee = serviceLocation === 'mobile' && distanceMiles > 0 ? (distanceMiles * 2) * 2 : 0;
  serviceDetails.forEach((detail) => {
    const vehiclePrefix = `Vehicle ${detail.number} `;
    if (detail.fullDetail) {
      const fullDetailPrice = detail.vehicleType && detail.vehicleSize
        ? pricing[detail.vehicleType]?.[detail.vehicleSize]?.full ?? 0
        : 0;
      if (fullDetailPrice > 0) {
        total += fullDetailPrice;
        selectedItems.push(`${vehiclePrefix}Full detail: ${formatCurrency(fullDetailPrice)}`);
      }
    } else {
      [['exteriorService', 'Exterior'], ['interiorService', 'Interior']].forEach(([serviceKey, category]) => {
        const service = detail[serviceKey];
        const servicePrice = (detail.vehicleType && detail.vehicleSize && service)
          ? pricing[detail.vehicleType]?.[detail.vehicleSize]?.[service] ?? 0
          : 0;
        if (servicePrice > 0) {
          total += servicePrice;
          selectedItems.push(`${vehiclePrefix}${category} - ${serviceLabel[service]}: ${formatCurrency(servicePrice)}`);
        }
      });
    }

    const conditionFee = conditionFees[detail.condition] ?? 0;
    if (conditionFee > 0) {
      total += conditionFee;
      selectedItems.push(`${vehiclePrefix}condition: ${formatCurrency(conditionFee)}`);
    }

    if (detail.seatMaterial && detail.seatCount) {
      const customSeatType = detail.seatMaterial === 'premium' ? 'leather' : detail.seatMaterial;
      const customSeatPrice = getSeatPrice(customSeatType, detail.seatCount);
      if (customSeatPrice > 0) {
        total += customSeatPrice;
        const materialLabel = detail.seatMaterial === 'cloth'
          ? 'Fabric'
          : detail.seatMaterial === 'premium'
            ? 'Premium leather'
            : 'Leather';
        const seatLabel = `${materialLabel} seat cleaning (${detail.seatCount} seats)`;
        selectedItems.push(`${vehiclePrefix}${seatLabel}: ${formatCurrency(customSeatPrice)}`);
      }
    }

    if (detail.petHair) {
      total += PET_HAIR_FEE;
      selectedItems.push(`${vehiclePrefix}pet hair removal: ${formatCurrency(PET_HAIR_FEE)}`);
    }

    if (detail.odor) {
      total += ODOR_REMOVAL_FEE;
      selectedItems.push(`${vehiclePrefix}odor treatment: ${formatCurrency(ODOR_REMOVAL_FEE)}`);
    }
  });

  total += travelFee;
  if (travelFee > 0) {
    selectedItems.push(`Mobile service fee: ${formatCurrency(travelFee)} (${distanceMiles * 2} round-trip miles @ $2/mile)`);
  }

  const allVehicleSummary = vehicleDetails.map((vehicle) => {
    const identity = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
    return `Vehicle ${vehicle.number}: ${identity}`;
  }).join(' | ');

  const vehicleDetailsSummary = vehicleDetails.map((vehicle, index) => {
    const detail = serviceDetails[index] || {};
    const identity = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
    const type = [detail.vehicleType, detail.vehicleSize].filter(Boolean).join(' ');
    const services = [];
    if (detail.fullDetail) {
      services.push('Full detail package');
    } else {
      if (detail.exteriorService) services.push(`Exterior: ${serviceLabel[detail.exteriorService]}`);
      if (detail.interiorService) services.push(`Interior: ${serviceLabel[detail.interiorService]}`);
    }
    const extras = [];
    if (detail.seatMaterial && detail.seatCount) {
      const materialLabel = detail.seatMaterial === 'cloth'
        ? 'fabric'
        : detail.seatMaterial === 'premium'
          ? 'premium leather'
          : 'leather';
      extras.push(`${materialLabel} seat cleaning (${detail.seatCount} seats)`);
    }
    if (detail.petHair) extras.push('pet hair removal');
    if (detail.odor) extras.push('odor treatment');
    if (detail.condition) extras.push(`${detail.condition} condition`);
    return [identity || `Vehicle ${vehicle.number}`, type, [...services, ...extras].join(', ')].filter(Boolean).join(' - ');
  }).join('; ');

  const greetingName = customerName || 'friend';
  const vehicleCount = Number(document.getElementById('vehicleCount')?.value || 1);
  const vehicleWord = vehicleCount === 1 ? 'vehicle' : 'vehicles';
  const appointmentLabel = appointmentDate && appointmentTime
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(`${appointmentDate}T${appointmentTime}`))
    : 'appointment time to be confirmed';

  latestVehicleQuote = {
    total,
    vehicleName: allVehicleSummary || 'Vehicle details to be confirmed',
    serviceName: serviceDetails[0]?.fullDetail
      ? 'Full detail package'
      : [
        serviceDetails[0]?.exteriorService && `Exterior: ${serviceLabel[serviceDetails[0].exteriorService]}`,
        serviceDetails[0]?.interiorService && `Interior: ${serviceLabel[serviceDetails[0].interiorService]}`
      ].filter(Boolean).join(' + ') || 'Selected services'
  };

  const savedTotal = savedVehicleQuotes.reduce((sum, quote) => sum + quote.total, 0);
  const grandTotal = savedTotal + total;
  if (quoteAmount) quoteAmount.textContent = formatCurrency(grandTotal);
  const quoteTotalLabel = document.getElementById('quoteTotalLabel');
  if (quoteTotalLabel) quoteTotalLabel.textContent = `${vehicleCount} vehicle${vehicleCount === 1 ? '' : 's'} selected`;
  const locationLabel = serviceLocation === 'shop' ? 'at the shop' : 'with mobile service at your location';
  const quoteMessage = `Hi ${greetingName}! Your estimate is ${formatCurrency(grandTotal)} for ${vehicleCount} ${vehicleWord}: ${vehicleDetailsSummary || allVehicleSummary}. Appointment: ${appointmentLabel} ${locationLabel}.`;
  if (messageEl) {
    messageEl.textContent = `${quoteMessage} Service address: ${customerAddress || 'not provided'}. Phone: ${customerPhone || 'not provided'}.`;
  }

  return true;
}

function sendAppointmentEmail() {
  const isValid = calculateQuote(true);
  if (!isValid) return;
  if (!validateAppointmentRequest()) return;

  const recipientEmail = 'davidhn19@hotmail.com';
  const customerName = document.getElementById('customerName')?.value?.trim() || 'Customer';
  const customerPhone = document.getElementById('customerPhone')?.value?.trim() || 'N/A';
  const customerAddress = document.getElementById('customerAddress')?.value?.trim() || 'N/A';
  const customerCity = document.getElementById('customerCity')?.value?.trim() || SHOP_LOCATION.city;
  const serviceLocation = document.getElementById('serviceLocation')?.value || 'shop';
  const appointmentDate = document.getElementById('appointmentDate')?.value || '';
  const appointmentTime = document.getElementById('appointmentTime')?.value || '';
  const totalAmount = document.getElementById('quoteAmount')?.textContent || '$0';
  const summaryMessage = document.getElementById('customerMessage')?.textContent || '';

  const locationType = serviceLocation === 'mobile' ? 'MOBILE SERVICE (Go to customer location)' : 'SHOP APPOINTMENT (Customer coming to shop)';

  const subject = encodeURIComponent(`New Booking: ${customerName} - ${appointmentDate} at ${appointmentTime}`);
  const body = encodeURIComponent(
    `NEW DETAILING APPOINTMENT REQUEST\n` +
    `----------------------------------------\n` +
    `Type: ${locationType}\n` +
    `Date & Time: ${appointmentDate} at ${appointmentTime}\n\n` +
    `CUSTOMER DETAILS:\n` +
    `- Name: ${customerName}\n` +
    `- Phone: ${customerPhone}\n` +
    `- Address: ${customerAddress}, ${customerCity}\n\n` +
    `SUMMARY & ESTIMATE:\n` +
    `${summaryMessage}\n\n` +
    `Total Quote: ${totalAmount}\n` +
    `----------------------------------------`
  );

  window.location.href = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
}

renderPricingGuide();
populateVehicleIdentityFields();
populateVehicleServiceFields();
setAppointmentDateMinimum();

document.getElementById('calculateBtn')?.addEventListener('click', sendAppointmentEmail);
document.getElementById('appointmentTime')?.addEventListener('input', handleAppointmentTimeChange);
document.getElementById('appointmentTime')?.addEventListener('change', handleAppointmentTimeChange);
document.getElementById('useDeviceLocation')?.addEventListener('click', useDeviceLocation);
document.getElementById('customerAddress')?.addEventListener('input', scheduleDrivingDistanceLookup);
document.getElementById('customerAddress')?.addEventListener('change', scheduleDrivingDistanceLookup);
document.getElementById('serviceLocation')?.addEventListener('change', calculateQuote);
document.getElementById('vehicleCount')?.addEventListener('change', () => {
  populateVehicleIdentityFields();
  populateVehicleServiceFields();
  calculateQuote();
});
document.getElementById('closeWin95Error')?.addEventListener('click', hideWin95Error);
document.getElementById('okWin95Error')?.addEventListener('click', hideWin95Error);

let selectionAudioContext;

function playErrorSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  selectionAudioContext ??= new AudioContext();
  if (selectionAudioContext.state === 'suspended') {
    selectionAudioContext.resume();
  }

  const oscillator = selectionAudioContext.createOscillator();
  const gain = selectionAudioContext.createGain();
  const now = selectionAudioContext.currentTime;

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(220, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  oscillator.connect(gain);
  gain.connect(selectionAudioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.19);
}

function playSelectionSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  selectionAudioContext ??= new AudioContext();
  if (selectionAudioContext.state === 'suspended') {
    selectionAudioContext.resume();
  }

  const oscillator = selectionAudioContext.createOscillator();
  const gain = selectionAudioContext.createGain();
  const now = selectionAudioContext.currentTime;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(620, now);
  oscillator.frequency.exponentialRampToValueAtTime(860, now + 0.07);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

  oscillator.connect(gain);
  gain.connect(selectionAudioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.1);
}