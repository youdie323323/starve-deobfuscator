import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";
import { readFileSync, writeFileSync } from 'fs'
import { webcrack } from 'webcrack';
import { minify } from "terser";

// Starve client deobfuscator made by youdi3

(async function () {
    console.log("Reading obfuscated build");

    const obfuscatedCode = readFileSync("./input/obfuscated.js").toString();

    console.log("Running Terser minify");

    const minified = await minify(obfuscatedCode, {
        mangle: {
            keep_classnames: false,
            keep_fnames: false,
            module: true,
            properties: false,
            reserved: [],
            toplevel: true,
        },
    });

    console.log("Parsing minified code");

    const ast = parser.parse(minified.code!);

    console.log("Running transformations");

    let currentObjectNumberIndex = 0;
    const objectNumberMap = new Map<string, { prop: string; value: number }[]>();

    let encodedCharArrays: number[][] = [];
    let encodedCharVarName = "";
    let decodedStrings1: string[] = [];

    traverse(ast, {
        AssignmentExpression(path) {
            const { right, left } = path.node;
            if (t.isArrayExpression(right) && !right.elements.some(e => !t.isArrayExpression(e)) && right.elements.length > 20) {
                encodedCharArrays = right.elements.map(e =>
                    t.isArrayExpression(e) && !e.elements.some(e => !t.isNumericLiteral(e))
                        ? e.elements.map(e2 => (t.isNumericLiteral(e2) ? e2.value : 0))
                        : []
                );
                if (t.isIdentifier(left)) {
                    encodedCharVarName = left.name;
                }
            }
        },
    });

    traverse(ast, {
        //for (let Δⵠ = 00; Δⵠ < Ⲇᐃ['\x6c\x65\x6e\147\x74\150']; Δⵠ++)
        //  Ⲇᐃ[Δⵠ] = ⵠⲆ['\x61\164\157\142'](ᐃΔΔ(Ⲇᐃ[Δⵠ]));
        ForStatement(path) {
            const { test, body } = path.node;
            if (
                t.isBinaryExpression(test) &&
                t.isMemberExpression(test.right) &&
                t.isIdentifier(test.right.object) &&
                test.right.object.name === encodedCharVarName &&
                t.isExpressionStatement(body) &&
                t.isAssignmentExpression(body.expression) &&
                t.isMemberExpression(body.expression.left) &&
                t.isIdentifier(body.expression.left.object) &&
                body.expression.left.object.name === encodedCharVarName &&
                t.isCallExpression(body.expression.right) &&
                body.expression.right.arguments.length === 1 &&
                t.isCallExpression(body.expression.right.arguments[0]) &&
                t.isIdentifier(body.expression.right.arguments[0].callee)
            ) {
                const binding = path.scope.getBinding(body.expression.right.arguments[0].callee.name);
                if (binding) {
                    path.remove();
                    const { init: funcInit } = binding.path.node as t.VariableDeclarator;

                    //const Ⲇᐃᐃ = function(t) {
                    //    let n = "";
                    //    for (let r = 0; r < t.length; r++) n += window.String.fromCharCode(t[r] ^ ⲆΔ++ % 255);
                    //    return n
                    //};
                    if (
                        t.isFunctionExpression(funcInit) &&
                        funcInit.body.body.length === 3 &&
                        t.isForStatement(funcInit.body.body[1]) &&
                        t.isExpressionStatement(funcInit.body.body[1].body) &&
                        t.isAssignmentExpression(funcInit.body.body[1].body.expression) &&
                        t.isCallExpression(funcInit.body.body[1].body.expression.right) &&
                        funcInit.body.body[1].body.expression.right.arguments.length === 1 &&
                        t.isBinaryExpression(funcInit.body.body[1].body.expression.right.arguments[0]) &&
                        t.isBinaryExpression(funcInit.body.body[1].body.expression.right.arguments[0].right) &&
                        t.isUpdateExpression(funcInit.body.body[1].body.expression.right.arguments[0].right.left) &&
                        t.isIdentifier(funcInit.body.body[1].body.expression.right.arguments[0].right.left.argument)
                    ) {
                        const keyVar = binding.path.scope.getBinding(funcInit.body.body[1].body.expression.right.arguments[0].right.left.argument.name)?.path.node;
                        if (keyVar && t.isNumericLiteral(keyVar["init"])) {
                            let key = keyVar["init"]["value"];
                            encodedCharArrays.forEach(arr => {
                                let decodedStr = "";
                                for (let i = 0; i < arr.length; i++) {
                                    decodedStr += String.fromCharCode(arr[i] ^ (key++ % 255));
                                }
                                decodedStrings1.push(atob(decodedStr));
                            });
                        }
                    }
                }
            }
        },
    });

    let decodedStringArrayName = "";
    let decodedStrings2: string[] = [];
    traverse(ast, {
        VariableDeclarator(path) {
            const { id, init } = path.node;
            if (
                t.isIdentifier(id) &&
                t.isArrayExpression(init) &&
                init.elements.length > 20 &&
                !init.elements.some(e => !t.isStringLiteral(e))
            ) {
                decodedStringArrayName = id.name;
                decodedStrings2 = init.elements.map(e => (t.isStringLiteral(e) ? e.value : ""));
            }
        },
    });

    const usageCounts = new Map<string, number>();
    traverse(ast, {
        UpdateExpression(path) {
            const { operator, prefix, argument } = path.node;
            if (operator === "++" && !prefix && t.isIdentifier(argument)) {
                usageCounts.set(argument.name, (usageCounts.get(argument.name) || 0) + 1);
            }
        },
    });

    const mostUsedVar = Array.from(usageCounts.entries()).reduce((acc, [key, value]) => {
        if (value > acc.value) {
            acc.key = key;
            acc.value = value;
        }
        return acc;
    }, { key: "", value: 0 });

    const cloneArrayMap = <T, E, N extends Map<T, Array<E>>>(inputMap: N): N => {
        const clonedMap = new (inputMap.constructor as { new(): N })();
        inputMap.forEach((values, key) => {
            clonedMap.set(key, values.slice(0));
        });
        return clonedMap;
    };

    traverse(ast, {
        ExpressionStatement(path) {
            if (
                t.isAssignmentExpression(path.node.expression) &&
                path.node.expression.operator == "=" &&
                t.isIdentifier(path.node.expression.left) &&
                path.node.expression.left.name === encodedCharVarName
            ) {
                path.remove()
            }
        },
        MemberExpression(path) {
            if (t.isIdentifier(path.node.object) && (path.node.object.name == encodedCharVarName || path.node.object.name == decodedStringArrayName)) {
                if (t.isNumericLiteral(path.node.property)) {
                    if (!(t.isAssignmentExpression(path.parent) && path.parent.left === path.node)) {
                        path.replaceWith(t.stringLiteral((path.node.object.name == encodedCharVarName ? decodedStrings1 : decodedStrings2)[path.node.property.value]));
                    }
                } else if (t.isIdentifier(path.node.property)) {
                    let binding = path.scope.getBinding(path.node.property.name);
                    while (binding && t.isVariableDeclarator(binding.path.node) && binding.kind == "const" && t.isIdentifier(binding.path.node.init)) {
                        binding = path.scope.getBinding(binding.path.node.init.name);
                    }
                    if (binding && t.isVariableDeclarator(binding.path.node) && binding.kind == "const" && t.isNumericLiteral(binding.path.node.init)) {
                        path.replaceWith(t.stringLiteral((path.node.object.name == encodedCharVarName ? decodedStrings1 : decodedStrings2)[binding.path.node.init.value]));
                    }
                }
            }
        },

        //var cc = 0;
        //var s = {
        //  c: cc++,
        //}
        //console.log(s.c)
        //->
        //var cc = 0;
        //var s = {
        //  c: 0,
        //}
        //console.log(0)
        "AssignmentExpression|VariableDeclarator"(path) {
            const rightOrInit = t.isAssignmentExpression(path.node) ? "right" : "init";
            const leftOrId = t.isAssignmentExpression(path.node) ? "left" : "id";

            if (t.isIdentifier(path.node[leftOrId], { name: mostUsedVar.key })) {
                if (t.isNumericLiteral(path.node[rightOrInit])) {
                    currentObjectNumberIndex = path.node[rightOrInit].value;
                } else if (t.isIdentifier(path.node[rightOrInit])) {
                    let binding = path.scope.getBinding(path.node[rightOrInit].name);
                    while (binding && t.isVariableDeclarator(binding.path.node) && binding.kind == "const" && binding.path.node.init && t.isIdentifier(binding.path.node.init)) {
                        binding = path.scope.getBinding(binding.path.node.init.name);
                    }
                    if (binding && t.isVariableDeclarator(binding.path.node) && binding.kind == "const" && t.isNumericLiteral(binding.path.node.init)) {
                        currentObjectNumberIndex = binding.path.node.init.value;
                    }
                }
            }
        },
        ObjectExpression(path) {
            path.node.properties.forEach((p) => {
                if (t.isObjectProperty(p) && (t.isStringLiteral(p.key) || t.isIdentifier(p.key)) && t.isUpdateExpression(p.value) && p.value.operator === "++" && t.isIdentifier(p.value.argument, { name: mostUsedVar.key })) {
                    if (t.isSequenceExpression(path.parent)) {
                        path.parent.expressions.forEach((e) => {
                            if (e === path.node) {
                                const assignOrDeclareName = path.parentPath.parent[t.isVariableDeclarator(path.parentPath.parent) ? "id" : "left"].name;
                                if (objectNumberMap.get(assignOrDeclareName) == undefined) {
                                    objectNumberMap.set(assignOrDeclareName, [])
                                }

                                var te = cloneArrayMap(objectNumberMap).get(assignOrDeclareName);
                                te?.push({
                                    value: currentObjectNumberIndex,
                                    prop: p.key[t.isStringLiteral(p.key) ? "value" : "name"],
                                });

                                objectNumberMap.set(assignOrDeclareName, te!)
                                p.value = t.numericLiteral(currentObjectNumberIndex);
                                currentObjectNumberIndex++;
                            }
                        })
                    } else {
                        const assignOrDeclareName = path.parent[t.isVariableDeclarator(path.parent) ? "id" : "left"].name;
                        if (objectNumberMap.get(assignOrDeclareName) == undefined) {
                            objectNumberMap.set(assignOrDeclareName, [])
                        }

                        var te = cloneArrayMap(objectNumberMap).get(assignOrDeclareName);
                        te?.push({
                            value: currentObjectNumberIndex,
                            prop: p.key[t.isStringLiteral(p.key) ? "value" : "name"],
                        });

                        objectNumberMap.set(assignOrDeclareName, te!)
                        p.value = t.numericLiteral(currentObjectNumberIndex);
                        currentObjectNumberIndex++;
                    }
                }
            });
        },
    });

    traverse(ast, {
        MemberExpression(path) {
            objectNumberMap.forEach((e, k) => {
                if (t.isIdentifier(path.node.object) && path.node.object.name == k) {
                    e.forEach((b) => {
                        if (t.isIdentifier(path.node.property) && path.node.property.name == b.prop) {
                            path.replaceWith(t.numericLiteral(b.value));
                        }
                    })
                }
            });
        },
        //const a = 3;
        //const Na = a;
        //const c = {
        //  bb: Na,
        //}
        //->
        //const a = 3;
        //const Na = a;
        //const c = {
        //  bb: 3
        //};
        Identifier(path) {
            if (
                t.isVariableDeclarator(path.parent) && path.key === 'id' ||
                t.isMemberExpression(path.parent) && path.parent.computed !== true ||
                t.isObjectProperty(path.parent) && path.parent.key === path.node
            ) {
                return;
            }

            let binding = path.scope.getBinding(path.node.name);
            while (binding && t.isVariableDeclarator(binding.path.node) && binding.kind == "const" && t.isIdentifier(binding.path.node.init)) {
                binding = path.scope.getBinding(binding.path.node.init.name);
            }
            if (binding && t.isVariableDeclarator(binding.path.node) && binding.kind == "const" && t.isLiteral(binding.path.node.init)) {
                path.replaceWith(t.cloneNode(binding.path.node.init));
            }
        },
    });

    traverse(ast, {
        //const c = {
        //  na: 3,
        //}
        //console.log(c.na);
        //->
        //const c = {
        //  na: 3,
        //}
        //console.log(3)
        MemberExpression(path) {
            if (t.isIdentifier(path.node.object)) {
                let binding = path.scope.getBinding(path.node.object.name);
                if (!binding || path.node.computed) {
                    return;
                }
                if (t.isAssignmentExpression(path.parent) && path.parent.left == path.node) {
                    return;
                }
                if (binding.referencePaths && binding.referencePaths.length != 0) {
                    if (
                        binding.referencePaths[0].state &&
                        binding.referencePaths[0].state.assignments &&
                        binding.referencePaths[0].state.assignments.length != 0
                    ) {
                        let last: any = null;
                        binding.referencePaths[0].state.assignments.forEach((e) => {
                            if (t.isObjectExpression(e.node.right) && t.isIdentifier(e.node.left) && e.node.left.name == path.node.object["name"]) {
                                last = e.node;
                            }
                        })
                        if (last == null) return;
                        if (t.isObjectExpression(last.right)) {
                            last.right.properties.forEach((e) => {
                                if (
                                    t.isObjectProperty(e) &&
                                    (t.isIdentifier(e.key) || t.isStringLiteral(e.key)) &&
                                    t.isIdentifier(path.node.property) &&
                                    e.key[t.isStringLiteral(e.key) ? "value" : "name"] === path.node.property.name &&
                                    t.isLiteral(e.value) &&
                                    e.computed !== true
                                ) {
                                    path.replaceWith(e.value);
                                }
                            });
                            return;
                        }
                    }
                }

                if (
                    t.isVariableDeclarator(binding.path.node) &&
                    t.isObjectExpression(binding.path.node.init)
                ) {
                    binding.path.node.init.properties.forEach((e) => {
                        if (
                            t.isObjectProperty(e) &&
                            (t.isIdentifier(e.key) || t.isStringLiteral(e.key)) &&
                            t.isIdentifier(path.node.property) &&
                            e.key[t.isStringLiteral(e.key) ? "value" : "name"] === path.node.property.name &&
                            t.isLiteral(e.value) &&
                            e.computed !== true
                        ) {
                            path.replaceWith(e.value);
                        }
                    });
                }
            }
        },
    })

    //delete anti deobfuscator
    traverse(ast, {
        IfStatement(path) {
            if (
                t.isBinaryExpression(path.node.test) &&
                t.isCallExpression(path.node.test.right) &&
                path.node.test.right.arguments.length == 2 &&
                t.isNewExpression(path.node.test.right.callee) &&
                t.isIdentifier(path.node.test.right.callee.callee) &&
                path.node.test.right.callee.callee.name == "Function"
            ) {
                path.remove();
            }

            //function Ez(e) {
            //    return e > 0 ? e * e : e;
            //}
            //function Sz(i) {
            //  return e.String.fromCharCode(i);
            //}
            //var Qz;
            //if (0 === (Qz = [11616, 5123, 11616, 11398, 5123, 11616, 11398].map(Sz).join(""), -1 !== Ez["toString"]().indexOf(Qz) ? 1 : 0)) {
            //  const i = function () {
            //    for (let t = 0; t < 5; t++) e["addEventListener"]("click", function () {
            //      i();
            //    });
            //  };
            //  i();
            //}
            if (
                path.node != null &&
                t.isBinaryExpression(path.node.test) &&
                t.isSequenceExpression(path.node.test.right) &&
                path.node.test.right.expressions.length === 2 &&
                t.isAssignmentExpression(path.node.test.right.expressions[0]) &&
                t.isIdentifier(path.node.test.right.expressions[0].left) &&
                t.isCallExpression(path.node.test.right.expressions[0].right) &&
                t.isMemberExpression(path.node.test.right.expressions[0].right.callee) &&
                t.isCallExpression(path.node.test.right.expressions[0].right.callee.object) &&
                t.isMemberExpression(path.node.test.right.expressions[0].right.callee.object.callee) &&
                t.isIdentifier(path.node.test.right.expressions[0].right.callee.object.callee.property) &&
                path.node.test.right.expressions[0].right.callee.object.callee.property.name == "map"
            ) {
                const arr = path.node.test.right.expressions[0].right.callee.object.callee.object;
                if (
                    t.isArrayExpression(arr) &&
                    arr.elements.every(el => t.isNumericLiteral(el))
                ) {
                    var binding = path.scope.getBinding(path.node.test.right.expressions[0].left.name)
                    if (t.isVariableDeclarator(binding?.path.node)) {
                        binding.path.remove();
                    }
                    path.remove();
                }
            }

            if (
                path.node != null &&
                path.node.alternate == null &&
                t.isBlockStatement(path.node.consequent) &&
                t.isIdentifier(path.node.test)
            ) {
                let binding = path.scope.getBinding(path.node.test.name)
                if (!binding) {
                    return
                }
                if (
                    t.isVariableDeclarator(binding.path.node) &&
                    t.isCallExpression(binding.path.node.init) &&
                    t.isSequenceExpression(binding.path.node.init.callee) &&
                    binding.path.node.init.callee.expressions.length == 2 &&
                    t.isNumericLiteral(binding.path.node.init.callee.expressions[0]) &&
                    binding.path.node.init.callee.expressions[0].value == 0 &&
                    t.isMemberExpression(binding.path.node.init.callee.expressions[1]) &&
                    binding.path.node.init.callee.expressions[1].computed == true &&
                    t.isBinaryExpression(binding.path.node.init.callee.expressions[1].property) &&
                    t.isIdentifier(binding.path.node.init.callee.expressions[1].object)
                ) {
                    path.remove();
                    binding.path.remove();
                }
            }
        },
        TryStatement(path) {
            if (t.isProgram(path.parent) || t.isBlockStatement(path.parent)) {
                var idx = path.parent.body.indexOf(path.node);
                var tmp = path.parent.body[idx - 1];
                if (
                    idx != -1 &&
                    tmp &&
                    t.isVariableDeclaration(tmp) &&
                    tmp.declarations.length == 1 &&
                    t.isNewExpression(tmp.declarations[0].init) &&
                    t.isIdentifier(tmp.declarations[0].init.callee) &&
                    tmp.declarations[0].init.callee.name == "Function" &&
                    path.node.block.body.length == 1 &&
                    t.isExpressionStatement(path.node.block.body[0])
                ) {
                    path.parent.body[idx - 1] = t.emptyStatement();
                    path.remove();
                }
            }
        },
        //const Gs = Rs + ";let ⲆⵠⵠⵠΔΔⲆᐃⲆ = " + Rs + ";" + "let ⲆⵠⵠΔⵠ = 7279634; try { ⲆⵠⵠΔⵠ = ΔⵠⲆΔⲆⵠⲆ; } catch (ⲆⲆᐃⲆⵠⲆᐃ) { ⲆⵠⵠⵠΔΔⲆᐃⲆ (); };";
        //e["setTimeout"](Gs, 0);
        CallExpression(path) {
            if (
                t.isMemberExpression(path.node.callee) &&
                t.isIdentifier(path.node.callee.object) &&
                path.node.callee.computed == true &&
                t.isStringLiteral(path.node.callee.property) &&
                path.node.callee.property.value == "setTimeout" &&
                path.node.arguments.length == 2 &&
                t.isNumericLiteral(path.node.arguments[1]) &&
                path.node.arguments[1].value == 0 &&
                t.isIdentifier(path.node.arguments[0])
            ) {
                var binding = path.scope.getBinding(path.node.arguments[0].name);
                if (t.isVariableDeclarator(binding?.path.node)) {
                    binding.path.remove();
                }
                path.remove();
            }

            //function Sz(i) {
            //    return e.String.fromCharCode(i);
            //}
            //!function () {
            //    const i = {
            //      "ⵠⵠⲆⲆΔᐃⲆⲆⵠ": 3886545,
            //      "ⵠⵠᐃⲆΔⲆⵠⵠⲆ": 3347359,
            //      "ⵠᐃΔΔᐃᐃⵠ": 7529066,
            //      "ΔⲆⵠⲆΔⲆᐃᐃΔ": 3094666
            //    };
            //    if (i[[11616, 5123, 916, 916, 5123, 5123, 11616].map(Sz).join("")] !== 7529066) {
            //      const i = function () {
            //        for (let t = 0; t < 5; t++) e["addEventListener"]("click", function () {
            //          i();
            //        });
            //      };
            //      i();
            //    }
            //}();
            if (
                path.node != null &&
                t.isFunctionExpression(path.node.callee) &&
                path.node.callee.body.body.length == 2 &&
                t.isVariableDeclaration(path.node.callee.body.body[0]) &&
                path.node.callee.body.body[0].declarations.length == 1 &&
                t.isObjectExpression(path.node.callee.body.body[0].declarations[0].init) &&
                t.isIfStatement(path.node.callee.body.body[1])
            ) {
                const ifS = path.node.callee.body.body[1];
                path.node.callee.body.body = path.node.callee.body.body.filter(item => item !== ifS);
            }
        },
        ExpressionStatement(path) {
            if ((t.isProgram(path.parent) || t.isBlockStatement(path.parent))) {
                //const Fp = {};
                //Fp.get = function (i, t) {
                //  if ("ⲆΔΔⲆ" !== t) {
                //    const i = e["setTimeout"],
                //      t = i,
                //      n = function () {
                //        i(n, 7038), t(n, 6549);
                //      };
                //    n();
                //  }
                //  return e.Reflect.get(...arguments);
                //};
                //new e.Proxy({}, Fp).ⲆΔΔⲆ;
                if (t.isMemberExpression(path.node.expression)) {
                    if (
                        t.isNewExpression(path.node.expression.object) &&
                        t.isMemberExpression(path.node.expression.object.callee) &&
                        t.isIdentifier(path.node.expression.object.callee.property, { name: 'Proxy' }) &&
                        path.node.expression.object.arguments.length == 2 &&
                        t.isObjectExpression(path.node.expression.object.arguments[0]) &&
                        path.node.expression.object.arguments[0].properties.length == 0 &&
                        t.isIdentifier(path.node.expression.object.arguments[1])
                    ) {
                        path.remove();
                    }
                }
            }
        },
    })

    console.log("Finished transformation");

    const output = generate(
        ast,
        {},
        minified as string
    );

    console.log(`Running webcrack transformers`);

    writeFileSync("./output/deobfuscated.js", (await webcrack(output.code, {
        jsx: false,
        unpack: true,
        deobfuscate: true,
        unminify: true,
        mangle: true,
        onProgress: (c) => {
            console.log(`[webcrack] ${c}% done`)
        },
    })).code);

    console.log("Writed output to ./output/deobfuscated.js");

    console.log(`Generated`);
})();
