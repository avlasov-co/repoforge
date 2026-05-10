#!/usr/bin/env python3
import ast
import json
import sys


def signature_for(node):
    args = []
    all_args = list(getattr(node.args, "posonlyargs", [])) + list(node.args.args)
    args.extend(arg.arg for arg in all_args)
    if node.args.vararg:
        args.append("*" + node.args.vararg.arg)
    args.extend(arg.arg for arg in node.args.kwonlyargs)
    if node.args.kwarg:
        args.append("**" + node.args.kwarg.arg)
    suffix = ", ..." if len(args) > 4 else ""
    shown = args[:4]
    return f"{node.name}({', '.join(shown)}{suffix})"


def import_text(node):
    if isinstance(node, ast.Import):
        return "import " + ", ".join(alias.name for alias in node.names)
    if isinstance(node, ast.ImportFrom):
        module = "." * node.level + (node.module or "")
        names = ", ".join(alias.name for alias in node.names)
        return f"from {module} import {names}"
    return None


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"imports": [], "symbols": [], "diagnostics": ["expected one file path argument"]}))
        return 2

    path = sys.argv[1]
    diagnostics = []
    try:
        with open(path, "r", encoding="utf-8") as handle:
            source = handle.read()
    except Exception as exc:
        print(json.dumps({"imports": [], "symbols": [], "diagnostics": [f"read failed: {exc}"]}))
        return 0

    try:
        tree = ast.parse(source, filename=path)
    except SyntaxError as exc:
        message = f"syntax error: {exc.msg} at line {exc.lineno or 0}"
        print(json.dumps({"imports": [], "symbols": [], "diagnostics": [message]}))
        return 0

    imports = []
    symbols = []

    for node in ast.walk(tree):
        text = import_text(node)
        if text and text not in imports:
            imports.append(text)

    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            symbols.append({"name": node.name, "kind": "class", "line": node.lineno, "signature": f"class {node.name}"})
            for child in node.body:
                if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    name = f"{node.name}.{child.name}"
                    symbols.append({"name": name, "kind": "method", "line": child.lineno, "signature": signature_for(child)})
                    symbols.append({"name": child.name, "kind": "method", "line": child.lineno, "signature": signature_for(child)})
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            symbols.append({"name": node.name, "kind": "function", "line": node.lineno, "signature": signature_for(node)})
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            for target in targets:
                if isinstance(target, ast.Name) and target.id.isupper():
                    symbols.append({"name": target.id, "kind": "const", "line": node.lineno, "signature": target.id})

    print(json.dumps({"imports": imports[:80], "symbols": symbols, "diagnostics": diagnostics}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
