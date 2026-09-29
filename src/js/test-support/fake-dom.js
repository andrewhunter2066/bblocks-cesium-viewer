// Just enough DOM for the plugin's lifecycle and UI tests under Node's test runner (no jsdom
// dependency).

class FakeEventTarget {
  constructor() {
    this.listeners = {};
  }

  addEventListener(type, listener) {
    (this.listeners[type] ??= []).push(listener);
  }

  removeEventListener(type, listener) {
    this.listeners[type] = (this.listeners[type] ?? []).filter(l => l !== listener);
  }

  dispatch(type) {
    const event = { type, target: this, stopPropagation() {}, preventDefault() {} };
    (this.listeners[type] ?? []).forEach(l => l(event));
    return event;
  }

  listenerCount(type) {
    return (this.listeners[type] ?? []).length;
  }
}

export class FakeElement extends FakeEventTarget {
  constructor(tagName, ownerDocument) {
    super();
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parent = null;
    this.style = { cssText: '' };
    this.textContent = '';
    this.innerHTML = '';
    this.id = '';
    this.className = '';
    this.hidden = false;
    this.dataset = {};
    this.attributes = {};
    this.clientHeight = 0;
    this.fullscreenRequests = 0;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  appendChild(child) {
    child.parent?.removeChild(child);
    child.parent = this;
    this.children.push(child);
    return child;
  }

  append(...children) {
    children.forEach(c => (typeof c === 'string' ? this.appendChild(Object.assign(new FakeElement('#text', this.ownerDocument), { textContent: c })) : this.appendChild(c)));
  }

  removeChild(child) {
    this.children = this.children.filter(c => c !== child);
    child.parent = null;
  }

  remove() {
    this.parent?.removeChild(this);
  }

  replaceChildren(...children) {
    [...this.children].forEach(c => this.removeChild(c));
    this.append(...children);
  }

  click() {
    return this.dispatch('click');
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  requestFullscreen() {
    this.fullscreenRequests += 1;
    this.ownerDocument.fullscreenElement = this;
    this.ownerDocument.dispatch('fullscreenchange');
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

  findAll(predicate) {
    return this.children.flatMap(child => [...(predicate(child) ? [child] : []), ...child.findAll(predicate)]);
  }

  // Supports only `[data-key="…"]`, which is all the plugin queries.
  querySelector(selector) {
    const key = /^\[data-key="(.*)"\]$/.exec(selector)?.[1];
    return key === undefined ? null : this.find(el => el.dataset?.key === key);
  }

  get allText() {
    return [this.textContent, ...this.children.map(c => c.allText)].join(' ').trim();
  }
}

export class FakeDocument extends FakeEventTarget {
  constructor() {
    super();
    this.documentElement = new FakeElement('html', this);
    this.head = this.documentElement.appendChild(new FakeElement('head', this));
    this.body = this.documentElement.appendChild(new FakeElement('body', this));
    this.fullscreenElement = null;
    this.activeElement = null;
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  getElementById(id) {
    return this.documentElement.find(el => el.id === id);
  }

  exitFullscreen() {
    this.fullscreenElement = null;
    this.dispatch('fullscreenchange');
  }
}

// Installs a fresh FakeDocument as globalThis.document (plus the CSS.escape the UI uses);
// returns it plus a restore function.
export function installFakeDocument() {
  const previous = { document: globalThis.document, CSS: globalThis.CSS };
  const doc = new FakeDocument();
  globalThis.document = doc;
  globalThis.CSS ??= { escape: value => String(value) };
  return {
    doc,
    restore: () => {
      for (const [name, value] of Object.entries(previous)) {
        if (value === undefined) delete globalThis[name];
        else globalThis[name] = value;
      }
    },
  };
}
