import { ButtonStyle, MessageComponentType } from './Constants.js';

export interface ButtonData {
  type: MessageComponentType.BUTTON;
  style: ButtonStyle;
  label?: string;
  emoji?: { id?: string; name?: string; animated?: boolean };
  custom_id?: string;
  url?: string;
  disabled?: boolean;
  sku_id?: string;
}

export class ButtonBuilder {
  #data: Partial<ButtonData> = { type: MessageComponentType.BUTTON };

  static from(data: ButtonData): ButtonBuilder {
    const builder = new ButtonBuilder();
    builder.#data = { ...data };
    return builder;
  }

  setStyle(style: ButtonStyle): this {
    this.#data.style = style;
    return this;
  }

  setLabel(label: string): this {
    this.#data.label = label;
    return this;
  }

  setEmoji(emoji: string | { name?: string; id?: string; animated?: boolean }): this {
    if (typeof emoji === 'string') {
      this.#data.emoji = { name: emoji };
    } else {
      this.#data.emoji = emoji;
    }
    return this;
  }

  setCustomId(id: string): this {
    this.#data.custom_id = id;
    return this;
  }

  setURL(url: string): this {
    this.#data.style = ButtonStyle.LINK;
    this.#data.url = url;
    return this;
  }

  setDisabled(disabled = true): this {
    this.#data.disabled = disabled;
    return this;
  }

  setSKUId(skuId: string): this {
    this.#data.sku_id = skuId;
    return this;
  }

  get data(): ButtonData {
    if (!this.#data.style) {
      throw new Error('Button must have a style set.');
    }
    if (this.#data.style === ButtonStyle.LINK) {
      if (!this.#data.url) {
        throw new Error('Link buttons must have a URL.');
      }
    } else {
      if (!this.#data.custom_id) {
        throw new Error('Non-link buttons must have a custom_id.');
      }
    }
    return this.#data as ButtonData;
  }

  toJSON(): ButtonData {
    return this.data;
  }
}
