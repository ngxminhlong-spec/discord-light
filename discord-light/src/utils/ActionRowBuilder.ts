import { MessageComponentType } from './Constants.js';
import { ButtonBuilder, type ButtonData } from './ButtonBuilder.js';
import { SelectMenuBuilder, type SelectMenuData } from './SelectMenuBuilder.js';

type ComponentLike = ButtonBuilder | SelectMenuBuilder | ButtonData | SelectMenuData | Record<string, unknown>;

export interface ActionRowData {
  type: MessageComponentType.ACTION_ROW;
  components: (ButtonData | SelectMenuData | Record<string, unknown>)[];
}

export class ActionRowBuilder {
  #components: ActionRowData['components'] = [];

  static from(data: ActionRowData): ActionRowBuilder {
    const builder = new ActionRowBuilder();
    builder.#components = [...data.components];
    return builder;
  }

  addComponents(...components: ComponentLike[]): this {
    for (const comp of components) {
      if (comp instanceof ButtonBuilder) {
        this.#components.push(comp.data);
      } else if (comp instanceof SelectMenuBuilder) {
        this.#components.push(comp.data);
      } else {
        this.#components.push(comp as ActionRowData['components'][number]);
      }
    }
    if (this.#components.length > 5) {
      throw new Error('Action rows cannot have more than 5 components.');
    }
    return this;
  }

  setComponents(...components: ComponentLike[]): this {
    this.#components = [];
    return this.addComponents(...components);
  }

  spliceComponents(index: number, deleteCount: number, ...components: ComponentLike[]): this {
    const resolved: ActionRowData['components'] = [];
    for (const comp of components) {
      if (comp instanceof ButtonBuilder) {
        resolved.push(comp.data);
      } else if (comp instanceof SelectMenuBuilder) {
        resolved.push(comp.data);
      } else {
        resolved.push(comp as ActionRowData['components'][number]);
      }
    }
    this.#components.splice(index, deleteCount, ...resolved);
    return this;
  }

  get components(): ActionRowData['components'] {
    return [...this.#components];
  }

  get data(): ActionRowData {
    return {
      type: MessageComponentType.ACTION_ROW,
      components: this.#components,
    };
  }

  toJSON(): ActionRowData {
    return this.data;
  }
}
