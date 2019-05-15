const noop = () => void 0;

function isElement(vNode: any) {
  return typeof vNode === "object" && typeof vNode.tag === "string";
}

function isComponent(vNode: any) {
  return typeof vNode === "object" && typeof vNode.fn === "function";
}

export function createElement(
  tag: string | Function,
  props: any,
  ...inputChildren: any[]
) {
  const children = inputChildren
    .reduce(
      (arr: any[], c: any) =>
        Array.isArray(c) ? arr.concat(c) : arr.concat([c]),
      []
    )
    .filter(
      (c: any) =>
        c !== null &&
        c !== undefined &&
        (typeof c !== "boolean" || Boolean(c) !== false)
    );

  if (typeof tag === "function") {
    // return component
    return { fn: tag, props: { ...(props || {}), children } };
  }

  return { tag, props, children };
}

export function toVNode(node: Node) {
  if (node.nodeType === 1) {
    return {
      tag: node.nodeName.toLowerCase(),
      props: undefined,
      children: Array.from(node.childNodes).map(toVNode)
    };
  }

  if (node.nodeType === 3) {
    return node.nodeValue;
  }

  // if (node.nodeType === 8) {
  //   return { type: "comment", text: node.nodeValue };
  // }

  throw new Error(`Unexpected node type: ${node.nodeType}`);
}

function addListeners(element, listeners, handleEvent) {
  Object.keys(listeners).forEach(listenerKey => {
    element.addEventListener(listenerKey, event => {
      handleEvent(listeners[listenerKey], event);
    });
  });
}

function createNode(vNode: any, handleEvent) {
  if (typeof vNode === "string") {
    return document.createTextNode(vNode);
  }

  if (isElement(vNode)) {
    const element = document.createElement(vNode.tag);

    if (vNode.props) {
      Object.keys(vNode.props).forEach(propKey => {
        if (propKey === "on") {
          addListeners(element, vNode.props.on, handleEvent);
        } else if (propKey === "hook") {
          // do nothing
        } else {
          element.setAttribute(propKey, vNode.props[propKey]);
        }
      });
    }

    vNode.children.forEach(childVNode => {
      element.appendChild(createNode(childVNode, handleEvent));
    });

    return element;
  }

  if (isComponent(vNode)) {
    return createNode(vNode.fn(vNode.props), handleEvent);
  }

  throw new Error("Could not recognize node");
}

function diffProps(a, b) {
  const patches = [];

  if (a.props) {
    Object.keys(a.props).forEach(propKey => {
      if (!b.props.hasOwnProperty(propKey)) {
        patches.push({ type: "removeProp", key: propKey });
      }
    });
  }

  if (b.props) {
    Object.keys(b.props).forEach(propKey => {
      const aValue = a.props && a.props[propKey];
      const bValue = b.props[propKey];

      if (aValue !== bValue) {
        patches.push({ type: "setProp", key: propKey, value: bValue });
      }
    });
  }

  return patches;
}

function diffVNodes(a, b) {
  if (a.tag === b.tag) {
    const len = Math.max(a.children.length, b.children.length);

    let patches = diffProps(a, b);

    for (let i = 0; i < len; i += 1) {
      if (!a.children[i]) {
        patches.push({ type: "insert", node: b.children[i] });
      } else {
        const childPatches = diff(a.children[i], b.children[i]);

        if (childPatches.length) {
          patches.push({ type: "push", index: i });
          patches = patches.concat(childPatches);
          patches.push({ type: "pop" });
        }
      }
    }

    return patches;
  }

  return [{ type: "replace", node: b }];
}

function expand(vNode) {
  if (isComponent(vNode)) {
    return expand(vNode.fn(vNode.props));
  }

  return vNode;
}

export function diff(_a, _b) {
  const a = expand(_a);
  const b = expand(_b);

  switch (true) {
    case isElement(a) && isElement(b):
      return diffVNodes(a, b);

    case !a:
      return [{ type: "insert", node: b }];

    case !b:
      return [{ type: "remove" }];

    default:
      return [{ type: "replace", node: b }];
  }
}

function triggerHook(element, node, key, handleHook) {
  if (
    isElement(node) &&
    node.props &&
    node.props.hook &&
    node.props.hook[key]
  ) {
    handleHook(node.props.hook[key], element);
  }
}

function triggerHooks(node, vNode, hookKey, handleHook) {
  // TODO:
  if (!vNode) return;

  vNode.children.forEach((childVNode, i) => {
    if (isElement(childVNode)) {
      triggerHook(node.childNodes[i], childVNode, hookKey, handleHook);
    }
  });

  triggerHook(node, vNode, hookKey, handleHook);
}

export function patch(
  element,
  patches,
  handleEvent: any = noop,
  handleHook: any = noop
) {
  const len = patches.length;
  const nodePath = [element];

  let node = element;

  for (let i = 0; i < len; i += 1) {
    const patch = patches[i];

    switch (patch.type) {
      case "push":
        node = node.childNodes[patch.index];
        nodePath.push(node);
        break;
      case "pop":
        nodePath.pop();
        node = nodePath[nodePath.length - 1];
        break;
      case "replace": {
        const newNode = createNode(patch.node, handleEvent);
        node.parentNode.insertBefore(newNode, node);
        node.parentNode.removeChild(node);
        nodePath.pop();
        nodePath.push(newNode);
        triggerHooks(newNode, patch.node, "didInsert", handleHook);
        node = newNode;
        break;
      }
      case "remove":
        node.parentNode.removeChild(node);
        break;
      case "insert": {
        const newNode = createNode(patch.node, handleEvent);
        node.appendChild(newNode);
        triggerHooks(newNode, patch.node, "didInsert", handleHook);
        break;
      }
      case "setProp":
        node.setAttribute(patch.key, patch.value);
        triggerHooks(node, patch.node, "didUpdate", handleHook);
        break;
      default:
        throw new Error(`Unknown patch: ${patch.type}`);
    }
  }

  return node;
}
