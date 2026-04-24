export interface APIData {
  id: string;
  [key: string]: unknown;
}

export abstract class Structure<T extends APIData> {
  readonly id: string;
  readonly createdTimestamp: number;
  protected _data: T;

  constructor(data: T) {
    this.id = data.id;
    this.createdTimestamp = Number(BigInt(data.id) >> 22n) + 1420070400000;
    this._data = data;
  }

  get raw(): T {
    return this._data;
  }

  patch(data: Partial<T>): void {
    this._data = { ...this._data, ...data };
  }
}
