import { MessageComponentType } from './Constants.js';

export interface SelectMenuOption {
  label: string;
  value: string;
  description?: string;
  emoji?: { id?: string; name?: string; animated?: boolean };
  default?: boolean;
}

export interface SelectMenuData {
  type: MessageComponentType;
  custom_id: string;
  options?: SelectMenuOption[];
  channel_types?: number[];
  placeholder?: string;
  default_values?: { id: string; type: string }[];
  min_values?: number;
  max_values?: number;
  disabled?: boolean;
}

export class SelectMenuBuilder {
  #data: Partial<SelectMenuData>;

  constructor(type: MessageComponentType = MessageComponentType.STRING_SELECT) {
    this.#data = { type };
  }

  static from(data: SelectMenuData): SelectMenuBuilder {
    const builder = new SelectMenuBuilder(data.type);
    builder.#data = { ...data };
    return builder;
  }

  setCustomId(id: string): this {
    this.#data.custom_id = id;
    return this;
  }

  setPlaceholder(placeholder: string): this {
    this.#data.placeholder = placeholder;
    return this;
  }

  setMinValues(min: number): this {
    this.#data.min_values = min;
    return this;
  }

  setMaxValues(max: number): this {
    this.#data.max_values = max;
    return this;
  }

  setDisabled(disabled = true): this {
    this.#data.disabled = disabled;
    return this;
  }

  addOptions(...options: SelectMenuOption[]): this {
    if (!this.#data.options) this.#data.options = [];
    this.#data.options.push(...options);
    if (this.#data.options.length > 25) {
      throw new Error('Select menus cannot have more than 25 options.');
    }
    return this;
  }

  setOptions(...options: SelectMenuOption[]): this {
    this.#data.options = [];
    return this.addOptions(...options);
  }

  spliceOptions(index: number, deleteCount: number, ...options: SelectMenuOption[]): this {
    if (!this.#data.options) this.#data.options = [];
    this.#data.options.splice(index, deleteCount, ...options);
    return this;
  }

  setChannelTypes(...types: number[]): this {
    this.#data.channel_types = types;
    return this;
  }

  get data(): SelectMenuData {
    if (!this.#data.custom_id) {
      throw new Error('Select menu must have a custom_id set.');
    }
    return this.#data as SelectMenuData;
  }

  toJSON(): SelectMenuData {
    return this.data;
  }
}
