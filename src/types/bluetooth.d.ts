interface Navigator {
  bluetooth: {
    requestDevice(options: any): Promise<any>;
  };
}
interface BluetoothRemoteGATTCharacteristic {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
}
