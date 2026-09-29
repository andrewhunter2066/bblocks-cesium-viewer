// Just enough DOM for the plugin's lifecycle tests under Node's test runner (no jsdom dependency).

export class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parent = null;
    this.style = { cssText: '' };
    this.textContent = '';
    this.id = '';
  }

  appendChild(child) {
    child.parent?.removeChild(child);
    child.parent = this;
    this.children.push(child);
    return child;
  }

  append(...children) {
    children.forEach(c => this.appendChild(c));
  }

  removeChild(child) {
    this.children = this.children.filter(c => c !== child);
    child.parent = null;
  }

  remove() {
    this.parent?.removeChild(this);
  }

  replaceChildren() {
    [...this.children].forEach(c => this.removeChild(c));
  }

  get isConnected() {
    let node = this;
    while (node.parent) node = node.parent;
    return node === this.ownerDocument.documentElement;
  }

  // Depth-first search of this element's subtree.
  find(predicate) {
    for (const child of this.children) {
      if (predicate(child)) return child;
      const found = child.find(predicate);
      if (found) return found;
    }
    return null;
  }

  get allText() {
    return [this.textContent, ...this.children.map(c => c.allText)].join(' ').trim();
  }
}

export class FakeDocument {
  constructor() {
    this.documentElement = new FakeElement('html', this);
    this.head = this.documentElement.appendChild(new FakeElement('head', this));
    this.body = this.documentElement.appendChild(new FakeElement('body', this));
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  getElementById(id) {
    return this.documentElement.find(el => el.id === id);
  }
}

// Installs a fresh FakeDocument as globalThis.document; returns it plus a restore function.
export function installFakeDocument() {
  const previous = globalThis.document;
  const doc = new FakeDocument();
  globalThis.document = doc;
  return {
    doc,
    restore: () => {
      if (previous === undefined) delete globalThis.document;
      else globalThis.document = previous;
    },
  };
}
