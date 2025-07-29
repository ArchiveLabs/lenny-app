"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Gradient = Gradient;
const jsx_runtime_1 = require("react/jsx-runtime");
function Gradient({ conic, className, small, }) {
    return ((0, jsx_runtime_1.jsx)("span", { className: `ui:absolute ui:mix-blend-normal ui:will-change-[filter] ui:rounded-[100%] ${small ? "ui:blur-[32px]" : "ui:blur-[75px]"} ${conic
            ? "ui:bg-[conic-gradient(from_180deg_at_50%_50%,var(--red-1000)_0deg,_var(--purple-1000)_180deg,_var(--blue-1000)_360deg)]"
            : ""} ${className ?? ""}` }));
}
