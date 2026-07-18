// Bluetooth thermal printer manager (BLE)
// Stores paired device info in localStorage

const STORAGE_KEY = 'soeka_bt_printer';

// Common BLE printer service/characteristic UUIDs
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // common generic
  '0000ff00-0000-1000-8000-00805f9b34fb', // common alt
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Bluetooth printer
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 style
];
const PRINT_CHARACTERISTICS = [
  '000018f1-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
];

export type PrinterInfo = { name: string; id: string };

export function getSavedPrinter(): PrinterInfo | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function savePrinter(info: PrinterInfo) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(info)); } catch {}
}

export function clearPrinter() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export async function pairPrinter(): Promise<PrinterInfo> {
  if (!navigator.bluetooth) throw new Error('Browser tidak support Web Bluetooth');

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICES,
  });

  const info = { name: device.name || 'Printer', id: device.id };
  savePrinter(info);
  return info;
}

export async function printData(data: Uint8Array): Promise<void> {
  if (!navigator.bluetooth) throw new Error('Browser tidak support Web Bluetooth');

  const saved = getSavedPrinter();

  // Try to get device - requestDevice with filters if we have a name
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICES,
  });

  const server = await device.gatt!.connect();

  // Try each service/characteristic combo
  let characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  for (const serviceUuid of PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      for (const charUuid of PRINT_CHARACTERISTICS) {
        try {
          const char = await service.getCharacteristic(charUuid);
          characteristic = char;
          break;
        } catch {}
      }
      if (characteristic) break;
    } catch {}
  }

  // If no known service found, try getting all services
  if (!characteristic) {
    try {
      const services = await server.getPrimaryServices();
      for (const service of services) {
        try {
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              characteristic = char;
              break;
            }
          }
          if (characteristic) break;
        } catch {}
      }
    } catch {}
  }

  if (!characteristic) {
    server.disconnect();
    throw new Error('Characteristic printer tidak ditemukan. Pastikan printer BLE dan sudah terhubung.');
  }

  // Send data in 20-byte chunks (BLE MTU limit)
  const CHUNK = 20;
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    try {
      await characteristic.writeValueWithoutResponse(chunk);
    } catch {
      await characteristic.writeValue(chunk);
    }
    // Small delay between chunks
    await new Promise(r => setTimeout(r, 20));
  }

  server.disconnect();
}
