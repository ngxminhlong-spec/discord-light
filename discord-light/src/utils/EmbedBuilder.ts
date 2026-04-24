export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface EmbedAuthor {
  name: string;
  url?: string;
  icon_url?: string;
}

export interface EmbedFooter {
  text: string;
  icon_url?: string;
}

export interface EmbedImage {
  url: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

export interface EmbedData {
  title?: string;
  type?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: EmbedFooter;
  image?: EmbedImage;
  thumbnail?: EmbedImage;
  video?: EmbedImage;
  provider?: { name?: string; url?: string };
  author?: EmbedAuthor;
  fields?: EmbedField[];
}

export class EmbedBuilder {
  #data: EmbedData = {};

  static from(data: EmbedData): EmbedBuilder {
    const builder = new EmbedBuilder();
    builder.#data = { ...data };
    return builder;
  }

  setTitle(title: string): this {
    this.#data.title = title;
    return this;
  }

  setDescription(description: string): this {
    this.#data.description = description;
    return this;
  }

  setURL(url: string): this {
    this.#data.url = url;
    return this;
  }

  setColor(color: number | string | [number, number, number]): this {
    if (typeof color === 'number') {
      this.#data.color = color;
    } else if (typeof color === 'string') {
      this.#data.color = parseInt(color.replace('#', ''), 16);
    } else if (Array.isArray(color)) {
      this.#data.color = (color[0] << 16) | (color[1] << 8) | color[2];
    }
    return this;
  }

  setTimestamp(timestamp: Date | number | string = new Date()): this {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    this.#data.timestamp = date.toISOString();
    return this;
  }

  setFooter(options: { text: string; iconURL?: string }): this {
    this.#data.footer = {
      text: options.text,
      icon_url: options.iconURL,
    };
    return this;
  }

  setImage(url: string): this {
    this.#data.image = { url };
    return this;
  }

  setThumbnail(url: string): this {
    this.#data.thumbnail = { url };
    return this;
  }

  setAuthor(options: { name: string; url?: string; iconURL?: string }): this {
    this.#data.author = {
      name: options.name,
      url: options.url,
      icon_url: options.iconURL,
    };
    return this;
  }

  addField(field: EmbedField): this;
  addField(name: string, value: string, inline?: boolean): this;
  addField(nameOrField: string | EmbedField, value?: string, inline?: boolean): this {
    if (!this.#data.fields) this.#data.fields = [];

    if (typeof nameOrField === 'string') {
      this.#data.fields.push({ name: nameOrField, value: value ?? '', inline });
    } else {
      this.#data.fields.push(nameOrField);
    }

    if (this.#data.fields.length > 25) {
      throw new Error('Embeds cannot have more than 25 fields.');
    }

    return this;
  }

  addFields(...fields: EmbedField[]): this {
    for (const field of fields) {
      this.addField(field);
    }
    return this;
  }

  setFields(...fields: EmbedField[]): this {
    this.#data.fields = [];
    return this.addFields(...fields);
  }

  spliceFields(index: number, deleteCount: number, ...fields: EmbedField[]): this {
    if (!this.#data.fields) this.#data.fields = [];
    this.#data.fields.splice(index, deleteCount, ...fields);
    return this;
  }

  setVideo(url: string): this {
    this.#data.video = { url };
    return this;
  }

  setProvider(name: string, url?: string): this {
    this.#data.provider = { name, url };
    return this;
  }

  get data(): EmbedData {
    return { ...this.#data };
  }

  toJSON(): EmbedData {
    return this.data;
  }

  get length(): number {
    let len = 0;
    if (this.#data.title) len += this.#data.title.length;
    if (this.#data.description) len += this.#data.description.length;
    if (this.#data.footer?.text) len += this.#data.footer.text.length;
    if (this.#data.author?.name) len += this.#data.author.name.length;
    if (this.#data.fields) {
      for (const f of this.#data.fields) {
        len += f.name.length + f.value.length;
      }
    }
    return len;
  }

  validate(): void {
    if (this.length > 6000) {
      throw new Error(`Embed total character count (${this.length}) exceeds 6000.`);
    }
    if (this.#data.title && this.#data.title.length > 256) {
      throw new Error('Embed title cannot exceed 256 characters.');
    }
    if (this.#data.description && this.#data.description.length > 4096) {
      throw new Error('Embed description cannot exceed 4096 characters.');
    }
    if (this.#data.footer?.text && this.#data.footer.text.length > 2048) {
      throw new Error('Embed footer text cannot exceed 2048 characters.');
    }
    if (this.#data.author?.name && this.#data.author.name.length > 256) {
      throw new Error('Embed author name cannot exceed 256 characters.');
    }
    if (this.#data.fields) {
      for (const f of this.#data.fields) {
        if (f.name.length > 256) throw new Error('Embed field name cannot exceed 256 characters.');
        if (f.value.length > 1024) throw new Error('Embed field value cannot exceed 1024 characters.');
      }
    }
  }
}
