// Bluetooth thermal printer - singleton device reference per session

const STORAGE_KEY = 'soeka_bt_printer';

const SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
];
const CHARS = [
  '000018f1-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
];

export type PrinterInfo = { name: string };

// Singleton — stays alive as long as tab is open
let _device: any = null;
let _char: any = null;

export function getSavedPrinter(): PrinterInfo | null {
  try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}

export function isConnected(): boolean {
  return !!_device && _device.gatt?.connected;
}

export async function pairAndConnect(): Promise<PrinterInfo> {
  if (!(navigator as any).bluetooth) throw new Error('Browser tidak support Web Bluetooth. Pakai Chrome.');

  const device = await (navigator as any).bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICES,
  });

  _device = device;
  _char = null;

  // Handle disconnect
  device.addEventListener('gattserverdisconnected', () => {
    _char = null;
  });

  const info = { name: device.name || 'Printer BT' };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(info));

  // Connect immediately
  await _ensureConnected();

  return info;
}

async function _ensureConnected(): Promise<void> {
  if (!_device) throw new Error('Belum ada printer. Pair dulu di Staff Hub → Printer.');
  if (!_device.gatt.connected) {
    await _device.gatt.connect();
    _char = null;
  }
  if (!_char) {
    const server = _device.gatt;
    for (const svcUuid of SERVICES) {
      try {
        const svc = await server.getPrimaryService(svcUuid);
        for (const charUuid of CHARS) {
          try { _char = await svc.getCharacteristic(charUuid); break; } catch {}
        }
        if (_char) break;
      } catch {}
    }
    if (!_char) {
      const svcs = await server.getPrimaryServices();
      for (const svc of svcs) {
        try {
          const cs = await svc.getCharacteristics();
          for (const c of cs) { if (c.properties.write || c.properties.writeWithoutResponse) { _char = c; break; } }
          if (_char) break;
        } catch {}
      }
    }
    if (!_char) throw new Error('Characteristic printer tidak ditemukan.');
  }
}

export async function printData(data: Uint8Array): Promise<void> {
  if (!_device) throw new Error('NO_DEVICE');
  await _ensureConnected();
  const CHUNK = 20;
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    try { await _char.writeValueWithoutResponse(chunk); }
    catch { await _char.writeValue(chunk); }
    await new Promise(r => setTimeout(r, 20));
  }
}

export function disconnect() {
  try { if (_device?.gatt?.connected) _device.gatt.disconnect(); } catch {}
  _device = null; _char = null;
}
