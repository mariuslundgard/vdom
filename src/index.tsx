import { createElement, diff, patch, toVNode } from "./vdom";

function Button({ children, on }: any) {
  return (
    <button
      hook={{ didInsert: "insert", didUpdate: "update" }}
      style="background: #ccc;"
      on={on}
    >
      {children}
    </button>
  );
}

function view() {
  return (
    <div id="app" style="color: red;">
      <h1>App</h1>
      <p style="color: black">testing, testing</p>
      <div>
        <Button on={{ click: "click" }}>testing</Button>
      </div>
    </div>
  );
}

function handleEvent(value, event) {
  console.log("handleEvent", value);
}

function handleHook(value, element) {
  console.log("handleHook", value, element);
}

const appElement = document.getElementById("app");
const initialVNode = toVNode(appElement);

console.log(
  patch(appElement, diff(initialVNode, view()), handleEvent, handleHook)
);
